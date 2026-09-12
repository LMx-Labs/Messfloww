# Implementation Gap Report

This document identifies the highest-priority gaps between the current repository state and the required Phase 1 architecture.

## 1. Missing `messId` (Critical Blocker)
**Gap:** The current domain models (`types.ts`), Firestore collections, and frontend applications do not enforce `messId`. All data currently assumes a single, global mess operation.
**Impact:** A secondary mess (e.g., a distinct Night Mess location) cannot operate without mixing its orders, inventory, and ledger with the primary mess.
**Action Required:**
- Update all interfaces in `packages/shared-core/src/types.ts` to require `messId`.
- Update `firestore.rules` to enforce `messId` matching the user's assigned mess role.
- Update `admin-hq` and `kiosk-counter` to select or inject `messId` into all queries and mutations.

## 2. Operation Modes Lack Explicit Enforcement
**Gap:** The system supports general orders, but does not strictly differentiate validation logic between `PAID_DAY` (wallet required) and `NIGHT` (UPI/Cash primary).
**Impact:** Kiosk operators could mistakenly process wallet transactions during Night Mess, or vice versa, causing accounting nightmares.
**Action Required:**
- Introduce `operationMode` in `Mess` configuration.
- Enforce payment method restrictions based on the active `operationMode`.

## 3. Arch B (Transaction Intents) is Not End-to-End
**Gap:** `transaction_intents` are referenced in rules, and some backend processing exists, but the Student App does not fully utilize this flow to guarantee safety against network drops or double-spends.
**Impact:** High concurrency could result in overselling inventory or double-charging wallets if relying solely on client-side state.
**Action Required:**
- Implement the V0 Validation Plan for Arch B.
- Wire the Student Portal checkout button to create an intent rather than directly mutating the order.

## 4. Kiosk Offline / Reconciliation Workflows
**Gap:** If the kiosk loses internet during a `NIGHT` mess, it cannot record cash orders or sync redemptions.
**Impact:** Operations halt or data is lost.
**Action Required:**
- Implement basic local queueing in the `kiosk-counter` PWA to cache actions and flush them upon reconnection.

## Recommended Implementation Order for Phase 1
1. **Schema Refactor**: Add `messId` to all models and mock multiple messes in the database.
2. **Security Update**: Update Firestore rules for `messId` isolation.
3. **App Updates**: Update `admin-hq`, `kiosk-counter`, and `inventory-kitchen` to filter by `messId`.
4. **Operation Modes**: Introduce `PAID_DAY` and `NIGHT` toggles and payment restrictions.
5. **Arch B Finalization**: Complete the `TransactionIntent` flow for robust wallet payments.
6. **Testing**: Run concurrency and isolation tests before any live pilot.
