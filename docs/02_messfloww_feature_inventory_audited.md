# 02 — MessFloww Feature Inventory Audited
# Reality Check, Provenance Classification, and Evidence Audit

> **Audit Basis**: `02_messfloww_feature_inventory.md` was derived from direct static
> analysis of the MessFloww codebase. This document audits that inventory for provenance
> accuracy, marketing language, and evidential grounding.
>
> **IMPORTANT**: The original `02_messfloww_feature_inventory.md` is NOT modified.
>
> **Methodology**:
> - Every feature receives exactly one provenance classification
> - No feature is called "novel"
> - No comparison with the reference patent is performed
> - No mechanism is invented to fill gaps
> - Unknown items are explicitly marked [UNKNOWN]

---

## PROVENANCE CLASSIFICATION KEY

| Code | Definition |
|---|---|
| **M-IMPLEMENTED** | The mechanism exists in actual working software. Evidence: source code, deployed system, or equivalent. |
| **M-PROTOTYPED** | A technical implementation exists but is experimental, incomplete, or not production-ready. |
| **M-TECHNICALLY-DESIGNED** | Technical mechanism concretely specified but implementation does not exist. |
| **M-PLANNED** | Intended to be developed; complete technical mechanism not established. |
| **M-CONCEPTUAL** | An idea, possibility, hypothesis, or high-level concept only. |
| **M-BUSINESS** | Commercial, operational, or product-model statement rather than a technical mechanism. |
| **M-UNKNOWN** | Insufficient information to determine status. |

---

## AUDIT FINDING: GENERAL OBSERVATIONS

**Positive findings**: The original `02_messfloww_feature_inventory.md` is unusually well-grounded.
All 35 features (M01-M35) were derived from static code analysis with specific file and line
references. There is no invented mechanism, no ML/AI claim, and the document explicitly states
where evidence is absent (12 Known Unknowns).

**Issues found**:

