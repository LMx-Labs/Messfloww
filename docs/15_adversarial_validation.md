# 15 — Adversarial Validation, Failure Injection & Concurrency Proof
## Rigorous Stress Testing, Boundary Failure Injection, and Adversarial Vulnerability Analysis of ARCH-B

> **Governing Principles**:
> 1. **Rule 1 — Do Not Assume Success**: We do not assume ARCH-B works; we actively attempt to disprove it, uncover its race conditions, and characterize its breaking boundaries.
> 2. **Engineering Reality Over Patent Claims**: Architecture is never artificially inflated or altered to manufacture patentability. Vulnerabilities are documented with forensic precision.
> 3. **Executable Empirical Evidence**: All assertions are anchored in executable code in `apps/admin-hq/functions/src/index.ts`, `apps/admin-hq/functions/src/test/archBValidation.ts`, and `apps/admin-hq/functions/src/test/adversarialBreakTest.ts`.
> 4. **Four-Status Taxonomy**: Every assertion is classified as `FACT` (verified directly in code/tests), `INFERENCE` (logical deduction from verified facts), `PROPOSAL` (potential engineering remedy), or `UNKNOWN` (untested boundary).

---

## PART 1 — IMPLEMENTATION VERIFICATION

We verify whether the mechanisms described in `14_arch_b_implementation_and_validation.md` exist in the active repository code.

### 1.1 Verification Matrix

| Mechanism | Expected Behaviour (Doc 14) | Actually Implemented | File / Function | Code Evidence | Status |
|---|---|---|---|---|---|
| **Durable Transaction Intent** | Write-ahead document in Firestore (`transaction_intents/{intentId}`) before RTDB mutation. Contains state machine, TTL, and journal bitmask. | **YES** | `apps/admin-hq/functions/src/index.ts` L502–523 | `initialIntent` written with `state: 'INITIALIZED'`, `journal`, and `leaseExpiresAt = now + 120000`. | **FACT** |
| **Deterministic Transaction ID** | Client `idempotencyKey` anchored to `intentId` to survive network drops and re-clicks. | **YES** | `index.ts` L346–349; `orderService.ts` L205–216; `CartScreen.tsx` L33 | `const intentId = (idempotencyKey && ...) ? idempotencyKey.trim() : generateSecureOrderId();` | **FACT** |
| **Inventory Reservation (Phase 1)** | Two-phase lease on RTDB (`stock -= Q`, `reserved += Q`, `activeLeases[intentId] = { qty, expiresAt }`). | **YES** | `index.ts` L93–166 (`acquireRtdbLeases`) | RTDB OCC transaction decrements `stock`, increments `reserved`, records lease. | **FACT** |
| **Reservation Expiry (TTL)** | Expired leases purged or reclaimed after TTL (120 seconds). | **YES** | `index.ts` L114–125; L220–321; L1231–1270 | Inline OCC checks `lease.expiresAt < now`; background reconciler sweeps `leaseExpiresAt <= nowMs`. | **FACT** |
| **Financial Coordination (Phase 2)** | Firestore transaction debits student wallet, creates immutable ledger record, and atomically sets `journal.firestoreWalletDebited = true`. | **YES** | `index.ts` L543–594 | Firestore `db.runTransaction()` atomically mutates student balance, user balance, ledger, and updates intent doc. | **FACT** |
| **Order Finalization (Phase 3)** | RTDB order written to `active_orders/{orderId}`, RTDB leases committed (`commitRtdbLeases`), intent marked `COMMITTED`. | **YES** | `index.ts` L596–639 | Writes RTDB order with `intentId`, clears `reserved` count, purges `activeLeases`, sets intent `COMMITTED`. | **FACT** |
| **Idempotency Layer** | Pre-read of `transaction_intents/{intentId}` returns existing receipt with zero duplicate writes if already `COMMITTED`. | **YES** | `index.ts` L386–401 | Reads intent doc; if `COMMITTED`, immediately returns stored `orderId`, `orderNumber`, `estimatedServingWindow`. | **FACT** |
| **In-Flight Recovery** | If money was debited but dispatch failed, catch handler or client retry executes immediate forward recovery. | **YES** | `index.ts` L403–436; L655–668 | Checks `journal.firestoreWalletDebited`; if true, writes `active_orders`, commits leases, finalizes intent. | **FACT** |
| **Asynchronous Reconciliation** | Scheduled Cloud Function sweeps expired incomplete intents every 1 minute. | **YES** | `index.ts` L1231–1270 (`reconcileIncompleteIntents`) | Scheduled Cloud Function queries `state in ['INITIALIZED', 'RESERVED', 'FINANCIALLY_COMMITTED']` where `leaseExpiresAt <= nowMs`. | **FACT** |
| **Backward Refund Fallback** | If reconciler forward recovery cannot write RTDB, it reverses the Firestore wallet debit and logs refund ledger. | **YES** | `index.ts` L270–309 (`reconcileIntent`) | Caught forward recovery errors trigger Firestore refund transaction and `releaseRtdbLeases`. | **FACT** |
| **Atomic Intent Creation** | Atomic test-and-set insertion of `transaction_intents/{intentId}` to block simultaneous identical requests. | **PARTIAL / FLAWED** | `index.ts` L387 & L523 | Uses non-transactional `await intentRef.get()` followed by `await intentRef.set()`. TOCTOU race exists. | **FACT — VULNERABILITY** |
| **Lease Fencing Token** | Validation that lease is still owned prior to commitment in Phase 4. | **MISSING** | `index.ts` L173–190 (`commitRtdbLeases`) | `commitRtdbLeases` does not return a status or verify lease ownership; silently succeeds if lease was reclaimed. | **FACT — VULNERABILITY** |

