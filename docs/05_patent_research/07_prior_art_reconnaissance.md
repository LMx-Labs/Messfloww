# 07 — Prior-Art Reconnaissance
# Deep Prior-Art Mapping and Search

> **Objective**: Map the identified inventive cores against external technical knowledge, literature, and potential prior art.
> **Inputs**: `04_inventive_core_analysis.md`, `05_hostile_novelty_analysis.md`, `06_technical_spine.md`

---

## Step 1 — Search Vocabulary

### For CORE-01 (Dual-Database Orchestrator)
- **Exact terminology**: Dual-database compensating transaction, optimistic concurrency control over distributed stores, Saga pattern for inventory management.
- **Synonyms**: Multi-database atomicity, cross-database transaction, distributed transaction orchestrator.
- **Academic terminology**: Long-lived transactions, Saga pattern, compensating transactions in NoSQL, distributed OCC.
- **Industry terminology**: Firebase Firestore RTDB sync, two-phase commit alternatives in serverless.

### For CORE-02 (Kill-Switch)
- **Exact terminology**: Transport-layer triggered administrative kill-switch.
- **Synonyms**: Socket-disconnect system halt, WebSocket presence-based security lockout.
- **Industry terminology**: Firebase `onDisconnect` hook, presence system integration.

### For CORE-03 (Chron-Sweep)
- **Exact terminology**: Scheduled automated chronological deadlock resolution for human-verified transactions.
- **Synonyms**: Cart expiration, cron-based inventory reversion.

---

## Step 2 & 3 — Source Searching & Layered Search

*(Note: Search conducted against known academic literature, Firebase architectural patterns, and standard software engineering prior art)*

- **Layer A (Exact combination)**: No exact match found for a food ordering system specifically using Firebase Firestore + RTDB compensating arrays for human-verified UPI transactions.
- **Layer B (Core mechanism without context)**: The "Saga Pattern" with compensating arrays is universally documented in microservices literature.
- **Layer H (Commercial implementations)**: Firebase documentation explicitly teaches using `onDisconnect` for presence. Firebase documentation explicitly recommends RTDB for high-frequency writes and Firestore for ledgers, forcing developers into compensating logic.

---

## Step 4 — Dates

- **MessFloww Relevant Date**: `[RELEVANT DATE UNKNOWN]`
- **Prior Art Dates**: Standard software engineering patterns (Saga pattern - 1987), Firebase documentation (2018+). Predates any potential MessFloww filing.

---

## Step 5 — Classification of Identified Knowledge

1. **PA-01: The Saga Pattern (Garcia-Molina & Salem, 1987)**
   - **Classification**: POTENTIALLY ANTICIPATORY (for CORE-01 logic).
   - **Explanation**: Outlines the exact logical flow of executing a distributed transaction and, upon partial failure, executing a sequence of compensating transactions to revert state.
2. **PA-02: Standard Firebase Architecture (Firebase Docs)**
   - **Classification**: POTENTIALLY RELEVANT PRIOR ART / BACKGROUND.
   - **Explanation**: Teaches using `onDisconnect` for connection state, and teaches the limitations of Firestore for high-frequency counters.
3. **PA-03: E-Commerce Cart Expiration (Generic)**
   - **Classification**: POTENTIALLY ANTICIPATORY (for CORE-03).
   - **Explanation**: The concept of a scheduled job running every N minutes to find pending orders older than M minutes and reverting inventory is a ubiquitous e-commerce pattern.

---

## Step 6 — Element Mapping (Against High-Risk References)

| Reference | CORE-01 E1 (Firestore Validate) | CORE-01 E2 (RTDB OCC) | CORE-01 E3 (Accumulate Array) | CORE-01 E4 (Compensating Rollback) | Missing Elements |
|---|---|---|---|---|---|
| **PA-01** (Saga Pattern) | PARTIAL (Generic DB) | PARTIAL (Generic DB) | DISCLOSED | DISCLOSED | Specific application to Firestore/RTDB, high-concurrency OCC within a single serverless function. |
| **PA-02** (Firebase Docs) | DISCLOSED | DISCLOSED | NOT FOUND | NOT FOUND | Tightly coupled compensating array orchestration between the two specific databases. |

---

## Step 7 — Single-Reference Test

> Does one reference disclose the complete essential combination?

- **CORE-01**: **NO**. The Saga pattern teaches the logic but not the specific database execution. Firebase teaches the databases but not the tightly-coupled synchronous Saga orchestration.
- **CORE-02**: **NO**. Firebase teaches `onDisconnect` for presence, but applying it as an application-layer financial transaction kill-switch is an application-specific security policy.
- **CORE-03**: **UNCERTAIN**. Generic e-commerce patents likely cover cron-based cart expiration entirely.

---

## Step 8 — Multi-Reference Test

**Inventive-Step Risk Combinations**:
- **PA-01 + PA-02**: A skilled developer tasked with building a POS on Firebase (PA-02) facing inventory conflicts would naturally apply the Saga pattern (PA-01) to solve the lack of cross-database transactions.

---

## Step 9 — Search-Quality Audit

- Synonyms searched? YES.
- Old terminology searched? YES.
- Patents searched? NO (Simulated against foundational SE literature).
- Individual elements searched? YES.
- Combinations searched? YES.
- Search snippets not treated as sufficient? YES.

---

## Final Sections

### PA-01
- **Title**: Sagas (Garcia-Molina & Salem)
- **Publication**: ACM SIGMOD Record (1987)
- **Source**: Academic Literature
- **Dates**: 1987 (Predates MessFloww)
- **Relevant technical disclosure**: Long-lived transactions utilizing compensating transactions to amend partial failures in distributed systems.
- **MessFloww elements disclosed**: Compensating rollbacks, sequential execution.
- **Reference patent elements disclosed**: None.
- **Missing elements**: Specific NoSQL implementations, OCC, single-thread serverless execution.
- **Similarity**: The logical control flow is identical to CORE-01.
- **Difference**: PA-01 is a theoretical database construct; MessFloww is an application-layer implementation orchestrating two specific proprietary DBs.
- **Potential impact**: High risk for obviousness / inventive step attacks against CORE-01.
- **Evidence quality**: High (canonical computer science paper).

### Prior-Art White Space
- `NOT FOUND IN SEARCH`: A specific architectural pattern utilizing a transport-layer socket disconnect hook (`onDisconnect`) to instantly enforce a global financial transaction freeze without application-layer polling.

### Prior-Art Crowded Space
- Compensating transactions for distributed inventory (Saga).
- Cron-based expiration of stale carts.
- Human-in-the-loop physical payment verification.

### Highest-Risk References
1. Foundational distributed systems literature (Sagas).
2. Official Firebase implementation guides.

### Search Limitations
- No deep Boolean queries against actual patent databases (Espacenet, USPTO) were executed due to tooling constraints; relied on canonical software engineering knowledge.
- The relevant priority date of MessFloww is unknown, though assumed modern (~2023+).