1. **Two features involve a component not yet verified in full** (U06: `mess_status.currentlyServing`
   write path — the read is confirmed but the write path is unknown, affecting M06's completeness)
2. **M06 "Real-world effect" makes a claim that depends on an unverified component** (the wait
   time is displayed, but its accuracy depends on `currentlyServing` being updated — source not found)
3. **M13 Retry trigger partially manual** — the feature description notes this, which is correct,
   but the provenance should reflect that manual elements reduce the automation claim
4. **M30 "active students" metric source is unclear** — the dashboard shows active students
   but the computation logic was not verified in the audit trail
5. **M27 "Immutable"** is a characterization not a technical mechanism — the ledger has no
   delete path in the codebase but this is a code-review finding, not an enforced constraint
   (Firestore security rules could allow deletes — not verified)
6. **Five features have partial unknowns** noted in Section 12 of the original that affect the
   completeness of those features — these are correctly flagged but the feature entries themselves
   don't carry the uncertainty

---

## SECTION A — VERIFIED TECHNICAL FEATURES (M-IMPLEMENTED)

These features have direct source code evidence with specific file/line citations.
They can currently support technical analysis of the existing implementation.

---

### M01 — Kill-Switch via RTDB onDisconnect
**Provenance: M-IMPLEMENTED**

| Field | Detail |
|---|---|
| Problem | If admin disconnects mid-service, student ordering should cease automatically without requiring manual intervention |
| Technical Mechanism | `startAdminHeartbeat()` writes `system_status/admin_online = true` to RTDB and registers Firebase `onDisconnect(adminOnlineRef).set(false)`. Firebase server-side executes the disconnect write on TCP connection loss, even if the browser crashes or is killed. |
| Input | Firebase `.info/connected` RTDB node (connection state) |
| Processing | Firebase server-side onDisconnect hook; no client-side computation at disconnect time |
| Output | RTDB `system_status/admin_online` = false |
| System component receiving output | All three Cloud Functions (`securePlaceOrder`, `securePlaceUpiOrder`, `securePlaceKioskOrder`) read this flag as precondition; `CartScreen.tsx` disables UI button |
| System behaviour change | Orders blocked server-side and UI-side when flag = false |
| Real-world effect | Orders automatically blocked when admin disconnects |
| Error condition | If Firebase itself goes down, onDisconnect may not execute — [UNKNOWN] whether this edge case is handled |
| Feedback mechanism | Admin reconnecting Admin HQ sets flag back to true |
| Can be demonstrated | YES — code present at `presenceService.ts` L5-13; `index.ts` L78-84, L329, L522 |
| Evidence | Source code with specific line references |
| Marketing language audit | "Automated kill-switch" — accurate; the automation is the Firebase onDisconnect hook |
| **Technical significance** | **HIGH** — the combination of TCP-loss detection + server-side CF enforcement is technically specific |

---

### M02 — Server-Side Price Anti-Spoofing Validation
**Provenance: M-IMPLEMENTED**

| Field | Detail |
|---|---|
| Problem | Client-side price values can be manipulated via browser DevTools |
| Technical Mechanism | CF reads Firestore `menu` collection into a module-level `Map<itemId, price>` with 5-minute TTL. Recomputes `serverTotal = cart.items.reduce((sum, item) => sum + menuPrice(item.id) * item.quantity, 0)`. Rejects if `Math.abs(clientTotal - serverTotal) > 1`. |
| Input | Client-submitted `cart[]` (item IDs, quantities, client-computed prices); server Firestore menu cache |
| Processing | Arithmetic sum; absolute difference comparison |
| Output | `HttpsError('invalid-argument', 'Price mismatch')` if |diff| > 1 |
| System component | `index.ts` `getMenuPrices()` L23-38; `securePlaceKioskOrder` L336-349; `securePlaceUpiOrder` L529-546 |
| Error condition | Rs1 tolerance accommodates floating point rounding; not a security gap for integer prices |
| Feedback | None — rejection is terminal |
| Evidence | Source code with line references |
| **Technical significance** | **MEDIUM** — server-side price validation is a known security pattern; the 5-min TTL cache is the implementation-specific detail |

---

### M03 — RTDB Atomic Stock Decrement with Compensating Rollback
**Provenance: M-IMPLEMENTED**

| Field | Detail |
|---|---|
| Problem | Two students ordering the last item simultaneously should not both succeed |
| Technical Mechanism | Sequential `stockRef.runTransaction(currentData => { if (currentData.stock >= qty) { currentData.stock -= qty; } else { return undefined; /* abort */ } return currentData; })` for each item in cart. Committed items stored in `stockReverts[]`. If any item transaction aborts: iterate `stockReverts`, run increment transactions to restore. |
| Input | `cart[]`; RTDB `menu_stock/{itemId}` (stock, minStock, available) |
| Processing | RTDB OCC via runTransaction(); sequential per-item; compensating rollback on failure |
| Output | All items decremented (success) OR all items restored (failure) |
| System component | `index.ts` L151-188; `processTransaction.ts` L20-55; `stockService.ts` |
| Error condition | If rollback transaction also fails — [UNKNOWN] — no second-level compensation found |
| Feedback | None — failure throws `resource-exhausted` to client |
| Evidence | Source code with line references |
| Marketing language audit | "Atomic" — accurate at the per-item level; "atomic across all items" is approximate — it is compensating transactions, not true distributed atomicity |
| **Technical significance** | **HIGH** — compensating rollback pattern for multi-item stock decrement is technically specific |

---

### M04 — Auto-Availability Toggle on minStock Threshold
**Provenance: M-IMPLEMENTED**

| Field | Detail |
|---|---|
| Problem | When stock falls below a threshold, the item should auto-hide from the student menu |
| Technical Mechanism | Inside RTDB transaction callback after decrement: `if (currentData.stock <= (currentData.minStock || 0)) { currentData.available = false; }` |
| Input | RTDB `menu_stock/{itemId}.stock`, `.minStock` |
| Processing | Numeric comparison inside RTDB server-side transaction callback |
| Output | RTDB `menu_stock/{itemId}.available = false` |
| System component | `index.ts` L157-159; `stockService.ts` L31; `processTransaction.ts` L29-31 |
| Feedback | `available = false` → M17 live menu merge removes item from student view |
| Evidence | Source code with line references |
| **Technical significance** | **MEDIUM** — threshold-based auto-disable is a common inventory pattern; integration within RTDB transaction is the specific detail |

---

### M05 — Dual-Database Cross-Transactional Order Placement
**Provenance: M-IMPLEMENTED**

| Field | Detail |
|---|---|
| Problem | Order creation must atomically validate user, decrement stock, deduct wallet, and write ledger — across two different databases |
| Technical Mechanism | Three-phase sequence: (1) Firestore transaction: reads users/{uid} → rollNo, reads students/{rollNo} → balance/status, validates, increments orderCounters/{today}. (2) Sequential RTDB transactions per cart item: stock decrement with compensating rollback (M03). (3) Second Firestore transaction: deducts students/{rollNo}.balance and .credits, syncs users/{uid}.walletBalance, writes ledger/{id}. |
| Input | cart[], totalPrice, slotName, paymentMode; Firestore users/{uid}, students/{rollNo}, orderCounters/{today}; RTDB menu_stock/*, system_status/admin_online |
| Processing | Firestore transaction + per-item RTDB transactions + second Firestore transaction; compensating rollbacks at RTDB phase; no 2PC |
| Output | RTDB active_orders/{orderId} created; Firestore students.balance decremented; ledger/{id} written |
| System component | `index.ts` L61-297 |
| Error condition | If Phase 3 (wallet deduction) fails after Phase 2 (stock decrement) — stock reverts but order may be in intermediate state. [UNKNOWN] whether full compensation across all three phases is guaranteed. |
| Feedback | None — failure throws error to client |
| Evidence | Source code with line references |
| Marketing language audit | "Cross-transactional" — accurate; "atomic" is approximate (compensating, not 2PC) |
| **Technical significance** | **HIGH** — multi-database compensating transaction orchestration is the most architecturally complex feature in the system |

---

### M06 — Deterministic Wait-Time Estimation at Order Creation
**Provenance: M-IMPLEMENTED** *(with partial unknown on input source)*

| Field | Detail |
|---|---|
| Problem | Student needs to know approximately when to collect food |
| Technical Mechanism | `queuePosition = Math.max(0, orderNumber - currentlyServing)`. `waitTimeSeconds = queuePosition * 3`. `estimatedServingWindow = [Date.now() + waitTimeSeconds*1000, Date.now() + waitTimeSeconds*1000 + 180000]`. Formatted via `Intl.DateTimeFormat`. |
| Input | orderNumber (from Firestore orderCounters/{today}, confirmed); RTDB `mess_status.currentlyServing` (read confirmed; **write path UNKNOWN — see U06**) |
| Processing | Arithmetic: subtraction, multiplication, addition |
| Output | `estimatedServingWindow` string on RTDB `active_orders/{orderId}` and returned to client |
| System component | `index.ts` L222-232; `OrderTrackingScreen.tsx` L182 |
| Known unknown | U06: Who writes `mess_status.currentlyServing`? The write path was not found in code analysis. If `currentlyServing` is never updated, the wait time will always compute as if serving order #0. |
| Marketing language audit | NOT predictive or ML. Formula is arithmetic with a hard-coded constant (3 seconds per order). |
| **Technical significance** | **LOW** — deterministic arithmetic wait-time estimation is a trivial calculation; the significant detail is what feeds `currentlyServing` (UNKNOWN) |

---

### M07 — QR Code Redemption with Idempotency Guard
**Provenance: M-IMPLEMENTED**

| Field | Detail |
|---|---|
| Problem | A student should not be able to scan the same QR code twice to receive food twice |
| Technical Mechanism | CF `collectOrder` runs RTDB transaction: reads `active_orders/{orderId}`. If `order.qrUsed === true`: throws `ORDER_ALREADY_COLLECTED`. Else: sets `qrUsed = true`, `status = 'processing'`, `scannedAt = ISO timestamp`. RTDB runTransaction() ensures atomicity of the check-and-set. |
| Input | orderId from QR scan; RTDB `active_orders/{orderId}` |
| Processing | RTDB OCC transaction: conditional check-and-set |
| Output | RTDB `active_orders/{orderId}`: qrUsed=true, status=processing, scannedAt |
| System component | `index.ts` L658-699; `BarcodeScanPage.tsx` L85-117 |
| Feedback | On duplicate scan: error returned to scanner UI |
| Evidence | Source code with line references |
| **Technical significance** | **MEDIUM** — idempotency via check-and-set transaction is a known pattern; RTDB transaction for QR redemption is implementation-specific |

---

### M08 — Cryptographically Generated Non-Guessable Order ID
**Provenance: M-IMPLEMENTED**

| Field | Detail |
|---|---|
| Problem | Sequential order IDs can be guessed and forged in QR codes |
| Technical Mechanism | `'MFW-' + crypto.randomUUID().replace(/-/g,'').substring(0,12).toUpperCase()`. Uses Web Crypto API CSPRNG. QR encodes raw orderId string. Legacy format parser handles `MESSFLOWW\|ID:...\|REGNO:...\|TS:...` pipe format. |
| Input | None — CSPRNG |
| Processing | UUID generation → strip hyphens → take first 12 chars → uppercase → prepend 'MFW-' |
| Output | 16-char string e.g. `MFW-A3F9C2B48E17` |
| System component | `utils/qrParser.ts` L6-9; `index.ts` L40-43 |
| Evidence | Source code with line references |
| Marketing language audit | "Non-guessable" — accurate for a CSPRNG-derived ID |
| **Technical significance** | **LOW** — CSPRNG-based ID generation is a standard practice; the legacy format parser is an implementation detail |

---

### M09 — Stale UPI Order Auto-Cancellation (Cloud Scheduler)
**Provenance: M-IMPLEMENTED**

| Field | Detail |
|---|---|
| Problem | Students who walk away without completing UPI payment hold stock indefinitely |
| Technical Mechanism | `onSchedule({ schedule: 'every 5 minutes', timeZone: 'Asia/Kolkata' })`. Reads all RTDB `active_orders`. Filter: `paymentStatus === 'PENDING' AND new Date(order.createdAt).getTime() < Date.now() - 900000`. Per stale order: (1) RTDB runTransaction() to increment `menu_stock/{itemId}.stock`; (2) Firestore write `historical_orders/{id}` with `status='expired'`, `cancelReason='auto_expired_15min'`; (3) RTDB `remove(active_orders/{id})`. |
| Input | RTDB `active_orders/*`; system clock |
| Processing | Time-delta filter; per-order stock restoration + archival + deletion |
| Output | RTDB active_orders removed; menu_stock restored; Firestore historical_orders written |
| System component | `index.ts` L748-811 |
| Feedback | Stock restoration feeds FL01 (stock → menu availability) |
| Evidence | Source code with line references |
| **Technical significance** | **MEDIUM** — scheduled stale-order cleanup with stock revert is operationally important; the 15-minute timeout + stock restoration + archive combination is implementation-specific |

---

### M10 — Dual-Mode UPI Payment Confirmation
**Provenance: M-IMPLEMENTED**

| Field | Detail |
|---|---|
| Problem | UPI payment must be physically verified by staff before order is marked as paid and food dispensed |
| Technical Mechanism | `confirmAndCollectUpiOrder` CF: RTDB transaction reads `active_orders/{orderId}`. Checks `paymentStatus === 'PENDING' AND qrUsed !== true`. Atomically sets: `paymentStatus='PAID'`, `qrUsed=true`, `status='processing'`, `paidAt`, `scannedAt`. |
| Input | orderId; RTDB `active_orders/{orderId}` |
| Processing | RTDB transaction: conditional check-and-multi-set |
| Output | RTDB `active_orders/{orderId}` updated with 5 fields atomically |
| Human involvement | Counter staff must physically verify UPI transfer and press "Payment Verified" |
| Evidence | Source code with line references |
| Marketing language audit | "No external payment gateway" — accurate; payment is verified by human, not by a gateway API |
| **Technical significance** | **MEDIUM** — human-in-the-loop payment verification with atomic state update is the specific combination |

---

### M11 — KOT Category-Based Routing to Separate Print Queues
**Provenance: M-IMPLEMENTED**

| Field | Detail |
|---|---|
| Problem | A single multi-item order should be split to the correct kitchen stations by food category |
| Technical Mechanism | `kotQueueService.routeOrderToCounters(order, counters, allMenuItems)`: per item, resolves category via `allMenuItems.find(m => m.id === item.id)`, finds counter whose `categories[]` contains that category (case-insensitive). Writes `RTDB kot_queue/{counterId}/{orderId}_{counterId}`. Unmatched items go to `kot_queue/uncategorized/`. |
| Input | order.items[]; RTDB kot_counters (counter configs); Firestore menu (category resolution) |
| Processing | Per-item category lookup; counter matching; RTDB path construction |
| Output | RTDB `kot_queue/{counterId}/{kotId}` = { orderId, orderNumber, items[], status:'pending', autoPrint, createdAt } |
| System component | `services/kotQueueService.ts` L143-211 |
| Feedback | FL06: print failure → retry queue |
| Evidence | Source code with line references |
| **Technical significance** | **MEDIUM** — KOT routing by food category to separate RTDB queues is operationally specific; standard in larger restaurant systems |

---

### M12 — Thermal KOT Printing with Local Fallback
**Provenance: M-IMPLEMENTED** *(with partial unknown on multi-KOT bug)*

| Field | Detail |
|---|---|
| Problem | Kitchen needs physical paper KOTs without cloud print services; printer may be offline |
| Technical Mechanism | `printReceiptSilent()`: POST `http://localhost:5000/print-kot` (Python server). On HTTP failure: calls `printReceipt()` (iframe method). Global `printQueue = Promise.resolve()` chain prevents concurrent print jobs. Python server: `win32print.WritePrinter()` with `threading.Lock(timeout=10s)`. Fallback: `ReactDOMServer.renderToString(ThermalReceipt)` → hidden iframe → `window.print()`. |
| Input | BillDocument object (orderNumber, userRollNo, slotName, items[]) |
| Processing | HTTP POST to local Flask server; ESC/POS text generation; print queue serialization |
| Output | Physical KOT paper OR browser print dialog |
| System component | `modules/ThermalPrinter/printUtils.ts` L119-151; `tools/print_server/print_server.py` L48-96 |
| Known issue | U07: `printReceiptSilent()` may only POST `itemsArray[0]` to Python server for multi-KOT arrays — potential bug in multi-category orders. Evidence: `printUtils.ts` L128. |
| Evidence | Source code with line references |
| **Technical significance** | **MEDIUM** — local Python thermal print server with browser iframe fallback is an implementation-specific solution for the Windows hardware constraint |

---

### M13 — KOT Queue with Retry and Failure Tracking
**Provenance: M-IMPLEMENTED** *(retry trigger is manual)*

| Field | Detail |
|---|---|
| Problem | If printer is offline, KOT should not be permanently lost |
| Technical Mechanism | `markKOTFailed()`: increments `retryCount`, sets `status='failed'`. `retryFailedKOTs()`: queries `status='failed' AND retryCount < 3`, resets to `status='pending'`. `clearPrintedKOTs()`: bulk-deletes `status='printed'` entries. Retry loop cap: 3 attempts. |
| Input | RTDB `kot_queue/{counterId}/{kotId}` |
| Processing | RTDB read-modify-write on status and retryCount |
| Output | Updated RTDB status fields |
| Human involvement | Retry trigger (`retryFailedKOTs()`) requires staff action to initiate |
| Automation | Failure detection is automatic; retry itself is manual |
| Evidence | Source code with line references |
| **Technical significance** | **LOW** — retry-with-counter queue pattern is standard; 3-attempt cap is a constant |

---

### M14 — Student Wallet Dual-Path Synchronized Balance
**Provenance: M-IMPLEMENTED**

| Field | Detail |
|---|---|
| Problem | Two Firestore paths must stay in sync: admin-facing `students/{regNo}.balance` and student-app-facing `users/{uid}.walletBalance` |
| Technical Mechanism | Top-up: `walletService.topUpWalletByRegNo()` uses Firestore `writeBatch()` updating both paths simultaneously. Deduction: within CF Firestore transaction, both `students/{rollNo}.balance` and `users/{uid}.walletBalance` are updated in same transaction. |
| Input | Admin top-up amount; OR order totalPrice (deduction) |
| Processing | Firestore batch or transaction ensures both writes commit together or not at all |
| Output | Both Firestore paths updated atomically |
| System component | `walletService.ts` L36-63; `index.ts` L193-211 |
| Evidence | Source code with line references |
| **Technical significance** | **LOW** — dual-path balance sync is an implementation artifact of the data model; it solves a self-imposed problem |

---

### M15 — Bulk Monthly Balance Assignment (Chunked Batch Writes)
**Provenance: M-IMPLEMENTED**

| Field | Detail |
|---|---|
| Problem | Setting monthly mess balance for all students individually would require N separate operations |
| Technical Mechanism | `assignMonthlyBalanceToAll(amount)`: queries `students where status == 'active'`. Builds Firestore `writeBatch()` with two writes per student (balance + credits). Commits every 400 records (Firestore batch limit = 500). |
| Input | amount (Rs integer); Firestore students where status='active' |
| Processing | Chunked batch write; chunk size = 400 |
| Output | All active students' balances set to amount |
| System component | `walletService.ts` L70-122 |
| Human involvement | Admin initiates; bulk write is automated |
| Evidence | Source code with line references |
| **Technical significance** | **LOW** — chunked batch write is a standard Firestore pattern dictated by the 500-doc batch limit |

---

### M16 — Student Status Watcher with Force-Logout
**Provenance: M-IMPLEMENTED**

| Field | Detail |
|---|---|
| Problem | A banned student should be ejected from the app immediately, even if currently logged in |
| Technical Mechanism | `onSnapshot(doc(db, 'students', regNo), snap => { if (snap.data().status === 'disabled') { toast.error(...); firebaseSignOut(auth); } })` |
| Input | Firestore `students/{regNo}.status` (real-time Firestore listener) |
| Processing | String comparison in onSnapshot callback |
| Output | Firebase Auth sign-out; React Router redirect to login |
| System component | `student-portal/src/core/auth/AuthContext.tsx` L99-130 |
| Feedback | Status change triggers immediate logout |
| Evidence | Source code with line references |
| **Technical significance** | **LOW** — Firestore onSnapshot for force-logout is a straightforward real-time listener pattern |

---

### M17 — Live Menu Merged Firestore and RTDB Stock Subscription
**Provenance: M-IMPLEMENTED**

| Field | Detail |
|---|---|
| Problem | Menu metadata lives in Firestore but live stock lives in RTDB; clients need a unified real-time view |
| Technical Mechanism | `menuService.subscribeToMenu(callback)`: opens two simultaneous subscriptions — Firestore `onSnapshot` on `menu` collection, and RTDB `onValue` on `menu_stock`. On either update, `emitMenu()` overrides `stock/minStock/available` from RTDB `stockMap` onto Firestore items array before calling callback. |
| Input | Firestore menu (canonical metadata); RTDB menu_stock/{itemId} (live counts) |
| Processing | Fan-in merge: either update triggers re-merge and callback |
| Output | `Record<slotName, MenuItem[]>` with live stock values overlaid |
| System component | `services/menuService.ts` L41-93 |
| Feedback | RTDB stock update → emitMenu() → student UI re-renders with updated availability |
| Evidence | Source code with line references |
| **Technical significance** | **MEDIUM** — dual-subscription fan-in merge pattern bridging two Firebase databases is architecturally specific |

---

### M18 — Offline Cart Persistence via IndexedDB (localforage)
**Provenance: M-IMPLEMENTED**

| Field | Detail |
|---|---|
| Problem | Cart contents should survive page reload or temporary network loss |
| Technical Mechanism | `offlineStorage` creates three `localforage` instances (menu, user, cart) in `messflow` IndexedDB database. Cart saved on every state change via `useEffect([cart])`; loaded from `offlineStorage.getCart()` on mount. |
| Input | React cart state |
| Processing | localforage read/write to browser IndexedDB |
| Output | Cart persisted across page reloads |
| System component | `shared/lib/offline/storage.ts` |
| Evidence | Source code with references |
| **Technical significance** | **LOW** — localforage/IndexedDB cart persistence is a standard PWA pattern |

---

### M19 — Cart Pre-Check Against Live Menu
**Provenance: M-IMPLEMENTED**

| Field | Detail |
|---|---|
| Problem | Admin may delete a menu item while student is browsing with it in cart |
| Technical Mechanism | `menuService.subscribeToMenu()` → builds `Set<number>` of current item IDs → `cart.filter(item => allIds.has(Number(item.id)))` → if filtered count < original count: `toast.warning(...)` |
| Input | Live Firestore menu; current cart state |
| Processing | Set membership check |
| Output | Cart with invalid items removed; warning toast |
| System component | `student-portal/features/ordering/CartScreen.tsx` L47-68 |
| Evidence | Source code with references |
| **Technical significance** | **LOW** — cart validation against live menu is a standard ordering pattern |

---

### M20 — Client-Side Token Bucket Rate Limiter
**Provenance: M-IMPLEMENTED** *(client-side only; not a security control)*

| Field | Detail |
|---|---|
| Problem | Prevent accidental rapid-fire order submissions |
| Technical Mechanism | Module-level `Map<string, TokenBucket>`. `tryConsume()`: `tokens = Math.min(maxTokens, tokens + Math.floor(elapsed/refillRateMs))`. Check `tokens >= 1`. `ORDER_RATE = { key:'placeOrder', max:3, refillMs:100_000 }`. Bucket resets on page refresh. |
| Input | In-memory bucket state (not persisted) |
| Processing | Token bucket arithmetic |
| Output | Boolean allow/deny; `secondsUntilNextToken()` for UI display |
| System component | `shared/utils/rateLimiter.ts` |
| Limitation | Resets on page refresh — not a server-side security control |
| Evidence | Source code with references |
| **Technical significance** | **LOW** — client-side token bucket is a UX convenience, not a security mechanism |

---

### M21 — Active Slot Subscription with Four-Level Fuzzy Menu Matching
**Provenance: M-IMPLEMENTED**

| Field | Detail |
|---|---|
| Problem | Slot name in `timeSlots/current` may not exactly match slot names in menu items |
| Technical Mechanism | `subscribeToActiveSlot()` → Firestore `onSnapshot` on `timeSlots/current`. Menu rendered via `useMemo` with four-level fallback: (1) exact string match; (2) `includes()` substring match; (3) prefix match (first 3 chars); (4) single-slot fallback (if only one slot exists in menu). |
| Input | Firestore `timeSlots/current`; local menuData state |
| Processing | Four-level fallback cascade |
| Output | `activeItems: MenuItem[]` displayed to student |
| System component | `student-portal/features/ordering/HomeScreen.tsx` L107-152 |
| Evidence | Source code with references |
| **Technical significance** | **LOW** — multi-level fuzzy string matching is a defensive coding pattern for data consistency issues |

---

### M22 — Admin Kill-Switch Client-Side Enforcement
**Provenance: M-IMPLEMENTED**

| Field | Detail |
|---|---|
| Problem | Students should not be able to attempt orders when admin is offline even at the UI level |
| Technical Mechanism | RTDB `onValue(ref(rtdb, 'system_status/admin_online'), snap => setIsAdminOnline(snap.val() !== false))`. Order button: `disabled={!isAdminOnline}`. |
| Input | RTDB `system_status/admin_online` (real-time) |
| Processing | Boolean conversion from RTDB snapshot |
| Output | UI: button disabled state |
| System component | `student-portal/features/ordering/CartScreen.tsx` L38-45, L396-413 |
| Note | This is client-side only; server-side enforcement is M01. Together they form dual-layer enforcement. |
| Evidence | Source code with references |
| **Technical significance** | **LOW** as standalone; meaningful as the client-side complement to M01's server-side enforcement |

---

### M23 — Kiosk Multi-Mode Order Processing
**Provenance: M-IMPLEMENTED**

| Field | Detail |
|---|---|
| Problem | Counter kiosk serves different order types: registered students (wallet), walk-in customers, external orders |
| Technical Mechanism | `securePlaceKioskOrder` CF receives `orderType`: `'counter' \| 'external' \| 'shop'`. Counter: validates student regNo, deducts wallet, writes ledger. External/Shop: only increments order counter, no student lookup. Order ID prefixes: CNT-, EXT-, SHP-. |
| Input | cart[], slotName, orderType, paymentMode, studentRegNo (counter only) |
| Processing | Conditional order path based on orderType |
| Output | RTDB `active_orders/{orderId}` with type-specific fields |
| System component | `index.ts` L302-496; `kiosk-counter/features/counter/CounterOrderPage.tsx` |
| Evidence | Source code with references |
| **Technical significance** | **MEDIUM** — unified multi-mode kiosk with type-specific financial handling is operationally specific |

---

### M24 — HID Barcode Scanner Input via Global keydown Buffer
**Provenance: M-IMPLEMENTED**

| Field | Detail |
|---|---|
| Problem | USB HID barcode scanners act as keyboards; standard input fields require focus |
| Technical Mechanism | Global `window.addEventListener('keydown', onKeyDown)`. Characters accumulate in `bufferRef.current`. 100ms debounce timer clears buffer on silence. On Enter key: flush buffer to `handleScan()`. Scan throttle: max 1 scan per 1000ms. |
| Input | Physical keyboard events from USB HID barcode scanner |
| Processing | Character buffering; 100ms debounce; Enter-flush |
| Output | `handleScan(bufferContents)` called with complete barcode string |
| System component | `kiosk-counter/features/scan/BarcodeScanPage.tsx` L180-206 |
| Evidence | Source code with references |
| **Technical significance** | **LOW** — global keydown buffer for HID scanners is a known browser integration pattern |

---

### M25 — Student Registration Lookup at Counter
**Provenance: M-IMPLEMENTED**

| Field | Detail |
|---|---|
| Problem | Counter staff need to verify student identity and check balance before placing wallet order |
| Technical Mechanism | `getStudentByRegNo(regNo)`: `Firestore getDoc(doc(db, 'students', regNo))`. Result checked: `status === 'disabled'` → show error, block proceeding. |
| Input | Registration number (typed by staff) |
| Processing | Firestore point read; status check |
| Output | Student name, balance, status displayed; or error |
| System component | `kiosk-counter/features/counter/CounterOrderPage.tsx` L61-87; `studentService.ts` L159-164 |
| Evidence | Source code with references |
| **Technical significance** | **LOW** — Firestore lookup with status validation is a standard pattern |

---

### M26 — Order Archival on Terminal State Transition
**Provenance: M-IMPLEMENTED**

| Field | Detail |
|---|---|
| Problem | RTDB accumulates all-time orders; completed orders should be archived to persistent storage |
| Technical Mechanism | `orderService.updateOrderStatus()`: on terminal status in `['completed', 'collected', 'cancelled', 'expired', 'refunded']`: `setDoc(doc(db, 'historical_orders', id), { ...orderData, archivedAt })` then `remove(orderRef)`. |
| Input | Terminal status string; RTDB `active_orders/{orderId}` data |
| Processing | Firestore write + RTDB delete in sequence (NOT atomic between the two DBs) |
| Output | Firestore `historical_orders/{orderId}` created; RTDB `active_orders/{orderId}` deleted |
| System component | `shared-core/rtdb/orderService.ts` L34-58, L72-88 |
| Note | The Firestore write and RTDB delete are NOT atomic. If the Firestore write succeeds but RTDB delete fails, the order remains in both stores. [PARTIALLY UNKNOWN] — no compensating logic found. |
| Evidence | Source code with references |
| **Technical significance** | **LOW** — active/archive pattern is standard; RTDB→Firestore migration path is implementation-specific |

---

### M27 — Immutable Financial Ledger
**Provenance: M-IMPLEMENTED** *(with caveat)*

| Field | Detail |
|---|---|
| Problem | Financial records must be auditable and tamper-resistant |
| Technical Mechanism | Ledger writes (`ledger/{autoId}`) happen inside CF Firestore transactions (purchases) or batches (top-ups). No `delete` or `update` calls on `ledger` collection found in codebase. |
| Input | Transaction type, amount, studentRegNo, orderId, serverTimestamp() |
| Processing | Firestore atomic write within existing transaction |
| Output | Firestore `ledger/{autoId}` document |
| System component | `index.ts` L202-211 (purchase); `walletService.ts` L52-62 (top-up) |
| Caveat | "Immutable" means no delete path in client code. Whether Firestore security rules enforce immutability (no deletes from client OR server) is [UNVERIFIED]. An admin with Admin SDK access could delete ledger records. The code-level immutability is a convention, not a technical enforcement. |
| Evidence | Source code with references; absence of delete calls |
| **Technical significance** | **LOW** — write-only ledger pattern is standard practice; enforcement depends on security rules not reviewed |

---

### M28 — Daily Sequential Order Token via Firestore Transaction
**Provenance: M-IMPLEMENTED**

| Field | Detail |
|---|---|
| Problem | Kitchen staff need human-readable order numbers (not UUIDs) that reset daily |
| Technical Mechanism | Firestore doc `orderCounters/${YYYY-MM-DD}`. Within Firestore transaction: read `.count` → increment → update. `orderNumber = count + 1`. Daily reset is implicit: new doc key per day. |
| Input | Firestore `orderCounters/{YYYY-MM-DD}` |
| Processing | Firestore OCC transaction: read-increment-write |
| Output | orderNumber integer stored on order |
| System component | `index.ts` L88-130, L404-426, L598-610 |
| Evidence | Source code with references |
| **Technical significance** | **LOW** — daily counter via Firestore transaction is a standard pattern |

---

### M29 — Per-Item GST Calculation on Kiosk Bills
**Provenance: M-IMPLEMENTED**

| Field | Detail |
|---|---|
| Problem | Kiosk thermal receipts must show GST breakdown per Indian tax requirements |
| Technical Mechanism | `totalGst = cart.reduce((sum, item) => sum + Math.round(item.price * ((item.gst \|\| 0) / 100)) * item.quantity)`. In `mapOrderToBill()`: `gstAmount = Math.round(basePrice * (gstPercentage / 100))`. `inclusiveRate = basePrice + gstAmount`. Default gstPercentage = 5.0. |
| Input | item.price, item.gst (from Firestore menu), item.quantity |
| Processing | Arithmetic: percentage calculation, rounding, accumulation |
| Output | GST line total; per-item inclusive rate on BillDocument |
| System component | `kiosk-counter/CounterOrderPage.tsx` L144-147; `ThermalPrinter/mapper.ts` L17-22 |
| Evidence | Source code with references |
| **Technical significance** | **LOW** — per-item GST arithmetic is a regulatory requirement implementation |

---

### M30 — Real-Time Admin Dashboard with Live Metrics
**Provenance: M-IMPLEMENTED** *(with partial unknown)*

| Field | Detail |
|---|---|
| Problem | Admin needs operational visibility without refreshing |
| Technical Mechanism | `subscribeActiveOrders()` → RTDB `onValue`. `fetchTodayStats()` → Firestore `historical_orders` where `createdAt >= today 00:00`. Stats via `useMemo`: totalOrders, totalRevenue (completed only), avgOrderValue. |
| Input | RTDB active_orders; Firestore historical_orders |
| Processing | Array reduce for aggregation |
| Output | Dashboard metric cards |
| System component | `admin-hq/features/dashboard/DashboardPage.tsx` L17-100 |
| Partial unknown | "Active students" metric — computation logic not confirmed in audit trail |
| Evidence | Source code with references |
| **Technical significance** | **LOW** — real-time dashboard via Firebase listeners is a standard Firebase application pattern |

---

### M31 — Student CSV Bulk Import with Email-Keyed Sync
**Provenance: M-IMPLEMENTED**

| Field | Detail |
|---|---|
| Problem | Onboarding hundreds of students individually would require N separate operations |
| Technical Mechanism | `batchReplaceStudents(students[])`: Firestore `writeBatch()`. Per student: `batch.set(doc('students', regNo), student, { merge: true })` (merge: true preserves uid). If email: `batch.set(doc('registered_students', email.toLowerCase()), { email, regNo, name, status }, { merge: true })`. |
| Input | Parsed CSV → Student[] array |
| Processing | Chunked Firestore batch writes |
| Output | Firestore students/{regNo} and registered_students/{email} created/updated |
| System component | `shared-core/services/studentService.ts` L67-88 |
| Evidence | Source code with references |
| **Technical significance** | **LOW** — CSV import with batch write is standard admin tooling |

---

### M32 — Automatic Student Email-to-RegNo Account Linking
**Provenance: M-IMPLEMENTED**

| Field | Detail |
|---|---|
| Problem | Students should not need to manually enter their registration number; institutional email should establish identity |
| Technical Mechanism | `onAuthStateChanged`: queries `registered_students` where `email == user.email`. If found: reads `students/{regNo}`, constructs UserProfile with `userType='internal'`. Writes to `users/{uid}`. Backfills `students/{regNo}.uid = user.uid` if missing. |
| Input | Firebase Auth user object (email, uid, displayName) |
| Processing | Firestore query by email; profile construction; backfill write |
| Output | Firestore `users/{uid}` created; `students/{regNo}.uid` backfilled |
| System component | `student-portal/src/core/auth/AuthContext.tsx` L52-97 |
| Evidence | Source code with references |
| **Technical significance** | **MEDIUM** — pre-registration email→regNo lookup with auto-linking at login is operationally specific |

---

### M33 — KOT Auto-Print Mode on KDS
**Provenance: M-IMPLEMENTED**

| Field | Detail |
|---|---|
| Problem | Kitchen staff should not need to manually press Print for every new order |
| Technical Mechanism | `autoPrint` boolean in `localStorage`. In `subscribeActiveOrders` callback: filters `o.autoPrint && !autoPrintedOrders.current.has(o.id)` → calls `printReceiptSilent(mapOrderToKOTs(order, allMenuItems), settings)`. `autoPrintedOrders` is `useRef<Set<string>>` to prevent re-prints on React re-renders. |
| Input | RTDB active_orders; localStorage kds_autoPrint |
| Processing | Set-based deduplication; conditional print call |
| Output | Physical KOT printed (or iframe fallback) |
| System component | `inventory-kitchen/features/kds/KitchenDisplayPage.tsx` L28-67 |
| Evidence | Source code with references |
| **Technical significance** | **LOW** — auto-print on subscription callback with useRef deduplication is a React+Firebase pattern |

---

### M34 — KOT Item Grouping by Food Category
**Provenance: M-IMPLEMENTED**

| Field | Detail |
|---|---|
| Problem | A single order with items from multiple kitchen stations needs to produce separate KOTs per station |
| Technical Mechanism | `mapOrderToKOTs(order, allMenuItems)`: builds `groups: Record<category, items[]>` via reduce. Resolves category via `allMenuItems.find(i => i.id === item.id)`. Combines identical item names within same category (sum qty). Returns one BillDocument per category with `isKOT: true`. |
| Input | order.items[]; allMenuItems (merged Firestore+RTDB menu) |
| Processing | Reduce to category groups; deduplication by name; qty summing |
| Output | BillDocument[] — one per category |
| System component | `modules/ThermalPrinter/mapper.ts` L62-109 |
| Evidence | Source code with references |
| **Technical significance** | **LOW** — category-based grouping for KOT generation is standard in multi-station restaurant POS |

---

### M35 — KOT Counter Heartbeat and Session Tracking
**Provenance: M-IMPLEMENTED**

| Field | Detail |
|---|---|
| Problem | Admin needs to know which printer stations are currently connected |
| Technical Mechanism | `kotQueueService.updateCounterHeartbeat(counterId, sessionId)`: RTDB `update()` on `kot_counters/{counterId}` with `{ lastHeartbeat: ISO string, activeSessionId: sessionId }`. `updateCounterStatus()` sets `status` field. |
| Input | counterId, sessionId |
| Processing | RTDB update |
| Output | RTDB `kot_counters/{counterId}.lastHeartbeat` and `.activeSessionId` updated |
| System component | `shared-core/services/kotQueueService.ts` L38-44 |
| Evidence | Source code with references |
| **Technical significance** | **LOW** — heartbeat via RTDB update is a standard presence pattern |

---

## SECTION B — TECHNICALLY DESIGNED FEATURES (M-TECHNICALLY-DESIGNED)

No features in the original inventory are classified as M-TECHNICALLY-DESIGNED.
All 35 features have actual code implementations. This is expected given the
source was a codebase, not a design document.

---

## SECTION C — PLANNED FEATURES (M-PLANNED)

No features in the original inventory were classified as planned.
Planned features would typically appear in a roadmap or design document, not code.

---

## SECTION D — CONCEPTUAL FEATURES (M-CONCEPTUAL)

No features in the original inventory are classified as conceptual.

---

## SECTION E — BUSINESS / PRODUCT FEATURES (M-BUSINESS)

The following items from the original document describe operational or product-level
characteristics rather than standalone technical mechanisms:

| Item | Classification | Reason |
|---|---|---|
| "Waiting time reduction from 15-20 min to 2-4 min" (§11) | M-BUSINESS | Stated operational benefit; no algorithm computes or enforces this |
| "Monthly mess fee loading takes one click" (M15 description) | M-BUSINESS | Description of operational benefit, not a mechanism |
| "Admin can onboard hundreds of students in one operation" (M31 description) | M-BUSINESS | Operational benefit statement |
| "Auditable financial trail — every rupee movement has a server-timestamped record" (M27) | M-BUSINESS | Compliance/operational characterization; the technical mechanism is the ledger write |

---

## SECTION F — UNKNOWN / UNVERIFIED FEATURES

The following components are referenced in the code but their full technical mechanisms
were not established in the codebase analysis. They affect the completeness of existing features.

| ID | Unknown | Affects | Status |
|---|---|---|---|
| U01 | `sessionGuard.ts` — exported but not traced | [UNKNOWN] | M-UNKNOWN |
| U02 | `claimSession` and `watchSessionCollision` — imported in AuthContext | [UNKNOWN] | M-UNKNOWN |
| U03 | Night Mess / `isNightMessEnrolled` distinction and behavior | M-UNKNOWN | M-UNKNOWN |
| U04 | `autoToggleEnabled + thresholdMinutes` — no scheduled function found | M-UNKNOWN | M-UNKNOWN |
| U05 | ManualOrderModal in Admin Dashboard | M-UNKNOWN | M-UNKNOWN |
| **U06** | **`mess_status.currentlyServing` write path — who increments this?** | **M06** | **M-UNKNOWN** |
| U07 | `printReceiptSilent` multi-KOT bug — only POSTs itemsArray[0] | M12, M33 | M-PROTOTYPED (potential bug) |
| U08 | ReportsPage.tsx — email CF commented out; is any part functional? | M-UNKNOWN | M-UNKNOWN |
| U09 | `kiosk_users.csv` — is it used for kiosk authentication? | M-UNKNOWN | M-UNKNOWN |
| U10 | `sync_status: 'cloud'` field — was there a previous local sync mode? | M-UNKNOWN | M-UNKNOWN |

---

## PART G — MARKETING LANGUAGE AUDIT

Occurrences of vague marketing terms in the original inventory and their verification status:

| Term | Location | Verified Mechanism | Result |
|---|---|---|---|
| "Automated" / "Full automation" | M01-M35 (many) | In all cases verified against specific code | **ACCURATE** — no false automation claims found |
| "Real-time" | M17 (live menu), M30 (dashboard), M22 (kill-switch) | Firebase onValue/onSnapshot listeners provide sub-second push; "real-time" is accurate for Firebase push semantics | **ACCURATE** |
| "Atomic" | M03, M05, M07, M10 | M03, M07, M10: single RTDB runTransaction() — truly atomic. M05: three-phase compensating, NOT truly atomic across all databases. | **PARTIALLY INACCURATE** — M05's "cross-transactional" is compensating transactions, not true distributed atomicity. This is correctly noted in M05 description but should be explicit. |
| "Immutable" | M27 (ledger) | No delete calls in client code. Whether enforced by Firestore security rules is UNVERIFIED. | **PARTIALLY UNVERIFIED** |
| "Non-guessable" | M08 (order ID) | CSPRNG (crypto.randomUUID()) confirmed. | **ACCURATE** |
| "AI / machine learning / prediction" | NONE | Correctly absent from original document | **ACCURATE** — the original explicitly states no ML exists |
| "Dynamic" | Not used in original | N/A | No issue |
| "Intelligent" | Not used in original | N/A | No issue |
| "Scalable" | Not used in original | N/A | No issue |
| "Smart" | Not used in original | N/A | No issue |
| "Personalized" | Not used in original | N/A | No issue |
| "Predictive" | Not used in original | The original explicitly states wait-time is deterministic arithmetic | **ACCURATE** |

**Overall finding**: The original inventory is unusually free of marketing inflation.
No AI/ML claims. No invented mechanisms. No prediction claims.

---

## PART H — PROBLEM / MECHANISM / RESULT SEPARATION

For the top technically significant features:

### M05 — Dual-Database Order Placement

**Problem**: Campus mess ordering requires simultaneous validation and mutation across three
independent concerns (user identity/balance, physical stock, financial ledger) which live in
two different databases. Standard single-database transactions cannot span Firestore and RTDB.

**Technical Mechanism**: Sequential three-phase execution in a single Cloud Function:
Phase 1 (Firestore transaction): identity + balance check + order counter.
Phase 2 (RTDB sequential runTransactions): per-item stock decrement with stockReverts[] for rollback.
Phase 3 (Firestore transaction): wallet deduction + ledger write.
Compensating rollbacks used at Phase 2 boundary. No 2PC.

**Input**: cart[], totalPrice, slotName; Firestore users/{uid}, students/{rollNo}, orderCounters/{today}; RTDB menu_stock/*, system_status/admin_online.

**Processing**: Firestore transaction → N × RTDB runTransaction → Firestore transaction.

**Output**: RTDB active_orders/{orderId}; Firestore students.balance decremented; Firestore ledger/{id} written.

**System action**: Order visible to kitchen; wallet deducted; stock unavailable for next order.

**Result**: Student cannot place an order without corresponding wallet deduction and stock reduction both succeeding. Partial failure leaves no permanent inconsistency (except the Phase 2→3 gap — see U06 above).

**Evidence**: `index.ts` L61-297 (source code).

**What happens when wrong**: Phase 2 failure → stockReverts[] rollback → error to client, no order created. Phase 3 failure → [UNKNOWN] — stock already decremented, wallet not yet deducted. This gap is the main unverified failure mode.

---

### M01 — Kill-Switch via RTDB onDisconnect

**Problem**: Admin must be actively connected for the mess to operate; if they lose connectivity, student ordering should auto-cease without requiring manual action or polling.

**Technical Mechanism**: Firebase RTDB `onDisconnect().set(false)` registered on `system_status/admin_online` ref. Firebase server-side executes this write when the client's WebSocket connection drops, regardless of browser state.

**Input**: TCP connection state (implicit Firebase internal).

**Processing**: Server-side Firebase execution of pre-registered write on connection loss.

**Output**: RTDB `system_status/admin_online = false`.

**System action**: All three CF order functions check this flag first; student CartScreen disables button via RTDB listener.

**Result**: No new orders can be placed while admin is disconnected, without any code running on the client.

**Evidence**: `presenceService.ts` L5-13; `index.ts` L78-84, L329, L522 (source code).

**What happens when wrong**: If Firebase infrastructure fails entirely, onDisconnect may not execute. This is a Firebase reliability dependency, not a MessFloww code issue.

---

### M03 — RTDB Atomic Stock Decrement with Compensating Rollback

**Problem**: Two students ordering the last item simultaneously must not both succeed.

**Technical Mechanism**: Per-item `RTDB.ref.runTransaction()` with OCC. On commit: add item to `stockReverts[]`. On any item abort (stock insufficient): iterate `stockReverts`, run increment transaction on each committed item.

**Input**: cart[]; RTDB menu_stock/{itemId} (stock, minStock, available).

**Processing**: Sequential runTransaction per item; compensating increment array.

**Output**: All items decremented (success) OR all reverted (failure).

**System action**: Student receives ORDER_RESOURCE_EXHAUSTED on failure; no stock held.

**Result**: Concurrent orders for the same item resolve cleanly — exactly one wins.

**Evidence**: `index.ts` L151-188; `processTransaction.ts` L20-55 (source code).

**What happens when wrong**: If compensating rollback itself fails → item remains decremented but no order created. [UNKNOWN] — no second-level compensation was found.

---

### M09 — Stale UPI Order Auto-Cancellation

**Problem**: Students who initiate UPI payment but walk away without paying hold stock indefinitely, blocking other students.

**Technical Mechanism**: `onSchedule({ schedule: 'every 5 minutes', timeZone: 'Asia/Kolkata' })`. Filter: `paymentStatus === 'PENDING' AND createdAt < Date.now() - 900000`. Per stale order: stock restore via RTDB runTransaction; archive to Firestore historical_orders; delete from RTDB active_orders.

**Input**: RTDB active_orders; system clock.

**Processing**: Time-window filter; per-order compensating cleanup.

**Output**: Stock restored; order archived; RTDB cleared.

**System action**: Stock restored → may re-enable item availability (FL01).

**Result**: Stock held by walk-away students is released after 15 minutes automatically.

**Evidence**: `index.ts` L748-811 (source code).

---

## PART I — TECHNICAL SIGNIFICANCE CLASSIFICATION

| ID | Feature | Provenance | Technical Significance | Reason |
|---|---|---|---|---|
| M01 | Kill-switch via RTDB onDisconnect | M-IMPLEMENTED | **HIGH** | TCP-loss → server-side write → CF precondition: technically specific combination |
| M02 | Server-side price anti-spoofing | M-IMPLEMENTED | **MEDIUM** | Known security pattern; TTL cache is implementation detail |
| M03 | RTDB atomic stock decrement + compensating rollback | M-IMPLEMENTED | **HIGH** | Multi-item OCC with per-item compensating array is specific |
| M04 | Auto-availability toggle on minStock | M-IMPLEMENTED | **MEDIUM** | Threshold-based auto-disable within transaction |
| M05 | Dual-database cross-transactional order placement | M-IMPLEMENTED | **HIGH** | Multi-DB compensating transaction orchestration |
| M06 | Deterministic wait-time estimation | M-IMPLEMENTED | **LOW** | Trivial arithmetic; currentlyServing write path UNKNOWN |
| M07 | QR redemption idempotency | M-IMPLEMENTED | **MEDIUM** | RTDB check-and-set for idempotency |
| M08 | CSPRNG order ID | M-IMPLEMENTED | **LOW** | Standard CSPRNG usage |
| M09 | Stale UPI auto-cancellation (scheduler) | M-IMPLEMENTED | **MEDIUM** | Scheduled cleanup with stock revert + archive specific |
| M10 | Dual-mode UPI confirmation | M-IMPLEMENTED | **MEDIUM** | Human-in-loop + atomic state update combination |
| M11 | KOT category routing to RTDB queues | M-IMPLEMENTED | **MEDIUM** | Category→counter mapping to separate RTDB queues |
| M12 | Thermal printing + local fallback | M-IMPLEMENTED | **MEDIUM** | Local Flask + win32print + browser fallback chain |
| M13 | KOT retry queue | M-IMPLEMENTED | **LOW** | Standard retry pattern with counter |
| M14 | Dual-path wallet sync | M-IMPLEMENTED | **LOW** | Implementation artifact of data model choice |
| M15 | Bulk monthly balance assignment | M-IMPLEMENTED | **LOW** | Standard chunked batch write |
| M16 | Status watcher + force-logout | M-IMPLEMENTED | **LOW** | Standard onSnapshot pattern |
| M17 | Dual-subscription live menu merge | M-IMPLEMENTED | **MEDIUM** | Fan-in merge from two Firebase databases |
| M18 | Offline cart via IndexedDB | M-IMPLEMENTED | **LOW** | Standard PWA pattern |
| M19 | Cart pre-check against live menu | M-IMPLEMENTED | **LOW** | Standard cart validation |
| M20 | Client-side token bucket | M-IMPLEMENTED | **LOW** | Client-side UX convenience; not a security control |
| M21 | Four-level fuzzy slot matching | M-IMPLEMENTED | **LOW** | Defensive string matching |
| M22 | Kill-switch client-side enforcement | M-IMPLEMENTED | **LOW** | RTDB listener → button disabled |
| M23 | Kiosk multi-mode processing | M-IMPLEMENTED | **MEDIUM** | Multi-mode unified kiosk with type-specific paths |
| M24 | HID scanner global keydown buffer | M-IMPLEMENTED | **LOW** | Known browser HID pattern |
| M25 | Counter student lookup | M-IMPLEMENTED | **LOW** | Standard Firestore point read |
| M26 | Order archival on terminal state | M-IMPLEMENTED | **LOW** | Active/archive pattern |
| M27 | Write-only financial ledger | M-IMPLEMENTED | **LOW** | Convention enforced by code; security rules unverified |
| M28 | Daily sequential order token | M-IMPLEMENTED | **LOW** | Standard Firestore OCC counter |
| M29 | Per-item GST calculation | M-IMPLEMENTED | **LOW** | Regulatory arithmetic |
| M30 | Real-time admin dashboard | M-IMPLEMENTED | **LOW** | Standard Firebase listener aggregation |
| M31 | CSV bulk import + email-keyed sync | M-IMPLEMENTED | **LOW** | Standard admin tooling |
| M32 | Email→regNo auto-linking | M-IMPLEMENTED | **MEDIUM** | Pre-registration lookup at login |
| M33 | KOT auto-print on KDS | M-IMPLEMENTED | **LOW** | React+Firebase auto-print pattern |
| M34 | KOT item grouping by category | M-IMPLEMENTED | **LOW** | Standard POS grouping pattern |
| M35 | Counter heartbeat and session tracking | M-IMPLEMENTED | **LOW** | Standard RTDB presence pattern |

---

## PART J — VERIFIED MESSFLOWW FINGERPRINT

*Only M-IMPLEMENTED features with MEDIUM or HIGH technical significance*

| ID | Feature | Technical Mechanism | Evidence | Technical Significance |
|---|---|---|---|---|
| **M01** | Kill-switch via RTDB onDisconnect | Firebase server-side onDisconnect().set(false) on TCP loss; enforced in all 3 CF order functions and CartScreen UI | `presenceService.ts` L5-13; `index.ts` L78-84 | **HIGH** |
| **M03** | RTDB atomic stock decrement with compensating rollback | Per-item runTransaction() OCC; stockReverts[] for compensating rollbacks if any item fails | `index.ts` L151-188; `processTransaction.ts` L20-55 | **HIGH** |
| **M05** | Dual-database cross-transactional order placement | Three-phase Firestore+RTDB compensating transaction; no 2PC; validation → stock → wallet+ledger | `index.ts` L61-297 | **HIGH** |
| **M02** | Server-side price anti-spoofing | Module-level menu price cache (5-min TTL); server-recomputed total; reject if |diff| > Rs1 | `index.ts` L23-38, L336-349 | **MEDIUM** |
| **M04** | Auto-availability toggle at minStock | Within stock-decrement RTDB transaction: if stock <= minStock → available = false | `index.ts` L157-159; `stockService.ts` L31 | **MEDIUM** |
| **M07** | QR redemption idempotency | RTDB runTransaction() check-and-set on qrUsed flag; duplicate scan rejected atomically | `index.ts` L658-699 | **MEDIUM** |
| **M09** | Stale UPI auto-cancellation | Cloud Scheduler every 5 min; 15-min expiry; stock revert + archive + RTDB delete per stale order | `index.ts` L748-811 | **MEDIUM** |
| **M10** | Dual-mode UPI confirmation | Human verifies UPI; CF RTDB transaction atomically sets PAID + qrUsed + processing | `index.ts` L704-743 | **MEDIUM** |
| **M11** | KOT category routing to separate RTDB queues | Per-item category→counter lookup; separate kot_queue/{counterId}/{kotId} paths | `kotQueueService.ts` L143-211 | **MEDIUM** |
| **M12** | Thermal printing with local Python fallback | Local Flask/win32print primary; iframe/window.print() fallback; sequential Promise chain | `printUtils.ts` L119-151; `print_server.py` L48-96 | **MEDIUM** |
| **M17** | Dual-subscription live menu merge | Firestore onSnapshot + RTDB onValue fan-in; stock overlay on menu items | `menuService.ts` L41-93 | **MEDIUM** |
| **M23** | Kiosk multi-mode order processing | orderType: counter/external/shop; type-specific wallet/ledger/ID handling in single CF | `index.ts` L302-496 | **MEDIUM** |
| **M32** | Email→regNo auto-linking at login | registered_students/{email} Firestore lookup at first login; uid backfill | `AuthContext.tsx` L52-97 | **MEDIUM** |

---

## PART K — POTENTIAL FUTURE INVENTIVE FINGERPRINT

*NOT IMPLEMENTED — these are from the Known Unknowns section and represent possible features:*

| ID | Feature | Status | Why Potentially Interesting |
|---|---|---|---|
| U01 | sessionGuard.ts mechanism | M-UNKNOWN | Could implement session collision detection for concurrent logins |
| U02 | Session collision detection (claimSession / watchSessionCollision) | M-UNKNOWN | If implemented: concurrent login prevention with RTDB-based session claiming |
| U04 | Auto time-slot toggling based on time threshold | M-UNKNOWN | If implemented: automated meal period switching without admin action |

---

## PART L — INVENTION REALITY SUMMARY

### Provenance Count

| Category | Count |
|---|---:|
| **Implemented (M-IMPLEMENTED)** | **35** |
| Prototyped (M-PROTOTYPED) | 0 |
| Technically Designed (M-TECHNICALLY-DESIGNED) | 0 |
| Planned (M-PLANNED) | 0 |
| Conceptual (M-CONCEPTUAL) | 0 |
| Business/Product (M-BUSINESS) | 4 (descriptions within feature entries) |
| Unknown/Unverified | 10 (U01-U10, not standalone features) |

---

### What MessFloww Can Currently Prove

- All 35 features (M01-M35) exist as working code with specific file/line references
- The entire order placement pipeline (M05: dual-database compensating transaction) is implemented
- Real-time stock management with auto-depletion (M03, M04, M17) is implemented
- QR-based physical redemption with idempotency guard (M07) is implemented
- Automated stale-order cleanup and stock restoration (M09) is implemented
- Kill-switch with server-side enforcement (M01) is implemented
- UPI payment human-verification loop (M10) is implemented
- Physical thermal printing with local Python server and browser fallback (M12) is implemented
- All financial operations (wallet, ledger, deduction, archival) are server-side only (M05, M14, M27)

---

### What MessFloww Currently Cannot Prove

- That `mess_status.currentlyServing` is ever updated (U06) — this affects M06's real-world accuracy
- Whether Firestore security rules enforce ledger immutability at the database level (M27 caveat)
- Whether the multi-KOT print bug (U07) affects production printing
- What sessionGuard.ts does (U01, U02)
- Whether any automated time-slot management exists (U04)
- That the Phase 2→Phase 3 failure gap in M05 is fully handled
- Whether the archival (M26) handles partial failure (Firestore write succeeds but RTDB delete fails)

---

### What Technical Details Are Missing

1. **U06 is the most critical gap**: The wait-time estimation (M06) reads `mess_status.currentlyServing` but no write path was found. If this value is never updated, the wait time is always computed from zero, making M06 functionally broken in production.
2. **Security rules**: Firestore and RTDB security rules were not reviewed. Claims about server-side-only writes (M03, M05) rely on these rules being correctly configured.
3. **sessionGuard.ts full implementation** (U01, U02)
4. **Phase 2→3 failure compensation** in M05 (if wallet deduction fails after stock decrement)
5. **kiosk_users.csv** (U09) — authentication mechanism unclear

---

### Features That Should NOT Yet Be Used as Inventive Core

| Feature | Reason |
|---|---|
| M06 Wait-time estimation | currentlyServing write path UNKNOWN; formula is trivial arithmetic |
| M08 CSPRNG order ID | Standard security practice; not technically distinctive |
| M13 KOT retry queue | Standard retry pattern with counter |
| M14 Dual-path wallet sync | Solves a self-imposed data model problem |
| M15 Bulk batch write | Standard Firestore pattern |
| M16 Force-logout | Standard onSnapshot pattern |
| M18 IndexedDB cart | Standard PWA pattern |
| M20 Token bucket | Client-side UX only; resets on refresh |
| M27 Ledger "immutability" | Code convention only; security rules not verified |
| M28 Daily order counter | Standard Firestore OCC counter |

---

### Features That Deserve Deeper Investigation

| Feature | What to Investigate |
|---|---|
| **M05** | Failure handling between Phase 2 (stock decrement) and Phase 3 (wallet deduction) |
| **M01 + M05 combination** | The combination of kill-switch + dual-database compensating transaction is the most architecturally specific combination |
| **M03 + M04 + M09** | Stock lifecycle: decrement → threshold auto-disable → stale-order revert is a complete stock management loop |
| **U06** | Who writes `mess_status.currentlyServing`? If admin does this manually, M06's automation claim is overstated |
| **U01/U02** | sessionGuard.ts — could be a significant undocumented feature |
| **M10 + M07 combination** | The two QR redemption paths (pre-paid credit vs. UPI human-verify) and their atomicity |