---

## PART 2 — DEFINITION OF CONSISTENCY INVARIANTS

ARCH-B is evaluated against five core invariants. We define each mathematically, operationally, and analyze its vulnerability threshold.

### 2.1 Inventory Invariant (INV-INV)

$$\forall \text{item } i, \forall t: \quad \text{physical\_units}(i) = \text{available}(i, t) + \sum_{k \in \text{activeLeases}} \text{qty}(k) + \sum_{o \in \text{committedOrders}} \text{qty}(o, i)$$

- **Operational Definition**: No transaction should permanently consume or leak physical inventory without an accompanying, committed transaction. Expired or aborted transactions must return units to `available`.
- **ARCH-B Implementation**:
  - `available` is decremented while `reserved` is incremented during lease acquisition.
  - Abort in Phase 3 triggers `releaseRtdbLeases()`, restoring units to `available`.
  - Abandoned leases are reclaimed inline by OCC during subsequent touch or by the background reconciler.
- **Adversarial Risk**: If a client's lease expires during Phase 3, and another client leases the same stock, does the original client oversell stock when it resumes? (**Investigated in Part 5**).

### 2.2 Financial Invariant (INV-FIN)

$$\forall \text{tx } T: \quad \text{debit}(\text{wallet}(T.\text{user}), T.\text{amount}) \iff \big(\text{state}(T) \in \{\text{FINANCIALLY\_COMMITTED}, \text{COMMITTED}\} \land \text{inventoryReserved}(T)\big)$$

- **Operational Definition**: A student's wallet balance must be debited if and only if valid inventory has been leased, and no logical transaction may apply its financial debit more than once:
  $$\forall \text{intentId } k, \quad \sum \text{debits}(k) - \sum \text{refunds}(k) \le T.\text{totalPrice}$$
- **ARCH-B Implementation**:
  - RTDB leases are acquired *before* Firestore financial debit.
  - Debit occurs inside Firestore ACID transaction alongside journal bitmask update `journal.firestoreWalletDebited = true`.
  - Idempotent replay short-circuits before financial transaction.
- **Adversarial Risk**: If two concurrent requests with identical `idempotencyKey` bypass the non-transactional pre-check, both could execute `db.runTransaction()`, creating duplicate debits. (**Investigated in Part 5**).

### 2.3 Order Invariant (INV-ORD)

$$\forall T: \quad \text{journal.firestoreWalletDebited}(T) = \text{true} \implies \lozenge \Big(\exists o \in \text{active\_orders}: o.\text{intentId} = T.\text{intentId} \land o.\text{status} = \text{'ordered'}\Big) \lor \lozenge \big(\text{refunded}(T) = \text{true}\big)$$

- **Operational Definition**: If money is debited, a visible kitchen order record in RTDB *must* eventually exist, or the money *must* be refunded to the student's wallet. Under no circumstances may a student be charged while neither an order nor a refund exists.
- **ARCH-B Implementation**:
  - Step 4 writes `active_orders/${orderId}`.
  - Catch handler detects `journal.firestoreWalletDebited === true` and executes immediate forward recovery.
  - Background reconciler detects unfinalized financially committed intents past lease expiry, retrying order dispatch or falling back to refund.

### 2.4 Reservation Invariant (INV-RES)

$$\forall k \in \text{activeLeases}: \quad \text{currentTime}() > k.\text{expiresAt} \implies \lozenge \big(k \notin \text{activeLeases}\big)$$

- **Operational Definition**: An expired reservation must not remain indefinitely active. Dead leases must be reclaimed and returned to available stock without requiring human administrative intervention.
- **ARCH-B Implementation**:
  - Two independent reclamation paths:
    1. **Inline OCC Lazy Reclamation**: Executed inside `acquireRtdbLeases` transaction when any customer touches the item ($O(1)$ touch latency, zero cron delay).
    2. **Scheduled Sweeper**: Executed every 60 seconds by `reconcileIncompleteIntents` Cloud Function.

### 2.5 Idempotency Invariant (INV-IDEM)

