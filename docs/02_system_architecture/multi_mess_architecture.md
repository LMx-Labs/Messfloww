# Multi-Mess Architecture

## Overview
To support multiple mess halls operating independently within the same infrastructure, a strict tenant isolation model based on `messId` is required. This applies across all data, configurations, and operational queues.

## 1. Tenant Isolation via `messId`
Every transactional and configuration document MUST include a `messId` property. This includes:
- **Orders & KOTs**: Routes orders to the correct Kitchen Display System (KDS).
- **Inventory & Menus**: Ensures each mess has its own stock and offerings.
- **Transactions & Ledgers**: Tracks revenue and wallet deductions per mess.
- **Users/Roles**: Defines staff (Managers, Kiosk Operators, Kitchen Staff) per mess.

## 2. Mess-Specific Configuration
Each mess will have a configuration document detailing:
- `messId` (e.g., `MESS_MAIN`, `MESS_SPECIAL`, `MESS_NIGHT`)
- Supported Operation Modes (e.g., `PAID_DAY`, `NIGHT`)
- Active Time Slots
- Staff Assignments

## 3. Operation Modes
- **PAID_DAY**: Typical daytime operations where students use wallet balances. Requires tight inventory and wallet locking.
- **NIGHT**: Late-night operations accepting cash/UPI. Wallet payments might be disabled. Focus is on KOT generation and collection speed.

## 4. Wallet Boundaries
While a student has a single global wallet balance, every deduction must explicitly log the `messId` where the spend occurred. This is crucial for cross-mess reconciliation and accounting.

## 5. Kitchen Queues (KDS)
The Kitchen application (`inventory-kitchen`) must filter KOTs strictly by `messId`.
- An order placed at `MESS_A` must never appear on the KDS of `MESS_B`.
- Real-time listeners (Firestore `onSnapshot`) must include `.where('messId', '==', currentMessId)`.

## 6. Indexes and Query Performance
Firestore composite indexes must be updated to prefix `messId` for all major queries:
- `orders`: `messId` + `status` + `createdAt`
- `inventory`: `messId` + `category`
- `ledger`: `messId` + `timestamp`

## 7. Security Requirements (Firestore Rules)
Firestore rules must be updated to validate `messId`.
- Staff can only write to collections matching their assigned `messId`.
- Order creation must explicitly pass the `messId` validated against the active menu/kiosk context.
