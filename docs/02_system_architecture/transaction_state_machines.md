# Transaction State Machines

## 1. Order State Machine
The core workflow of a food order from initiation to fulfillment.

**States:** `PENDING` -> `PREPARING` -> `READY` -> `COLLECTED`
**Failure States:** `CANCELLED`, `REFUNDED`

**Transitions:**
- `INIT` -> `PENDING`: Order placed (via Student Portal or Kiosk).
- `PENDING` -> `PREPARING`: KOT sent to Kitchen Display System (KDS), acknowledged by staff.
- `PREPARING` -> `READY`: Kitchen staff marks KOT as ready on KDS.
- `READY` -> `COLLECTED`: Student scans QR at counter, or staff manually marks collected.
- `PENDING` -> `CANCELLED`: User or staff cancels before preparation.
- `PREPARING`/`READY` -> `REFUNDED`: Exception handling (e.g., food unavailable, spill).

## 2. Payment State Machine (Wallet/Credits)
Ensures atomic deduction and prevents double-spending.

**States:** `INITIATED` -> `PROCESSING` -> `PAID`
**Failure States:** `FAILED`

**Transitions:**
- `INIT` -> `INITIATED`: Transaction Intent created in Firestore (Arch B mechanism).
- `INITIATED` -> `PROCESSING`: Cloud function acquires lock on user wallet.
- `PROCESSING` -> `PAID`: Wallet balance successfully decremented.
- `PROCESSING` -> `FAILED`: Insufficient balance, network timeout, or lock failure.

## 3. Inventory Reservation State Machine
Ensures stock is not oversold, especially critical during high-concurrency periods.

**States:** `AVAILABLE` -> `RESERVED` -> `DEDUCTED`
**Failure States:** `RELEASED`

**Transitions:**
- `AVAILABLE` -> `RESERVED`: Order `PENDING`, stock temporarily held.
- `RESERVED` -> `DEDUCTED`: Order moves to `PREPARING`, stock permanently removed.
- `RESERVED` -> `RELEASED`: Order `CANCELLED` or Payment `FAILED`.

## 4. Food Redemption State Machine
Validates physical collection against digital records.

**States:** `UNCLAIMED` -> `CLAIMED`
**Transitions:**
- `UNCLAIMED` -> `CLAIMED`: QR Code scanned successfully at Kiosk. (Atomic transition required to prevent double-scanning).