$$\forall f, k, \text{req}: \quad f\big(f(\text{req}, k)\big) = f(\text{req}, k)$$

- **Operational Definition**: Submitting the same logical checkout request multiple times (due to client retry, network timeout, double-clicking) produces exactly one financial deduction, consumes exactly one set of inventory units, and returns the identical order confirmation.

---

## PART 3 — FAILURE-INJECTION MATRIX (10 CRITICAL BOUNDARY POINTS)

To evaluate ARCH-B under catastrophic conditions, we constructed an isolated test harness in `apps/admin-hq/functions/src/test/adversarialBreakTest.ts` that systematically terminates execution at every discrete boundary.

### 3.1 Failure Point Architecture Diagram

```
[Incoming Request: cart, idempotencyKey]
      │
      ▼
 (1) ─── CRASH POINT 1: Before intent creation
      │
[Step 1: Firestore intentRef.set(INITIALIZED)]
      │
      ▼
 (2) ─── CRASH POINT 2: After intent, before RTDB lease
      │
[Step 2: RTDB acquireRtdbLeases() -> RESERVED]
      │
      ▼
 (3) ─── CRASH POINT 3: After reservation, before financial debit
      │
 (4) ─── CRASH POINT 4: Financial transaction abort (insufficient funds)
      │
[Step 3: Firestore db.runTransaction() -> FINANCIALLY_COMMITTED]
      │
      ▼
 (5) ─── CRASH POINT 5: After financial debit, before RTDB dispatch
      │
 (6) ─── CRASH POINT 6: Hard container crash before active_orders write
      │
[Step 4: RTDB active_orders.set()]
      │
      ▼
 (7) ─── CRASH POINT 7: After active_orders, before commitRtdbLeases
      │
 (8) ─── CRASH POINT 8: Catch compensation handler crashes mid-rollback
      │
[Reconciler Background Sweeper Runs]
      │
      ▼
 (9) ─── CRASH POINT 9: Forward recovery RTDB write fails permanently
      │
 (10)─── CRASH POINT 10: Sweeper crashes after dispatch, before state update
```

### 3.2 Failure-Injection Results Table

The following table records the empirical results obtained from executing `adversarialBreakTest.ts`:

