# 06 — Technical Spine and Control-Loop Analysis
# Core Data Flows and Pipeline Deconstruction

> **Objective**: Deconstruct MessFloww into its pure technical pipelines, stripped of all business, generic CRUD, and UI presentation layers, to evaluate true control loops and data lifecycles.
> **Inputs**: `01` through `05` audited documents.

---

## Phase 1 — Stripped Layers

The following layers are explicitly excluded from this analysis as they are standard software engineering and lack distinct technical mechanisms:
- All React UI rendering (buttons, modals, toasts, CSS).
- Ordinary Firestore CRUD (registering messes, adding users, updating profiles).
- The concept of a "Wallet" (technically, it's just an integer field in a document).
- Email notifications.
- The business context of a "Campus Mess".

---

## Phase 2 — Technical Pipeline Reconstruction

### Pipeline 1: Distributed Atomic Order & Stock Depletion

```text
INPUT
Client request containing item IDs, quantities, user ID.
↓
DATA TRANSFORMATION
Map client items to server-side cached prices to calculate `serverTotal`. (M02)
↓
COMPUTATION
Read Firestore identity/balance. Compute new balance. (M05 Phase 1)
Iterate items: sequentially attempt RTDB `runTransaction` to decrement stock. (M03)
↓
DECISION
If any RTDB transaction fails → rollback all successful decrements using `stockReverts[]`.
If all RTDB transactions succeed AND Firestore balance is sufficient → commit.
↓
AUTOMATED ACTION
Write RTDB `active_orders/{id}`. (M05 Phase 2/3)
Deduct Firestore balance. (M05 Phase 3)
↓
SYSTEM STATE CHANGE
Global physical stock decreases. Global financial ledger decreases.
↓
OBSERVATION
[NOT DOCUMENTED] - No secondary system actively observes the ledger for automated action.
↓
FEEDBACK
If stock falls below `minStock`, transaction automatically flags item `available=false`, feeding into Pipeline 3 (Live Menu). (M04)
```

### Pipeline 2: Transport-Layer System Halt (Kill-Switch)

```text
INPUT
Firebase socket heartbeat failure / TCP closure. (M01)
↓
DATA TRANSFORMATION
Firebase infrastructure translates socket close to an internal trigger.
↓
COMPUTATION
[NOT APPLICABLE] - Pure state mutation.
↓
DECISION
[NOT APPLICABLE] - Unconditional execution upon disconnect.
↓
AUTOMATED ACTION
Server executes pre-registered `onDisconnect().set(false)`.
↓
SYSTEM STATE CHANGE
RTDB `system_status/admin_online` becomes `false`.
↓
OBSERVATION
Cloud Functions observe flag during request preconditions. Client UI observes via WebSocket listener.
↓
FEEDBACK
All order entry pipelines are halted globally until TCP connection is re-established.
```

### Pipeline 3: Live Menu Fan-in Merge

```text
INPUT
Firestore `menu` updates OR RTDB `menu_stock` updates. (M17)
↓
DATA TRANSFORMATION
Extract canonical metadata from Firestore. Extract live counts/availability from RTDB.
↓
COMPUTATION
Iterate over Firestore array; overwrite `stock`, `minStock`, and `available` properties with RTDB values.
↓
DECISION
[NOT APPLICABLE] - Pure structural merge.
↓
AUTOMATED ACTION
Push merged payload to subscribing clients.
↓
SYSTEM STATE CHANGE
Client-side state synchronized with dual-database backend.
↓
OBSERVATION
Client UI re-renders item availability.
↓
FEEDBACK
[NOT DOCUMENTED] - UI does not automatically trigger backend changes based on this merge.
```

### Pipeline 4: Automated Chronological Deadlock Resolution

```text
INPUT
System clock (5-minute intervals). (M09)
↓
DATA TRANSFORMATION
Fetch RTDB `active_orders`. Filter by `paymentStatus === PENDING` and `createdAt < Date.now() - 900000`.
↓
COMPUTATION
Iterate stale orders. Construct compensating stock increments.
↓
DECISION
Are there matching stale orders?
↓
AUTOMATED ACTION
Execute RTDB `runTransaction` stock increments. Write Firestore `historical_orders`. Delete RTDB `active_orders`.
↓
SYSTEM STATE CHANGE
Stale physical locks are released. Order state is archived.
↓
OBSERVATION
Pipeline 3 (Live Menu) observes RTDB stock increases.
↓
FEEDBACK
Stock increment may push stock above `minStock`, automatically re-enabling item availability.
```

---

## Phase 3 — Control-Loop Test

A real control loop requires: (1) observed input, (2) processing, (3) decision, (4) changed system behaviour, (5) observable resulting state, (6) subsequent influence on decisions.

**Does MessFloww have true control loops?**

Yes, one complete control loop exists: **The Stock Availability Loop**.
1. **Observed input**: Student places order (decrements stock).
2. **Processing**: System calculates remaining stock.
3. **Decision**: Is stock <= minStock? (M04).
4. **Changed behaviour**: System flags `available = false`.
5. **Observable state**: Pipeline 3 merges this false flag.
6. **Subsequent influence**: Client UI disables ordering for that item, preventing further load on the RTDB transaction queue for an exhausted item.
*Note: Pipeline 4 (Chron-sweep) acts as a secondary actuator for this loop, periodically releasing deadlocked stock, which reverses the decision and re-enables ordering.*

---

## Phase 4 — Temporal Analysis

- **Real-Time**: Pipeline 2 (Kill-Switch TCP disconnect), Pipeline 3 (Live Menu merge via push WebSockets).
- **Batch**: None.
- **Periodic**: Pipeline 4 (Chronological Deadlock Resolution - runs every 5 minutes).
- **Event-Triggered**: Pipeline 1 (Order Placement - triggered by HTTP request).
- **Predictive**: NONE. (M06 wait-time is deterministic event-triggered arithmetic).
- **Retrospective**: M30 Dashboard metrics (queries historical data).

---

## Phase 5 — Data Lifecycle

**Primary Order Data Object:**
`COLLECT` (Client constructs Cart) → 
`STORE` (Persisted locally via IndexedDB M18) → 
`TRANSFORM` (Split into dual payloads: Firestore ledger + RTDB active_orders M05) → 
`ANALYSE` (Price anti-spoofing check M02) → 
`DECIDE` (Stock OCC transaction commit M03) → 
`ACT` (Deduct wallet, lock stock, route to KOT queue M11) → 
`OBSERVE` (Kitchen display via RTDB listener M33).

---

## Phase 6 — Technical Constraints

Documented constraints shaping the architecture:
- **Distributed DB Constraints**: Firestore lacks high-frequency low-latency throughput for live inventory; RTDB lacks rich querying and ACID persistence for financial ledgers. This forces the dual-database architecture (M05).
- **Concurrency**: High density of students ordering at exactly meal-time requires OCC (runTransaction) rather than pessimistic locks for stock (M03).
- **Physical Integration Constraints**: KOT printers lack cloud connectivity and Windows prevents silent browser printing, forcing the local Python Flask fallback chain (M12).
- **Hardware Limitations**: Unreliable administrative networks require the TCP-level kill-switch (M01).

---

## Phase 7 — Technical Interaction

**A + B Effect:** M03 (OCC Stock Decrement) + M09 (Stale Auto-Cancel)
- *Interaction*: M03 aggressively locks stock to prevent overselling in high-concurrency environments. However, aggressive locking combined with physical UPI verification creates a vulnerability to denial-of-service (students holding stock without paying). M09 specifically exists to resolve the vulnerability created by M03 in the physical domain. The technical effect is an elastic inventory system that is strictly consistent at T=0, but eventually consistent at T=15m if human verification fails.

---

### Technical Spine 1: The Dual-Database Orchestrator
The synchronous pipeline that bridges Firestore document ledgers and RTDB realtime nodes using sequenced optimistic concurrency and compensating rollbacks to guarantee atomic execution of a multi-domain transaction.

### Technical Spine 2: The Physical Deadlock Resolver
The chronological sweep pipeline that monitors for human-in-loop verification failures (abandoned physical payments) and automatically reverses distributed database state (reverting stock, archiving records) to maintain physical inventory fluidity.

### Technical Spine 3: The Transport-Layer Safety Valve
The pre-registered socket hook that bypasses application-layer polling to instantly shut down distributed system write operations globally upon physical network loss.

---

### What remains technically distinctive if ordinary food ordering, payment, UI, wallet, menus and notifications are removed?

If you strip away the generic concept of buying food with a digital wallet, what remains is:
1. **A cross-database transaction orchestrator** handling concurrent inventory depletion against an immutable financial ledger using sequenced optimistic concurrency and compensating rollback arrays.
2. **A physical deadlock resolution engine** using chronological polling to garbage-collect unverified physical state transitions and revert locked inventory.
3. **A transport-layer distributed lock** using socket disconnection to globally freeze application state.

These three spines are the only remaining candidates for technical differentiation.
