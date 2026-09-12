# DSAF Implementation Gap Analysis

This document evaluates the existing MessFloww codebase against the 10 mechanisms of the proposed **Distributed Saga with Atomic Fencing (DSAF)** transaction architecture.

| Mechanism | Existing Implementation Location | Current Behaviour | Missing Components | Technical Risks | Status | Minimum Changes for V0 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Durable Firestore transaction intent / write-ahead log** | `apps/admin-hq/functions/src/index.ts` (`securePlaceOrder`) | Creates `TransactionIntentDocument` with state `INITIALIZED` before taking any remote actions. | None | Network failure before intent creation drops the request, which is acceptable. | **Implemented** | None |
| **2. RTDB inventory reservation with expiration** | `apps/admin-hq/functions/src/index.ts` (`acquireRtdbLeases`) | Writes `activeLeases[intentId]` with `expiresAt` payload under `menu_stock`. | None | None | **Implemented** | None |
| **3. Optimistic concurrency control** | `apps/admin-hq/functions/src/index.ts` (`acquireRtdbLeases`) | RTDB `transaction()` block ensures stock is decremented atomically only if `stock >= qty`. | None | High concurrency may cause transaction retries, increasing latency. | **Implemented** | None |
| **4. Mirrored fencing tokens** | `apps/admin-hq/functions/src/index.ts` (`acquireRtdbLeases`) | Generates `${intentId}-${nowMs}-${randomUUID}` and saves it in both RTDB lease and Firestore Journal. | None | None | **Implemented** | None |
| **5. Guarded fenced commit** | `apps/admin-hq/functions/src/index.ts` (`commitRtdbLeases`) | Verifies `lease.fenceToken === fenceToken` before transitioning stock to committed state. | None | Clock skew between services could affect TTL, but fence tokens mitigate unauthorized claims. | **Implemented** | None |
| **6. Automatic cross-store compensation or financial restitution** | `apps/admin-hq/functions/src/index.ts` (`refundStudentWallet`) | Automatically credits the wallet back and logs a refund to the ledger if RTDB dispatch fails after debit. | None | Failure of the refund transaction itself could lead to money loss without background recovery. | **Implemented** | None |
| **7. Idempotency-key-based duplicate prevention** | `apps/admin-hq/functions/src/index.ts` (`securePlaceOrder`) | Uses `idempotencyKey` as the `intentId`. Firestore `create()` fails on duplicate, triggering replay logic. | Client-side generation and passing of `idempotencyKey` needs verification across all apps. | Client reusing keys maliciously, handled by matching user/cart payloads. | **Partial** | Ensure `student-portal` sends UUID idempotency key. |
| **8. Inline expired-lease reclamation** | `apps/admin-hq/functions/src/index.ts` (`acquireRtdbLeases`) | Scans and deletes expired leases inline during new reservation transactions. | None | None | **Implemented** | None |
| **9. Background reconciliation and recovery** | `apps/admin-hq/functions/src/index.ts` (`reconcileIntent`) | The `reconcileIntent` function exists to repair half-committed states based on the journal bitmask. | A scheduled cron job (`onSchedule`) to query stuck intents and trigger `reconcileIntent`. | Without the cron job, stuck intents rely on manual intervention. | **Partial** | Create an hourly/minutely Cloud Function cron job to execute `reconcileIntent` on stuck intents. |
| **10. Immutable transaction audit records** | `apps/admin-hq/functions/src/index.ts` (`securePlaceOrder`) | Appends `purchase` or `refund` records to the `ledger` collection. | None | None | **Implemented** | None |

## Conclusion
The DSAF architecture is largely implemented at the Cloud Function level (`securePlaceOrder`). The primary gaps for V0 are:
1. Wiring the background cron job to actively sweep and trigger `reconcileIntent` for crash-recovery.
2. Ensuring the frontend applications generate and send robust idempotency keys.