| Failure Point | Injected Boundary Condition | Persisted State at Crash | Lost In-Memory State | Automated Recovery Action | Final System State | Invariant Preserved? |
|---|---|---|---|---|---|---|
| **Point 1** | Process dies before writing intent document to Firestore. | RTDB: Stock unchanged.<br>Firestore: No intent record.<br>Wallet: Balance untouched. | Request payload, client connection. | None needed. Client retries from clean slate. | Stock untouched.<br>Wallet untouched.<br>Zero phantom records. | **INV-INV: YES**<br>**INV-FIN: YES**<br>**INV-ORD: YES** |
| **Point 2** | Process dies after writing intent (`INITIALIZED`), before touching RTDB. | Firestore: `state='INITIALIZED'`.<br>RTDB: Stock untouched.<br>Wallet: Untouched. | Cloud Function container execution thread. | Reconciler sweeps expired `INITIALIZED` intent; marks `CANCELLED`. | Intent cancelled.<br>Stock untouched.<br>Balance untouched. | **INV-INV: YES**<br>**INV-FIN: YES**<br>**INV-RES: YES** |
| **Point 3** | Process dies after RTDB lease acquisition (`RESERVED`), before Firestore financial transaction. | RTDB: `stock = S - Q`, `reserved = Q`, lease active.<br>Firestore: `state='RESERVED'`.<br>Wallet: Untouched. | In-flight execution context. | Catch handler calls `releaseRtdbLeases()`. If catch dies, reconciler sweeps expired lease. | Leases released.<br>`stock = S`, `reserved = 0`.<br>Intent `CANCELLED`. | **INV-INV: YES**<br>**INV-FIN: YES**<br>**INV-RES: YES** |
| **Point 4** | Firestore transaction aborts (e.g., student balance < total price, account disabled). | RTDB: Leases active.<br>Firestore: Intent in `RESERVED`, transaction aborted.<br>Wallet: Untouched. | Transaction abort error stack. | Catch handler detects `firestoreWalletDebited=false`, calls `releaseRtdbLeases()`, updates intent to `CANCELLED`. | Stock fully restored.<br>Reserved cleared.<br>Intent `CANCELLED`. | **INV-INV: YES**<br>**INV-FIN: YES**<br>**INV-RES: YES** |
| **Point 5** | Container crashes immediately after Firestore financial commit, before RTDB `active_orders` write. | Firestore: Wallet debited, ledger written, `state='FINANCIALLY_COMMITTED'`.<br>RTDB: Leases active, no order record. | Container memory. | Catch handler detects `firestoreWalletDebited=true`, executes immediate **Forward Recovery**: dispatches order and commits leases. | Order created in RTDB.<br>Leases committed.<br>Intent `COMMITTED`. | **INV-INV: YES**<br>**INV-FIN: YES**<br>**INV-ORD: YES** |
| **Point 6** | Hard container preemption / OOM kill after financial commit where in-container catch block does NOT execute. | Firestore: Wallet debited, `state='FINANCIALLY_COMMITTED'`.<br>RTDB: Leases active, no order record. | Entire container instance evicted by host OS. | **Asynchronous Reconciler** detects expired intent with `firestoreWalletDebited=true`. Dispatches order to RTDB and commits leases. | Order created in RTDB.<br>Leases committed.<br>Intent `COMMITTED`. | **INV-INV: YES**<br>**INV-FIN: YES**<br>**INV-ORD: YES** |
| **Point 7** | Crash occurs after writing `active_orders`, but before `commitRtdbLeases` or intent update. | RTDB: Order exists, but leases still in `reserved`.<br>Firestore: `state='FINANCIALLY_COMMITTED'`. | Execution context. | Forward recovery in catch handler or reconciler detects existing order, commits leases, updates intent to `COMMITTED`. | Order exists.<br>Leases committed.<br>Intent `COMMITTED`. | **INV-INV: YES**<br>**INV-FIN: YES**<br>**INV-ORD: YES** |
| **Point 8** | Compensation handler itself crashes while rolling back RTDB leases during a Point 4 failure. | RTDB: Leases remain active in `menu_stock`.<br>Firestore: Intent remains in `RESERVED`. | Catch handler execution context. | **Inline OCC Lazy Reclamation** or **Reconciler Sweeper** sweeps expired lease past TTL. | Stock returned to unreserved pool.<br>Reserved count cleared.<br>Intent `CANCELLED`. | **INV-INV: YES**<br>**INV-FIN: YES**<br>**INV-RES: YES** |
| **Point 9** | Reconciler executes forward recovery, but RTDB suffers a permanent disk / network partition. | Firestore: Wallet debited.<br>RTDB: Completely unreachable. | Reconciler forward recovery attempt. | Reconciler forward recovery catch block triggers **Backward Refund**: refunds wallet, logs refund ledger, updates intent to `CANCELLED`. | Student refunded.<br>Audit ledger updated.<br>Zero monetary loss. | **INV-INV: YES**<br>**INV-FIN: YES**<br>**INV-ORD: YES** |
| **Point 10** | Reconciler crashes after writing `active_orders`, before updating intent state to `COMMITTED`. | RTDB: Order written.<br>Firestore: `state='FINANCIALLY_COMMITTED'`. | Reconciler container thread. | Next reconciler run is **idempotent**: sees existing order at `active_orders/{orderId}`, commits leases, finalizes intent. | Order preserved without duplication.<br>State `COMMITTED`. | **INV-INV: YES**<br>**INV-FIN: YES**<br>**INV-IDEM: YES** |

### 3.3 Empirical Log Evidence (from `adversarialBreakTest.ts`)

```text
--- PART 3: Failure Injection at Every Critical Boundary ---
  [PASS] Point 1 (Before intent creation): Clean abort, zero side effects
  [PASS] Point 2 (After intent, before lease): Intent CANCELLED, stock untouched, balance untouched
  [PASS] Point 3 (After reservation, before financial): Catch handler released lease, restored stock
  [PASS] Point 4 (Financial abort - Insufficient balance): Catch handler compensates, stock restored
  [PASS] Point 5 (After financial debit): Catch handler executed forward recovery, created order
  [PASS] Point 6 (Hard crash before order creation): Sweeper performed forward recovery, order created
  [PASS] Point 7 (After order creation): Forward recovery in catch committed leases and finalized intent
  [PASS] Point 8A (Compensation handler crash): Incomplete state captured in durable store
  [PASS] Point 8B (Sweeper recovers Point 8 crash): Expired lease swept, stock restored to 10
  [PASS] Point 9 (Recovery RTDB failure fallback): Student fully refunded, ledger logged, leases released
  [PASS] Point 10 (Re-entrant recovery after mid-sweep crash): Successfully finalized to COMMITTED without duplicating order
```

---

## PART 4 — UNKNOWN-OUTCOME DISTRIBUTED FAILURE TESTING

The most dangerous failure mode in distributed systems is the **Unknown-Outcome Network Drop**:

```text
Student Terminal                 Serverless Runtime                   Cloud Firestore / RTDB
       │                                  │                                     │
       │─── POST securePlaceOrder ───────>│                                     │
       │    (cart, idempotencyKey: K)     │─── 1. Write Intent (K) ────────────>│
       │                                  │─── 2. Acquire RTDB Leases ─────────>│
       │                                  │─── 3. Debit Wallet (ACID Tx) ──────>│
       │                                  │─── 4. Dispatch Order to RTDB ──────>│
       │                                  │─── 5. Commit Leases & Intent ──────>│
       │                                  │                                     │
       │    ×××× NETWORK DROP ××××        │ [Server completes 100% cleanly]     │
       │    (Client TCP connection RST)   │                                     │
       ▼                                  ▼                                     ▼
[Client sees HTTP Timeout / Unknown]
```

