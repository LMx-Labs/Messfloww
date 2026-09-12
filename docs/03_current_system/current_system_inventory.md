# Current System Inventory

## 1. Applications (`apps/`)
- **`admin-hq`**: The headquarters application for Mess Managers and System Admins. Handles configuration, menu management, and oversight. (Status: Partially Implemented, lacking robust `messId` multi-tenancy).
- **`inventory-kitchen`**: The Kitchen Display System (KDS) used by kitchen staff to monitor orders (KOTs) and mark them as ready. (Status: Implemented, handles status transitions).
- **`kiosk-counter`**: The Point of Sale (POS) and redemption kiosk. Operates in silent-print mode. Handles direct orders and student QR redemption. (Status: Implemented, needs `messId` context enforcement).
- **`student-portal`**: The mobile-first web app for students to check balances, place orders (if applicable), and generate QR codes for redemption. (Status: Implemented).

## 2. Packages (`packages/`)
- **`shared-core`**: Contains shared types, Firebase configuration, and core utilities.
    - `types.ts`: Defines data models (`Order`, `Student`, `UserProfile`, `InventoryItem`). (Status: Lacks `messId` property on core entities).
    - `transactions/processTransaction.ts`: Logic for processing transactions securely. (Status: Initial implementation of secure state transitions).

## 3. Backend & Security (`firebase.json`, `firestore.rules`)
- **Hosting**: 4 distinct targets mapped to the apps above.
- **Firestore Rules**: 
    - Collections: `users`, `students`, `registered_students`, `ledger`, `historical_orders`, `menu`, `settings`, `timeSlots`, `app_config`, `orderCounters`, `orders`, `transaction_intents`.
    - Authorization is primarily role-based (`isStaff()`, `isAuth()`).
    - (Status: Misses tenant isolation via `messId`).

## 4. Feature Implementation Status

### Missing (Required for Phase 1)
- Multi-mess architecture with strict `messId` isolation.
- Phase 1 specific Operation Modes (`PAID_DAY`, `NIGHT`).

### Partially Implemented
- Wallet transactions (deductions occur, but robust atomic locks via `transaction_intents` need end-to-end validation).
- Inventory decrements (stock tracking exists but concurrent reservation needs hardening).

### Already Implemented
- Basic user authentication and profiles.
- Role-based access control (Admin vs Student).
- Kitchen Display System (KDS) order states (Pending -> Preparing -> Ready -> Collected).
- Kiosk thermal printing setup.
- Basic menu management.

### Proposed Patent Candidate
- **Transaction Intents (Arch B)**: Mechanism to handle distributed transactional consistency across POS/Student App and Cloud without double-spending, especially robust for flaky network conditions. (Identified in `docs/` and `firestore.rules` as `transaction_intents`).
