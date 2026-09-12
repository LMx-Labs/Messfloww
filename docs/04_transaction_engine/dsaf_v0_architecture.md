# DSAF V0 Architecture

The **Distributed Saga with Atomic Fencing (DSAF)** is the core transactional architecture designed to safely process MessFloww orders spanning multiple disparate databases (Firestore for ledgers, RTDB for high-speed inventory/KDS) over flaky mobile networks, guaranteeing protection against double-spends and overselling.

## 1. Components
- **Client (Student Portal / Kiosk)**: Generates idempotency keys and initiates the transaction.
- **Transaction Coordinator (`securePlaceOrder`)**: Cloud Function that orchestrates the saga phases across stores.
- **Background Reconciler (`reconcileIntent`)**: Cloud Function (cron-triggered) that detects stuck transactions and recovers or rolls them back deterministically.

## 2. Data Stores
- **Primary Store (Firestore)**: Single source of truth for financial data (`users`, `students`, `ledger`) and the Write-Ahead Log (`transaction_intents`).
- **High-Velocity Store (RTDB)**: Handles transient state (KDS `active_orders`) and highly concurrent inventory (`menu_stock` leases).

## 3. Transaction States
An intent cycles through the following immutable states:
- `INITIALIZED`: Log written, no external systems touched.
- `RESERVED`: Inventory lease acquired in RTDB.
- `FINANCIALLY_COMMITTED`: Wallet debited in Firestore (Point of no return).
- `COMMITTED`: Order dispatched to RTDB KDS; lease committed.
- `CANCELLED`: Transaction aborted (cleanly or via compensation).
- `FAILED`: Hard error before financial commit.

## 4. Intent Schema (Firestore)
```typescript
interface TransactionIntentDocument {
  intentId: string; // Idempotency key
  orderId: string;
  userId: string;
  totalPrice: number;
  state: TransactionIntentState;
  leaseExpiresAt: number; // Unix epoch
  journal: {
    rtdbLeaseAcquired: boolean;
    firestoreWalletDebited: boolean;
    rtdbOrderDispatched: boolean;
    rtdbLeaseReleased: boolean;
    fenceToken: string;
  };
  createdAt: Timestamp;
}
```

## 5. Lease Schema (RTDB)
Located under `menu_stock/{itemId}/activeLeases/{intentId}`:
```typescript
interface ActiveLease {
  qty: number;
  expiresAt: number;
  fenceToken: string;
}
```

## 6. Fencing-Token Structure
A globally unique token linking the Firestore Intent to the RTDB Lease.
**Format**: `{intentId}-{timestamp}-{randomUUID}`
**Purpose**: Prevents the coordinator from committing an RTDB lease that was already reclaimed by another transaction due to TTL expiry.

## 7. Guarded Commit Flow
1. **Initialize**: Coordinator creates `INITIALIZED` intent in Firestore.
2. **Lease**: Coordinator acquires RTDB lease and saves `fenceToken`. Intent -> `RESERVED`.
3. **Debit**: Coordinator debits wallet and updates intent to `FINANCIALLY_COMMITTED` in a single atomic Firestore transaction.
4. **Commit**: Coordinator verifies `fenceToken` against RTDB. If match, lease is consumed, order is written to KDS. Intent -> `COMMITTED`.

## 8. Compensation Flow (Refund)
Triggered if the **Commit** phase fails (e.g., RTDB network error, or Fencing Token mismatch indicating lease expiry).
1. The coordinator catches the error.
2. Evaluates the journal. If `firestoreWalletDebited == true`:
   - An inverse transaction runs: Credits student wallet, writes `refund_{intentId}` ledger entry.
   - **Idempotency Gate**: The refund transaction first reads the intent state. If it is already `CANCELLED`, it skips the credit and returns `ALREADY_REFUNDED`. It uses a deterministic ledger doc ID (`refund_{intentId}`) to block concurrent duplicate ledger writes.
3. Releases RTDB lease.
4. Marks intent as `CANCELLED`.

## 9. Recovery Flow (Cron Reconciler)
A background cron job (`reconcileIncompleteIntents`) sweeps `transaction_intents` for stuck transactions every minute.
- **Idempotency Gate**: The reconciler first re-reads the live intent from Firestore. If the state is already terminal (`COMMITTED`, `CANCELLED`, `FAILED`), it aborts (no-op). This prevents duplicate recovery if multiple sweeper instances overlap.
- **Forward Recovery**: If `firestoreWalletDebited == true`, it attempts to replay the RTDB commit. If fencing fails, it triggers the Compensation Flow.
- **Backward Recovery**: If `firestoreWalletDebited == false`, it releases the RTDB lease and marks the intent `CANCELLED`.

## 10. Idempotency Flow
1. Client generates UUID (`idempotencyKey`).
2. Client sends request to `securePlaceOrder`.
3. Coordinator attempts `firestore.create(intent)`.
4. If it fails with `ALREADY_EXISTS`:
   - Coordinator fetches existing intent.
   - If `COMMITTED`, returns existing `orderId` immediately (Zero side-effects).
   - If `FINANCIALLY_COMMITTED`, triggers Forward Recovery.
   - If `INITIALIZED`/`RESERVED` (and TTL valid), returns `409 Conflict` (processing).

## 11. Failure Scenarios
- **Client loses network after sending request**: Transaction succeeds. Re-opening app uses Idempotency Flow to pull the receipt without double-charging.
- **Coordinator crashes after RTDB Lease**: Lease naturally expires (TTL). Subsequent transactions inline-reclaim the stock. Reconciler eventually marks intent `CANCELLED`.
- **Coordinator crashes after Firestore Debit**: Student is missing money. Reconciler detects `FINANCIALLY_COMMITTED` without `COMMITTED`, attempts forward recovery or triggers refund.
- **High Concurrency (100 users buy 10 items)**: Inline OCC Lazy Reclamation guarantees the highest velocity throughput without full-database locks, while `fenceToken` ensures strict correctness.