### 4.1 Test Execution Sequence

1. **Initial Submission**:
   - Request submitted with `idempotencyKey = 'CLIENT-IDEMP-UNKNOWN-001'`.
   - Server completes Step 1 through Step 4 successfully:
     - Initial stock of item 50 was 10; decremented to 8.
     - Student balance was ₹500; debited ₹120 to ₹380.
     - Order `ORD-CLIENT-IDEMP-UNKNOWN-001` written to RTDB `active_orders`.
     - Intent updated to `COMMITTED`.
2. **Network Interruption**:
   - HTTP response packet dropped before reaching the student device.
   - Student portal catches network timeout. Student taps "Retry Checkout".
3. **Idempotent Retry**:
   - Client re-submits exact same payload with identical `idempotencyKey = 'CLIENT-IDEMP-UNKNOWN-001'`.
   - `securePlaceOrder` reads `transaction_intents/CLIENT-IDEMP-UNKNOWN-001`.
   - Observes `state === 'COMMITTED'`.
   - **Zero writes to Firestore. Zero writes to RTDB. Zero wallet debits. Zero stock decrements.**
   - Returns cached receipt: `{ success: true, orderId, orderNumber: 42, idempotentReplay: true }`.

### 4.2 Empirical Verification Results

```text
--- PART 4: Unknown-Outcome Network Drop & Timeout Testing ---
  [PASS] Phase 4A: Initial server execution succeeded
  [PASS] Phase 4B: Replay detected committed state without re-executing
  [PASS] Phase 4C: INV-INV preserved: Stock decremented exactly once (10 - 2 = 8)
  [PASS] Phase 4D: INV-FIN preserved: Balance debited exactly once (500 - 120 = 380)
```

**Conclusion on Unknown-Outcome**: For sequential retries, ARCH-B deterministically reconstructs receipt state and preserves all five invariants.

---

## PART 5 — ADVERSARIAL CONCURRENCY & BREAKING ATTACKS

To fulfill Rule 1 ("Attempt to disprove it"), we conducted targeted concurrency attacks against ARCH-B's architectural seams.

**Two significant vulnerabilities were discovered, proved, and experimentally reproduced.**

---

### ATTACK 1 — TOCTOU Race on Non-Atomic Intent Check

#### Theoretical Vulnerability
In `apps/admin-hq/functions/src/index.ts` lines 387–523:
```typescript
// Line 387
const existingIntentSnap = await intentRef.get();
if (existingIntentSnap.exists) {
  // Idempotency replay logic
}

// ... intervening validation code ...

// Line 523
await intentRef.set(initialIntent);
```
`intentRef.get()` and `intentRef.set()` are **not atomic**. They do not occur within a transaction or conditional write.

If a student double-taps checkout rapidly, or a mobile client dispatches two identical requests simultaneously over dual SIM / Wi-Fi connections:
1. Request 1 executes `intentRef.get()` $\to$ does not exist (`snap.exists === false`).
2. Request 2 executes `intentRef.get()` $\to$ does not exist (`snap.exists === false`).
3. Both requests proceed to Step 2: `acquireRtdbLeases(rtdb, cart, sharedKey)`.
4. Both requests call RTDB transaction on `menu_stock/{itemId}` with the **same** `sharedKey`.
5. RTDB transaction for Request 1 decrements stock ($10 \to 9$), increments reserved ($0 \to 1$).
6. RTDB transaction for Request 2 decrements stock ($9 \to 8$), increments reserved ($1 \to 2$)!
7. `activeLeases[sharedKey]` is overwritten with Request 2's timestamp.
8. Both requests enter Firestore Phase 3 and execute `db.runTransaction()`.
9. **Student wallet is debited TWICE. RTDB stock is decremented TWICE.**

#### Experimental Proof (from `adversarialBreakTest.ts`)
```text
  [ATTACK 1] TOCTOU Race: Two identical requests with same idempotencyKey concurrently
  [PASS] VULNERABILITY DETECTED: TOCTOU race on non-atomic intent creation allows duplicate lease decrement
```

#### Forensic Assessment
- **Severity**: HIGH under high-concurrency re-entry.
- **Root Cause**: `intentRef.set()` does not use Firestore's atomic `create()` method (which fails if the document already exists) or an initial Firestore transaction.
- **Invariant Violated**: **INV-FIN** (wallet debited twice for identical key) and **INV-INV** (inventory over-decremented).

---

### ATTACK 2 — TTL Expiry Race & Fencing Token Gap (Inventory Overselling)

#### Theoretical Vulnerability
This is the classic distributed systems lease expiration hazard (identified in distributed lock literature by Martin Kleppmann).

