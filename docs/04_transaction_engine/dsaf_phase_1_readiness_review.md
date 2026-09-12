# DSAF Phase 1 Production-Readiness Review

This review assesses the readiness of the Distributed Saga with Atomic Fencing (DSAF) architecture for the MessFloww Phase 1 launch. It evaluates 12 critical reliability and security domains based on empirical evidence from the repository, avoiding unverified claims of production readiness.

> **Date:** September 2026
> **Scope:** Phase 1 (Wallet payments, strict isolation, no external XA)

---

## 1. Refund Idempotency
- **Status:** VERIFIED BY TEST (MOCK ENVIRONMENT)
- **Evidence:** `apps/admin-hq/functions/src/index.ts` (lines ~278+) implements `refundStudentWallet` which reads the live `TransactionIntentDocument` inside a Firestore transaction. If the state is `CANCELLED`, it immediately returns `ALREADY_REFUNDED`.
- **Test Coverage:** `T1`, `T2`, `T4` in `dsafReliabilityTests.ts` confirm correct state transition and blocking of duplicate credits in the local memory mock.

## 2. Concurrent Refund Attempts
- **Status:** VERIFIED BY TEST (MOCK ENVIRONMENT)
- **Evidence:** The refund logic uses `runTransaction`. Concurrency is handled correctly. Furthermore, it writes a deterministic ledger entry ID (`refund_${intentId}`).
- **Test Coverage:** `T3` in `dsafReliabilityTests.ts` fires simultaneous refund attempts in the local memory mock. Exactly one succeeds while the other is rejected. (Mock limitation noted in test, but logical invariants hold).

## 3. Reconciliation Idempotency
- **Status:** VERIFIED BY TEST (MOCK ENVIRONMENT)
- **Evidence:** `reconcileIntent` re-reads the live intent snapshot from Firestore upon invocation. If the state is `COMMITTED`, `CANCELLED`, or `FAILED`, it safely acts as a no-op.
- **Test Coverage:** `T8`, `T10` in `dsafReliabilityTests.ts` prove repeated sweeps do not duplicate forward recovery or trigger duplicate backward compensation in the local memory mock.

## 4. Scheduled Cloud Function Configuration
- **Status:** VERIFIED IN CODE
- **Evidence:** `reconcileIncompleteIntents` is correctly exported in `apps/admin-hq/functions/src/index.ts` using `onSchedule('every 1 minutes', ...)`.
- **Remaining Risk:** While configured correctly, Google Cloud Scheduler permissions and billing must be active on the target project for the cron to fire in production.
- **Validation Required:** Monitor GCP logs post-deployment to ensure the cron executes.

## 5. Firestore Transaction Atomicity
- **Status:** VERIFIED IN CODE
- **Evidence:** Wallet debiting and intent state transition to `FINANCIALLY_COMMITTED` are wrapped in `db.runTransaction` (`index.ts`). The refund compensation is similarly wrapped in its own atomic transaction block.
- **Risk:** Firestore transactions have a 10 MiB limit and 500 document write limit, which this single-document wallet update is safely orders of magnitude below.

## 6. RTDB Fencing-Token Validation
- **Status:** VERIFIED BY TEST (MOCK ENVIRONMENT)
- **Evidence:** `commitRtdbLeases` uses an RTDB `transaction()` block that strictly aborts (`return undefined;`) if `lease.fenceToken !== fenceToken`.
- **Test Coverage:** `T7` in `dsafReliabilityTests.ts` confirms that a stale or revoked token correctly rejects the commit in the local memory mock.

## 7. Idempotency-Key Generation and Persistence
- **Status:** VERIFIED IN CODE
- **Evidence:** Client-side generation is anchored in React state in `apps/student-portal/src/features/ordering/CartScreen.tsx`: `const [idempotencyKey] = useState<string>(() => crypto.randomUUID(...))`.
- **Mechanism:** The key survives component re-renders (like rapid double-clicks) but correctly resets if the user navigates away and builds a completely new cart. It is passed securely to the backend.

## 8. Wallet Ledger Consistency
- **Status:** VERIFIED BY TEST (MOCK ENVIRONMENT)
- **Evidence:** Both debit and refund actions write an immutable record to the `ledger` collection inside the atomic `runTransaction` blocks.
- **Test Coverage:** `T1.4`, `T2.4`, `T3.3` confirm that no duplicate refund ledger records are generated in the local memory mock.

## 9. Recovery After Coordinator Crashes
- **Status:** REQUIRES STAGING VALIDATION
- **Evidence:** Code logically supports it (via `reconcileIntent`), and `T5` / `T6` verify the recovery logic deterministically in memory.
- **Risk:** Emulating a hard process crash (OOM, preempted instance) during the microsecond gap between Firestore debit and RTDB commit requires live environment testing.
- **Validation Required:** Execute `adversarialBreakTest.ts` against the live staging Firebase project.

## 10. Security Rules and Authorization Boundaries
- **Status:** VERIFIED IN CODE
- **Evidence:**
  - `firestore.rules`: Clients can `read` their own `transaction_intents` but writes are restricted to `isStaff()`. `securePlaceOrder` runs on the backend (Admin SDK), correctly bypassing rules.
  - `database.rules.json`: `active_orders` and `menu_stock` are `.write: false` for clients.
- **Risk:** Client-side attack surface is closed. However, any leak of the `GOOGLE_APPLICATION_CREDENTIALS` (Service Account) would allow arbitrary ledger and intent manipulation bypassing these rules. Staging and production credentials must be strictly isolated.

## 11. Logging and Auditability
- **Status:** VERIFIED IN CODE
- **Evidence:** `functions.logger.info`, `warn`, and `error` are extensively used in `securePlaceOrder`, `refundStudentWallet`, and `reconcileIntent`. Critical events (fencing failures, recoveries) are logged with context (intentId, orderId).
- **Risk:** GCP Cloud Logging retention limits (default 30 days) apply. For permanent auditability, the Firestore journal and ledger are the primary source of truth.

## 12. Test Coverage and Limitations
- **Status:** VERIFIED BY TEST (MOCK ENVIRONMENT)
- **Evidence:** `dsafReliabilityTests.ts` executes successfully via `ts-node` (29/29 assertions pass).
- **Limitation:** Tests utilize an in-memory mock for Firestore and RTDB. The mock accurately tests logical paths but does not replicate true distributed network latency, live Google Cloud Scheduler timing, or Firebase SDK network failures. Live staging validation is required.

---

## Final Verdict for Phase 1
The transactional engine is logically sound, successfully tested for idempotency, securely locked down via rules, and architecturally resilient. 

**Next Steps before Production Traffic:**
1. Deploy to staging.
2. Run the Staging Validation Harness against the live staging project.
3. Validate cron trigger execution in the staging GCP console.

---

## Phase 1 Staging Validation (September 2026)

*This section will be populated once the `stagingValidationHarness.ts` script is executed against the live Firebase staging environment and the results documented in `dsaf_staging_validation_plan.md`.*

- [ ] Execute `stagingValidationHarness.ts` Test 1 & 2
- [ ] Execute Test 3 (Concurrent reconciliation)
- [ ] Execute Test 4 (Stale fencing-token)
- [ ] Execute Test 5 (Duplicate idempotency-key)
- [ ] Execute Test 6 (Repeated refund attempts)
- [ ] Execute Test 7 (Scheduled reconciler execution)
- [ ] Execute Test 8 (Scheduler and Firebase permission visibility)

*Final readiness for production cannot be claimed until all critical scenarios pass in the live staging environment.*
