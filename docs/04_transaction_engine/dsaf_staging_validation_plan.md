# DSAF Staging Validation Plan

This document serves as the official runbook and record template for live-staging validation of the MessFloww DSAF architecture.

**Purpose:** To verify that the reliability fixes and transaction orchestration logic perform correctly against live Firebase infrastructure (Firestore, RTDB, Cloud Functions, and Google Cloud Scheduler), including actual network latency and distributed state.

## Execution Requirements
1. **Target Environment:** A live Firebase staging project (e.g., `messfloww-staging`).
2. **Execution Method:** The `apps/admin-hq/functions/src/test/stagingValidationHarness.ts` script run locally with `GOOGLE_APPLICATION_CREDENTIALS` pointing to the staging service account.
3. **Pre-requisites:** The DSAF Cloud Functions (`securePlaceOrder`, `reconcileIncompleteIntents`) must be deployed to the staging project.

---

## Test Execution Records

### 1. Crash after Firestore debit before RTDB commit
- **Staging Project/Environment:**
- **Timestamp:**
- **intentId/orderId:**
- **Injected Failure Point:** Seeded intent in `FINANCIALLY_COMMITTED` state with `rtdbOrderDispatched = false`.
- **Expected Result:** Live cron reconciler attempts forward recovery. Order is dispatched to KDS, intent transitions to `COMMITTED`. If RTDB lease was expired, transitions to `CANCELLED` and student is refunded.
- **Actual Result:**
- **Relevant Firestore/RTDB Snapshots:**
- **Wallet Balance Before/After:**
- **Ledger Entries:**
- **Cloud Function and Scheduler Logs:**
- **Verdict:** [PASS | FAIL | INCONCLUSIVE]

### 2. Crash after RTDB commit before final Firestore state update
- **Staging Project/Environment:**
- **Timestamp:**
- **intentId/orderId:**
- **Injected Failure Point:** Seeded intent in `FINANCIALLY_COMMITTED` state, but RTDB `active_orders` already contains the order.
- **Expected Result:** Live cron reconciler detects missing local state but order exists in RTDB, completes the state transition to `COMMITTED` safely without duplicating the order.
- **Actual Result:**
- **Relevant Firestore/RTDB Snapshots:**
- **Wallet Balance Before/After:**
- **Ledger Entries:**
- **Cloud Function and Scheduler Logs:**
- **Verdict:** [PASS | FAIL | INCONCLUSIVE]

### 3. Concurrent reconciliation workers
- **Staging Project/Environment:**
- **Timestamp:**
- **intentId/orderId:**
- **Injected Failure Point:** Manual concurrent execution of `reconcileIntent` against the same stuck `FINANCIALLY_COMMITTED` intent.
- **Expected Result:** Exactly one worker executes recovery. The other worker aborts via the Idempotency Gate.
- **Actual Result:**
- **Relevant Firestore/RTDB Snapshots:**
- **Wallet Balance Before/After:**
- **Ledger Entries:**
- **Cloud Function and Scheduler Logs:**
- **Verdict:** [PASS | FAIL | INCONCLUSIVE]

### 4. Stale fencing-token commit rejection
- **Staging Project/Environment:**
- **Timestamp:**
- **intentId/orderId:**
- **Injected Failure Point:** Attempt to commit an RTDB lease with a mismatched token.
- **Expected Result:** RTDB live transaction rejects the write with `LEASE_FENCING_REVOKED`.
- **Actual Result:**
- **Relevant Firestore/RTDB Snapshots:**
- **Wallet Balance Before/After:**
- **Ledger Entries:**
- **Cloud Function and Scheduler Logs:**
- **Verdict:** [PASS | FAIL | INCONCLUSIVE]

### 5. Duplicate idempotency-key submission
- **Staging Project/Environment:**
- **Timestamp:**
- **intentId/orderId:**
- **Injected Failure Point:** Two concurrent calls to `securePlaceOrder` via client SDK using identical `idempotencyKey`.
- **Expected Result:** First call processes normally. Second call returns `409 Conflict` (if processing) or safely returns existing receipt (if complete). Wallet debited exactly once.
- **Actual Result:**
- **Relevant Firestore/RTDB Snapshots:**
- **Wallet Balance Before/After:**
- **Ledger Entries:**
- **Cloud Function and Scheduler Logs:**
- **Verdict:** [PASS | FAIL | INCONCLUSIVE]

### 6. Repeated refund attempts
- **Staging Project/Environment:**
- **Timestamp:**
- **intentId/orderId:**
- **Injected Failure Point:** Concurrent calls to `refundStudentWallet` against the live database for a single cancelled intent.
- **Expected Result:** Exactly one successful `REFUNDED` response. Others return `ALREADY_REFUNDED`. Exactly one `refund_{intentId}` ledger entry is created.
- **Actual Result:**
- **Relevant Firestore/RTDB Snapshots:**
- **Wallet Balance Before/After:**
- **Ledger Entries:**
- **Cloud Function and Scheduler Logs:**
- **Verdict:** [PASS | FAIL | INCONCLUSIVE]

### 7. Scheduled reconciler execution
- **Staging Project/Environment:**
- **Timestamp:**
- **intentId/orderId:**
- **Injected Failure Point:** N/A (Observation test).
- **Expected Result:** The `reconcileIncompleteIntents` function executes automatically every 1 minute as visible in GCP Logs Explorer.
- **Actual Result:**
- **Relevant Firestore/RTDB Snapshots:**
- **Wallet Balance Before/After:**
- **Ledger Entries:**
- **Cloud Function and Scheduler Logs:**
- **Verdict:** [PASS | FAIL | INCONCLUSIVE]

### 8. Scheduler and Firebase permission failure visibility
- **Staging Project/Environment:**
- **Timestamp:**
- **intentId/orderId:**
- **Injected Failure Point:** Simulate permission error or observe initial deployment logs.
- **Expected Result:** The service account executing the cron job has appropriate `Cloud Datastore User` and `Firebase Admin` roles. Any permission failures are explicitly captured in GCP Error Reporting.
- **Actual Result:**
- **Relevant Firestore/RTDB Snapshots:**
- **Wallet Balance Before/After:**
- **Ledger Entries:**
- **Cloud Function and Scheduler Logs:**
- **Verdict:** [PASS | FAIL | INCONCLUSIVE]