Consider the following execution timeline:
1. Physical stock of Biryani is **1 unit** (`stock = 1, reserved = 0`).
2. **Client A** initiates checkout for 1 Biryani with lease TTL = 120 seconds.
3. Client A successfully executes Phase 2 (`acquireRtdbLeases`):
   - `stock = 0`, `reserved = 1`, `activeLeases['INTENT-A'] = { qty: 1, expiresAt: T0 + 120s }`.
4. **Client A experiences severe execution delay in Phase 3**:
   - Caused by Firestore transaction retry contention, GC pause, or Cloud Function cold-start latency.
   - Client A's execution is paused for 125 seconds ($t = T_0 + 125s$).
   - Client A's lease expires ($125s > 120s$).
5. **Client B** arrives at $t = T_0 + 125s$ and requests 1 Biryani.
   - Client B enters `acquireRtdbLeases`.
   - **Inline OCC Lazy Lease Reclamation** sees `activeLeases['INTENT-A'].expiresAt < now`.
   - Inline OCC reclaims Client A's lease: `stock` becomes $0 + 1 = 1$, `reserved` becomes $1 - 1 = 0$, `activeLeases['INTENT-A']` is deleted!
   - Client B leases that reclaimed unit: `stock = 0`, `reserved = 1`, `activeLeases['INTENT-B']` is created!
   - Client B finishes Phase 3 and Phase 4, successfully purchasing the item.
6. **Client A wakes up from pause**:
   - Client A finishes Phase 3 (debits student wallet).
   - Client A executes Phase 4: calls `commitRtdbLeases(rtdb, cart, 'INTENT-A')`.
7. **Inspecting `commitRtdbLeases` (`index.ts` L173–190)**:
   ```typescript
   export async function commitRtdbLeases(rtdb, cart, intentId) {
     for (const item of cart) {
       const stockRef = rtdb.ref(`menu_stock/${item.id}`);
       await stockRef.transaction((currentData) => {
         if (currentData === null) return currentData;
         if (currentData.activeLeases && currentData.activeLeases[intentId]) {
           const leasedQty = currentData.activeLeases[intentId].qty || item.qty;
           currentData.reserved = Math.max(0, (currentData.reserved || 0) - leasedQty);
           delete currentData.activeLeases[intentId];
         }
         return currentData; // <--- SILENTLY SUCCEEDS IF LEASE IS MISSING!
       });
     }
   }
   ```
   Because `activeLeases['INTENT-A']` was already deleted, `commitRtdbLeases` does nothing, does not decrement Client B's reservation, and **does NOT throw an error**.
8. Client A writes `active_orders/ORD-A` to RTDB and marks intent `COMMITTED`!
9. **Final State**:
   - **1 physical item existed**.
   - **2 orders are active in the kitchen queue** (`ORD-A` and `ORD-B`).
   - **2 students were debited**.
   - **The physical inventory has been oversold!**

#### Experimental Proof (from `adversarialBreakTest.ts`)
```text
  [ATTACK 2] TTL Expiry Race: Lease expires during Phase 3, reclaimed by Client B, Client A commits anyway
  [PASS] VULNERABILITY DETECTED: Lack of Fencing Token allows delayed client to commit after lease was reclaimed
```

#### Forensic Assessment
- **Severity**: CRITICAL under long execution pauses / network delays exceeding lease TTL.
- **Root Cause**: Absence of a **Fencing Token** or lease ownership verification. Phase 4 assumes that because Phase 2 succeeded, the lease is still valid. `commitRtdbLeases` does not abort or notify the caller if the lease was reclaimed.
- **Invariant Violated**: **INV-INV** (inventory conservation broken: 2 committed units from 1 physical unit).

---

### ATTACK 3 — Concurrent Reconciler vs. Client Retry Race

#### Test Scenario
A client transaction is delayed past lease expiry.
- At $t = T_0 + 120.001s$, the **Background Sweeper** (`reconcileIncompleteIntents`) selects this intent for recovery.
- At the exact same millisecond, the **Student** taps "Retry" on their mobile app.
- Both the Sweeper worker and the Cloud Function worker execute forward recovery simultaneously.

#### Experimental Proof (from `adversarialBreakTest.ts`)
```text
  [ATTACK 3] Reconciler vs Client Retry Race: Dual forward recovery on same intent
  [PASS] Deterministic Path Prevents Duplicate Orders in Sweeper vs Client Race
```

#### Forensic Assessment
- **Mechanism Behavior**: ARCH-B **withstands** this attack cleanly.
- **Why It Holds**:
  - The order path is deterministic: `active_orders/${intent.orderId}`.
  - Both workers write to the *identical* RTDB document key.
  - `commitRtdbLeases` is idempotent: the first worker clears the lease; the second worker observes an empty lease map and cleanly no-ops.
  - Dual execution results in exactly **one** kitchen order.

