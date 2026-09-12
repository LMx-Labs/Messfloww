# V0 Evidence and Validation Plan

## Goal
To implement and document the minimum viable code required to demonstrate the technical mechanisms outlined in the patent candidate inventory, specifically the **Transaction Intents (Arch B)**.

## 1. Required Minimum Implementation
- **Student App**: UI and logic to generate a `TransactionIntent` document with a unique idempotency key when placing an order via Wallet.
- **Cloud Function (`processTransaction`)**: 
  - Listens to new `transaction_intents`.
  - Runs a Firestore Transaction to:
    1. Read the user's wallet.
    2. Read inventory (ensure stock available).
    3. Deduct balance and inventory.
    4. Create the `Order`.
    5. Update Intent status to `COMPLETED`.
- **Kiosk / KDS**: Real-time listener that instantly displays the generated `Order` once the Cloud Function completes.

## 2. Validation Test Cases
1. **Concurrent Request Test (Double Spend Prevention)**:
   - Simulate two simultaneous requests from the same user creating two intents for an item when they only have enough balance for one.
   - *Expected Result*: One intent succeeds, the other fails with "Insufficient Balance". Only one order is created.
2. **Network Dropout Test**:
   - Client creates intent and immediately drops connection.
   - *Expected Result*: Cloud function processes it. When client reconnects, it reads the `COMPLETED` intent and shows the success screen.
3. **Inventory Race Condition Test**:
   - 5 users simultaneously try to buy the last 2 items in stock.
   - *Expected Result*: Exactly 2 succeed, 3 fail with "Out of Stock", balances correctly managed.

## 3. Required Documentation & Artifacts (Post-Implementation)
- **Architecture Diagrams**: Data flow from Client -> Intent -> Function -> Order -> KDS.
- **Database Schemas**: Final JSON schema for `transaction_intents`, `orders`, `wallet`.
- **Sequence Diagrams**: Timing of the concurrent request test.
- **Audit Logs**: Raw Firestore emulator logs proving the atomic lock behavior.
