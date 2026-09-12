# Patent Candidate Technical Inventory

*Disclaimer: This document identifies technical mechanisms that may be worth patent research. It does not make legal claims of patentability.*

## 1. Arch B: Transaction Intents & Fencing
**Problem Solved:** 
In high-concurrency offline/online environments (e.g., hundreds of students ordering simultaneously over flaky mobile networks), preventing double-spending and ensuring atomic wallet deduction without locking the entire database.

**Technical Mechanism:**
A three-phase transaction model using a dedicated `transaction_intents` collection.
1. Client generates a unique intent.
2. Cloud function picks up the intent, fences off duplicates using Firestore transactions, and executes the deduction.
3. Client listens for the resolved intent status.

**Inputs and Outputs:**
- **Inputs:** `intentId`, `userId`, `amount`, `orderPayload`
- **Outputs:** `status` (PAID/FAILED), mutated `Wallet`, generated `Order`

**Data/State Transitions:**
`INITIATED` (Client) -> `PROCESSING` (Cloud Lock) -> `COMPLETED`/`FAILED`

**Current Implementation Status:**
- Partially implemented. `firestore.rules` references `transaction_intents`.
- `processTransaction.ts` exists but needs end-to-end integration and rigorous race-condition testing.

**Missing V0 Implementation Required:**
- End-to-end flow from `student-portal` creating the intent, to a reliable Cloud Function processing it, and the `kiosk-counter` / KDS reacting to the confirmed order.
- Test cases proving prevention of concurrent double-spends.

## 2. Stateless Offline Kiosk Sync (Silent Print & Verification)
**Problem Solved:**
Kiosks processing high-volume physical fulfillment (printing tickets, verifying QR codes) often suffer from latency if relying purely on cloud round-trips for every action.

**Technical Mechanism:**
- Using Chrome's `--kiosk-printing` flag combined with optimistic local state updates.
- Kiosk acts as a trusted verifier; it reads a signed QR payload, optimistically prints the KOT/receipt, and lazily syncs the `CLAIMED` status to the cloud, queueing requests if offline.

**Inputs and Outputs:**
- **Inputs:** Signed QR Payload (UserId, OrderId, Timestamp).
- **Outputs:** Thermal Print Command, Sync Queue.

**Current Implementation Status:**
- Silent print is documented and functioning via Chrome flags.
- Offline queueing and optimistic verification are missing/unclear.

**Missing V0 Implementation Required:**
- Local storage sync queue for redemption statuses.
- Offline validation of JWT/signed QR codes to prevent forgery without cloud ping.