---

### ATTACK 4 — Multi-Item Ordering & Deadlock Analysis

#### Test Scenario
Customer 1 orders Cart $[A, B]$. Customer 2 orders Cart $[B, A]$. Both execute `acquireRtdbLeases` concurrently. In traditional SQL / relational locking systems, this produces a classic ABBA deadlock.

#### Forensic Assessment
- **Mechanism Behavior**: ARCH-B is **immune** to locking deadlocks on RTDB.
- **Why It Holds**:
  - Firebase Realtime Database does not hold row locks across network roundtrips.
  - `stockRef.transaction()` executes an isolated, optimistic concurrency mutation on that individual node.
  - While live-lock (both carts repeatedly contending) is theoretically possible under extreme concurrency, mutual blocking deadlock is impossible because no locks are held between items.

---

## PART 6 — COMPREHENSIVE FAILURE MODE TAXONOMY

The following table summarizes all known failure modes in ARCH-B, comparing what has been eliminated against what remains:

| Failure Mode ID | Failure Description | Baseline MessFloww | ARCH-B Status | Residual Vulnerability Mechanism |
|---|---|---|---|---|
| **FM-01** | RTDB stock decrements, Firestore wallet debit fails; stock permanently lost. | **VULNERABLE** | **ELIMINATED** | Caught by catch handler `releaseRtdbLeases()` or swept by reconciler/OCC. |
| **FM-02** | Kiosk debits wallet first, RTDB stock fails; student charged without food. | **VULNERABLE** | **ELIMINATED** | Sequence inverted: stock reserved first; wallet debited second; wallet failure rolls back stock. |
| **FM-03** | Wallet debited, but process crashes before dispatching kitchen order. | **VULNERABLE** | **ELIMINATED** | Caught by journal bitmask; forward recovery creates order or backward refund repays wallet. |
| **FM-04** | Client retries after lost HTTP response; charged twice for duplicate order. | **VULNERABLE** | **ELIMINATED** (sequential) | Request anchored to `idempotencyKey`; committed state returns cached receipt. |
| **FM-05** | Serverless container killed (OOM/preemption); in-memory rollback lost. | **VULNERABLE** | **ELIMINATED** | Durable write-ahead intent survives container death; background sweeper converges state. |
| **FM-06** | **Concurrent Idempotency Collision (TOCTOU)**: Simultaneous requests with same key. | N/A (no idempotency) | **RESIDUAL FLAW** | `intentRef.get()` and `intentRef.set()` are not atomic. Dual execution causes duplicate debits. |
| **FM-07** | **Lease Expiry Fencing Gap**: Delayed client commits after lease reclaimed and sold. | N/A (no leases) | **RESIDUAL FLAW** | `commitRtdbLeases` does not verify lease ownership. Delayed client oversells reclaimed stock. |
| **FM-08** | **Non-Atomic Multi-Item Release Crash**: Crash mid-loop during `releaseRtdbLeases`. | **VULNERABLE** | **TEMPORARY SKEW** | Items released sequentially; crash leaves tail items reserved until lease TTL expires. |

---

## PART 7 — TECHNICAL MEANINGFULNESS & PATENT REALITY CHECK

A core question of PROMPT 15 is:

> *Does ARCH-B contain a technically meaningful mechanism beyond conventional Saga, TCC (Try-Confirm-Cancel), idempotency, and reconciliation patterns?*

We answer this with strict technical objectivity, evaluating the architecture against established computer science literature and patent eligibility criteria.

### 7.1 Mapping ARCH-B to Established Distributed Computing Patterns

| ARCH-B Mechanism | Canonical Computer Science Pattern | Prior Art / Established Equivalent |
|---|---|---|
| `acquireRtdbLeases()` | **TCC Phase 1: Try** | Reserving resources tentatively prior to commitment (standard TCC pattern, Jim Gray 1981, Pat Helland 2007). |
| `commitRtdbLeases()` | **TCC Phase 2: Confirm** | Finalizing tentative reservation into permanent allocation. |
| `releaseRtdbLeases()` | **TCC Phase 2: Cancel** | Compensating transaction releasing tentatively held resources. |
| `transaction_intents` | **Transactional Outbox / Write-Ahead Log** | Storing durable execution state before distributed mutation (Chris Richardson, Microservices Patterns). |
| `reconcileIncompleteIntents` | **Saga Orchestrator / Sweeper Reconciler** | Polling background reconciler resolving unacknowledged distributed state (Garcia-Molina & Salem 1987). |
| Client `idempotencyKey` | **Idempotent Consumer / Deduplication** | RFC 7231 / Stripe API Idempotency Keys (2014). |
| `activeLeases/{intentId}` TTL | **Lease with Expiry** | Gray & Cheriton, "Leases: An Efficient Fault-Tolerant Mechanism for Distributed File Cache Consistency" (SOSP 1989). |

### 7.2 What Is ACTUALLY Novel in ARCH-B?

If TCC, Saga, Outbox, and Leases are all well-known prior art, where does ARCH-B possess unique technical character?

#### 1. Inline OCC Lazy Lease Reclamation (The Specific Technical Distinction)
In conventional distributed systems:
- Lease reclamation requires either an active distributed lock manager (e.g., Chubby, ZooKeeper, etcd) or a dedicated background reaper process polling at periodic intervals.
- A periodic reaper has a **latency gap**: an item whose lease expired at $t=10s$ cannot be bought until the reaper sweeps at $t=60s$. During high-demand flash sales, this creates artificial stock-outs.

**ARCH-B embeds lazy reclamation directly within the single-threaded OCC callback of the in-memory tree store (`menu_stock/{itemId}`)**:
```typescript
// Reclaim dead leases on this specific item INSIDE the atomic OCC callback
// before evaluating current available stock
for (const [otherIntentId, lease] of Object.entries(currentData.activeLeases)) {
  if (lease.expiresAt < now) {
    currentData.stock += lease.qty;
    currentData.reserved -= lease.qty;
    delete currentData.activeLeases[otherIntentId];
  }
}
```
- **Technical Effect**: Zero latency. The very customer who needs the item reclaims the expired lease synchronously in sub-millisecond memory execution without waiting for the 60-second cron job.
- **Physical Limitation**: This only works because Firebase RTDB's underlying architecture serializes transaction updates per path.

#### 2. Cross-Model Heterogeneous State Correlation
- Bridging a document-oriented ACID database (Cloud Firestore) with an in-memory hierarchical key-value tree (RTDB) in an ephemeral, serverless environment without running a persistent daemon or coordinator node.
- Embedding the document ID of the outbox log (`intentId`) directly as a node key in the realtime tree structure (`menu_stock/{itemId}/activeLeases/{intentId}`).

### 7.3 Honest Patentability Assessment (35 U.S.C. 101, 102, 103)

If a patent application based on ARCH-B were submitted to the USPTO or EPO:

1. **35 U.S.C. 101 (Alice / Mayo Rejection Risk)**:
   - **High Risk**: An examiner will argue that "reserving inventory, checking a wallet balance, and completing an order" is a fundamental economic practice (hedging / escrow), and implementing it across two databases using standard serverless functions is an abstract idea implemented on generic computer hardware.
   - **Overcoming Strategy**: The claims *must not* focus on the business concept of food ordering. They must be drafted strictly as a **computer-implemented data synchronization protocol** between a hierarchical realtime tree store and an append-only document store in an execution environment lacking persistent coordinator state, specifically claiming the **inline optimistic concurrency lazy lease reclamation mechanism**.

2. **35 U.S.C. 102 / 103 (Novelty and Non-Obviousness)**:
   - TCC is prior art. Sagas are prior art. Idempotency tokens are prior art.
   - A rejection combining TCC (e.g., Alibaba / ByteTCC) with TTL Leases (Gray & Cheriton) would be asserted under § 103 (Obviousness).
   - The inventive step must be anchored in the **specific structural synergy** between the single-threaded OCC tree store and the atomic document journal, and the inline dead-lease reclamation that eliminates the asynchronous polling latency.

3. **Vulnerabilities Impact on Patent Claims**:
   - The existence of **Attack 1 (TOCTOU)** and **Attack 2 (Fencing Token Gap)** does *not* invalidate the patentability of the core mechanism, but it means that any patent claim asserting that ARCH-B "guarantees absolute zero double allocation" would be technically inaccurate and vulnerable to invalidation if not qualified by proper boundary conditions.

---

## CONCLUSION

The adversarial validation of ARCH-B yields five definitive engineering conclusions:

1. **The Mechanism Works**: Under standard execution and all 10 single-point crash boundaries, ARCH-B successfully guarantees data convergence, eliminates orphaned debits, and prevents permanent inventory leaks.
2. **The 5 Baseline Failure Modes are Fixed**: FM-01 through FM-05 are verifiably resolved in the codebase.
3. **Two Concrete Concurrency Vulnerabilities Exist**:
   - Non-atomic intent creation allows duplicate execution under simultaneous identical requests (**Attack 1**).
   - Missing lease validation in `commitRtdbLeases` allows inventory overselling if execution pauses exceed the lease TTL (**Attack 2**).
4. **Experimental Proof Is Complete**: 19/19 test assertions in `adversarialBreakTest.ts` compiled cleanly with TypeScript and passed with 100% execution fidelity.
5. **Technical Core Is Characterized**: ARCH-B is fundamentally a specialized adaptation of the **Try-Confirm-Cancel (TCC)** and **Transactional Outbox** patterns for serverless dual-database architectures, distinguished by its **Inline OCC Lazy Lease Reclamation** on a realtime hierarchical tree store.
