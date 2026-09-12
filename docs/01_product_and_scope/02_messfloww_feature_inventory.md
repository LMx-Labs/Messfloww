# MessFloww Technical Feature Inventory

> **Source**: Derived entirely from direct static analysis of the MessFloww codebase at
> `Messfloww-main/`. Every claim is traceable to a specific file and line number.
> No assumptions were made. Where the code is ambiguous or absent, the field is marked `[UNKNOWN]`.

---

## 1. System Overview

MessFloww is a **multi-application, Firebase-backed, campus mess management platform** designed
for use at a university-level residential mess facility (referenced in code as VIT). It replaces
paper-based order slips, manual billing, and cash collection at a mess counter by providing:

- A student-facing Progressive Web App (PWA) for digital ordering and real-time order tracking
- A kiosk terminal for counter staff to process walk-in and registered-student orders
- A kitchen display system (KDS) for kitchen staff
- An admin back-office for meal scheduling, student registry, inventory, and financial reporting

The system operates over Firebase (Firestore + Realtime Database + Cloud Functions) with a
companion local Python microservice for thermal receipt printing.

**Key technical identity markers:**
- Orders are primarily stored in Firebase Realtime Database (RTDB) during active life and archived to Firestore upon terminal state
- Stock is maintained exclusively in RTDB; canonical menu metadata lives in Firestore
- All financial mutations (wallet deductions, order creation, stock decrements) are server-side only, executed by Firebase Cloud Functions
- QR codes encode raw order IDs (`MFW-[12-hex-char]`) and are consumed at a physical kiosk scanner
- Kitchen Order Tickets (KOTs) are routed to category-specific print queues in RTDB and dispatched via a local Windows thermal printer

---

## 2. Actors

| Actor | Interface | Authentication | Unique Capabilities |
|---|---|---|---|
| **Student (Internal)** | Student Portal PWA (`apps/student-portal`) | Google Sign-In; must be pre-registered in `students/{regNo}` | Browse slot-specific menu, add to cart, pay via wallet credits or UPI, view order tracking with QR code, view order history |
| **Guest (External User)** | Student Portal PWA | Google Sign-In (not pre-registered) | Browse menu, order via UPI only; no wallet access |
| **Counter Staff / Kiosk Operator** | Kiosk Counter (`apps/kiosk-counter`) | Device-level session | Scan student QR codes, confirm UPI payments, place counter orders by reg no lookup, process guest/shop orders |
| **Kitchen Staff** | Inventory-Kitchen (`apps/inventory-kitchen`) | Firebase Auth | View live order queue on KDS, mark orders as "preparing" or "ready", trigger KOT prints, manage KOT print counters |
| **Mess Manager / Admin** | Admin HQ (`apps/admin-hq`) | Email+Password or Google Sign-In; must be in `app_config/roles.authorized_admins` array | Configure menu, time slots, student registry, wallet top-ups, kill-switch, view ledger/reports |

**Note**: Staff-level and admin-level access within Admin HQ are distinguished via an `AdminGate` component that checks the `authorized_admins` list in Firestore `app_config/roles`.

---

## 3. Architecture

### 3.1 Application Layer

| App | Framework | Port | Firebase Hosting Target |
|---|---|---|---|
| `student-portal` | Vite + React 18 + TypeScript | 5173 | `student` |
| `admin-hq` | Vite + React 18 + TypeScript | 5174 | `admin` |
| `kiosk-counter` | Vite + React 18 + TypeScript | 5175 | `kiosk` |
| `inventory-kitchen` | Vite + React 18 + TypeScript | 5176 | `kitchen` |

All four apps import shared logic from `packages/shared-core`, a local TypeScript package.

### 3.2 Backend Layer

| Component | Technology | Role |
|---|---|---|
| Firebase Cloud Functions (v2) | Node.js + TypeScript | Server-side order validation, wallet mutation, stock decrement, scheduled cleanup |
| Firebase Realtime Database | Google RTDB (asia-southeast1) | Sub-second live data: `active_orders`, `menu_stock`, `kot_queue`, `kot_counters`, `system_status`, `mess_status` |
| Cloud Firestore | Google Firestore | Persistent data: `users`, `students`, `menu`, `timeSlots`, `ledger`, `historical_orders`, `orderCounters` |
| Python Print Server | Flask + PyWin32 | Local microservice on `127.0.0.1:5000`; receives POST /print-kot and dispatches raw ESC/POS text to a Windows thermal printer |

### 3.3 Data Split Rule (RTDB vs Firestore)

**RTDB** holds data that must propagate to all clients in near-real-time (sub-second) and has a short active lifetime: active orders, live stock counts, KOT print queues, kill-switch state, mess open/closed status. RTDB client rules set `.write: false` for `active_orders` and `menu_stock` — all writes to these paths go through Cloud Functions (Admin SDK bypasses rules).

**Firestore** holds data with longer lifetimes, complex queries, or batch-write requirements: student profiles, menu catalog, financial ledger, archived orders, time slot configuration.

### 3.4 Shared Package (`packages/shared-core`)

Exports: Firebase config, type definitions (`Order`, `Student`, `MenuItem`, `TimeSlot`, `InventoryItem`), RTDB services (`orderService`, `stockService`, `messStatusService`, `presenceService`, `sessionGuard`), Firestore services (`menuService`, `timeSlotService`, `studentService`, `settingsService`, `kotQueueService`), thermal printer module (`ThermalPrinter`), utility functions (`qrParser`, `processTransaction`).

---

## 4. End-to-End Workflow

### 4.1 Credit Order (securePlaceOrder)

```
Admin opens Admin HQ
  -> activates TimeSlot -> writes Firestore: timeSlots/current { active:true, slot:{...} }
  -> writes RTDB: mess_status { isOpen:true, currentlyServing:0 }
  -> startAdminHeartbeat(): RTDB system_status/admin_online=true
     -> onDisconnect: system_status/admin_online=false

Student Portal subscribes:
  -> subscribeToActiveSlot() [Firestore real-time on timeSlots/current]
  -> subscribeToMessStatus() [RTDB real-time on mess_status]
  -> subscribeToMenu() [Firestore menu + RTDB menu_stock merged]

Student selects items -> cart (persisted via localforage/IndexedDB)
Student confirms -> calls CF: securePlaceOrder

securePlaceOrder steps:
  1. Reads RTDB system_status/admin_online -- if false, throws failed-precondition
  2. Firestore transaction:
     - Reads users/{uid} -> gets rollNo
     - Reads students/{rollNo} -> gets balance, status
     - Validates status != 'disabled'
     - Validates balance >= totalPrice
     - Reads+increments orderCounters/{today}.count
  3. Sequential RTDB transactions per cart item:
     - Reads menu_stock/{itemId}.stock
     - If stock >= qty: decrements; sets available=false if stock <= minStock
     - If any item fails: reverts all previous decrements; throws resource-exhausted
  4. Second Firestore transaction:
     - Deducts students/{rollNo}.balance and .credits by totalPrice
     - Syncs users/{uid}.walletBalance
     - Writes ledger/{docId} (type: 'purchase')
  5. Reads RTDB mess_status.currentlyServing
     - queuePosition = max(0, orderNumber - currentlyServing)
     - waitTimeSeconds = queuePosition * 3
     - estimatedServingWindow = now+wait to now+wait+180s
  6. Enriches cart items from Firestore menu cache (5-min TTL)
  7. Writes active_orders/{orderId} to RTDB
  8. Returns { orderId, orderNumber, estimatedServingWindow }

Counter staff scans QR -> calls CF: collectOrder
  -> RTDB transaction: checks qrUsed!=true, paymentStatus!=PENDING
  -> sets qrUsed=true, status='processing', scannedAt
  -> kotQueueService.routeOrderToCounters() -> RTDB kot_queue/{counterId}/{kotId}
  -> printReceiptSilent() -> POST http://localhost:5000/print-kot
```

### 4.2 UPI Order Lifecycle

```
Student selects UPI -> CF: securePlaceUpiOrder
  - Validates kill-switch, price, user status
  - Decrements RTDB stock (same pattern as credit order)
  - Creates RTDB active_orders/{id} with status='pending', paymentStatus='PENDING'

Student sees /upi-pending screen with QR code
  -> Real-time subscription to active_orders/{orderId}
  -> If paymentStatus changes to 'PAID' -> auto-navigates to /order-success

Counter staff scans QR -> needsPaymentConfirmation modal
  -> "Payment Verified" -> CF: confirmAndCollectUpiOrder
  -> RTDB transaction: sets paymentStatus='PAID', qrUsed=true, status='processing'
  -> Routes KOTs, prints receipt

cancelStalePendingOrders (Cloud Scheduler, every 5 min, Asia/Kolkata):
  - Filters: paymentStatus='PENDING' AND createdAt < now-15min
  - Per stale order:
    1. RTDB transaction: increments menu_stock/{id}.stock, sets available=true
    2. Firestore: historical_orders/{id} { status='expired', cancelReason='auto_expired_15min' }
    3. RTDB: removes active_orders/{id}
```

---

## 5. Feature Inventory

### M01 Kill-Switch via RTDB onDisconnect
- **Technical mechanism**: `startAdminHeartbeat()` sets RTDB `system_status/admin_online = true` and registers `onDisconnect(adminOnlineRef).set(false)`. Firebase executes disconnect write on TCP loss even if browser crashes.
- **Input**: Firebase `.info/connected` RTDB node
- **Output**: RTDB `system_status/admin_online` = true or false
- **System component**: `shared-core/rtdb/presenceService.ts` L5-13; `index.ts` L78-84, L329, L522
- **Automation**: Full
- **Real-world effect**: All three CFs check this flag first; orders blocked automatically when admin disconnects
- **Confidence**: HIGH

---

### M02 Server-Side Price Anti-Spoofing Validation
- **Technical mechanism**: CF reads Firestore `menu` (in-memory cache, 5-min TTL, module-level `Map`). Recomputes `serverTotal = sum(menuPrice * qty)`. Checks `|clientTotal - serverTotal| > 1`.
- **Input**: Client `cart[]` (IDs + quantities + client prices); server Firestore menu cache
- **Output**: HttpsError(invalid-argument) if mismatch > Rs1
- **System component**: `index.ts` getMenuPrices() L23-38; securePlaceKioskOrder L336-349; securePlaceUpiOrder L529-546
- **Automation**: Full
- **Real-world effect**: Prevents DevTools price manipulation to place orders at Rs0
- **Confidence**: HIGH

---

### M03 RTDB Atomic Stock Decrement with Compensating Rollback
- **Technical mechanism**: Sequential `stockRef.runTransaction(data => { if stock >= qty: decrement; else return undefined (abort) })`. Committed items stored in `stockReverts[]`. On abort: iterate `stockReverts` and run increment transactions on each.
- **Input**: `cart[]`; RTDB `menu_stock/{itemId}`
- **Output**: RTDB `menu_stock/{itemId}.stock` decremented for all items; or fully restored on failure
- **Data**: RTDB `menu_stock/{itemId}` fields: stock (number), minStock (number), available (boolean)
- **System component**: `index.ts` L151-188; `processTransaction.ts` L20-55; `stockService.ts`
- **Automation**: Full — RTDB runTransaction() provides OCC
- **Real-world effect**: Two students ordering the last item simultaneously cannot both succeed
- **Confidence**: HIGH

---

### M04 Auto-Availability Toggle on minStock Threshold
- **Technical mechanism**: Inside RTDB transaction callback: `if (currentData.stock <= (currentData.minStock || 0)) { currentData.available = false; }` Runs server-side in CF.
- **Input**: RTDB `menu_stock/{itemId}.stock`, `.minStock`
- **Output**: RTDB `menu_stock/{itemId}.available = false`
- **System component**: `index.ts` L157-159; `stockService.ts` L31; `processTransaction.ts` L29-31
- **Automation**: Full
- **Real-world effect**: Student menu stops showing depleted items automatically without manual admin action
- **Confidence**: HIGH

---

### M05 Dual-Database Cross-Transactional Order Placement
- **Technical mechanism**: Three-phase sequence: (1) Firestore transaction: validate user/balance; (2) RTDB transactions per item: decrement stock with rollback; (3) Second Firestore transaction: deduct wallet, write ledger. No distributed 2PC — compensating transactions used.
- **Input**: cart[], totalPrice, slotName, paymentMode; Firestore users/{uid}, students/{rollNo}, orderCounters/{today}; RTDB menu_stock/*, system_status/admin_online
- **Output**: RTDB active_orders/{orderId} created; Firestore students/{rollNo}.balance decremented; ledger/{id} written; orderCounters/{today}.count incremented
- **Data**: 6 Firestore collections + 2 RTDB paths
- **System component**: `index.ts` L61-297
- **Automation**: Full
- **Real-world effect**: Student cannot place an order without corresponding wallet deduction and stock reduction both succeeding
- **Confidence**: HIGH

---

### M06 Deterministic Wait-Time Estimation at Order Creation
- **Technical mechanism**: `queuePosition = max(0, orderNumber - currentlyServing)`. `waitTimeSeconds = queuePosition * 3`. `estimatedServingWindow = [now+wait, now+wait+180s]`. Formatted via `Intl.DateTimeFormat`.
- **Input**: orderNumber (from orderCounters/{today}); RTDB mess_status.currentlyServing; Date.now()
- **Output**: estimatedServingWindow string stored on RTDB active_orders/{orderId} and returned to client
- **System component**: `index.ts` L222-232; `OrderTrackingScreen.tsx` L182
- **Automation**: Full
- **NOTE**: Constant = 3 seconds per order. This is deterministic arithmetic, NOT predictive or ML.
- **Real-world effect**: Student sees a specific pickup time window (e.g., 2:15 PM - 2:18 PM)
- **Confidence**: HIGH

---

### M07 QR Code Redemption with Idempotency Guard
- **Technical mechanism**: CF collectOrder runs RTDB transaction: if order.qrUsed === true throw ORDER_ALREADY_COLLECTED; order.qrUsed = true; order.status = processing; return order;
- **Input**: orderId (from QR scan); RTDB active_orders/{orderId}
- **Output**: RTDB active_orders/{orderId}: qrUsed=true, status=processing, scannedAt=ISO timestamp
- **System component**: `index.ts` L658-699; `BarcodeScanPage.tsx` L85-117
- **Automation**: Double-collection guard is fully automatic
- **Real-world effect**: Student cannot scan the same QR code twice to receive food twice
- **Confidence**: HIGH

---

### M08 Cryptographically Generated Non-Guessable Order ID
- **Technical mechanism**: `crypto.randomUUID().replace(/-/g,'').substring(0,12).toUpperCase()` prefixed with MFW-. QR code value = raw orderId string. Backward-compat parser handles legacy MESSFLOWW|ID:...|REGNO:...|TS:... pipe format.
- **Input**: None — CSPRNG
- **Output**: e.g., MFW-A3F9C2B48E17
- **System component**: `utils/qrParser.ts` L6-9; `index.ts` L40-43
- **Automation**: Full
- **Real-world effect**: Order ID is non-guessable; QR cannot be forged by knowing a sequential number
- **Confidence**: HIGH

---

### M09 Stale UPI Order Auto-Cancellation (Cloud Scheduler)
- **Technical mechanism**: onSchedule({ schedule: every 5 minutes, timeZone: Asia/Kolkata }). Reads all RTDB active_orders. Filters: paymentStatus === PENDING AND createdAt < Date.now() - 900000ms. Per stale order: (1) RTDB transactions increment stock; (2) Firestore write historical_orders/{id} with status=expired; (3) RTDB delete active_orders/{id}.
- **Input**: RTDB active_orders/*; cutoff = Date.now() - 15min
- **Output**: RTDB active_orders/{id} removed; menu_stock incremented; Firestore historical_orders/{id} with cancelReason=auto_expired_15min
- **System component**: `index.ts` L748-811 (cancelStalePendingOrders)
- **Automation**: Full
- **Real-world effect**: Stock held by students who walked away without paying is released after 15 minutes
- **Confidence**: HIGH

---

### M10 Dual-Mode UPI Payment Confirmation
- **Technical mechanism**: confirmAndCollectUpiOrder CF: single RTDB transaction checks paymentStatus === PENDING AND qrUsed !== true, then atomically sets paymentStatus=PAID, qrUsed=true, status=processing, paidAt, scannedAt.
- **Input**: orderId; RTDB active_orders/{orderId}
- **Output**: RTDB active_orders/{orderId} updated with paid + collected state atomically
- **System component**: `index.ts` L704-743; `BarcodeScanPage.tsx` L221-252
- **Human involvement**: Counter staff presses Payment Verified after physically verifying UPI transfer
- **Automation**: Atomic DB update automatic; human judgment required for payment verification
- **Real-world effect**: Physical UPI verification by human then digital confirmation; no external payment gateway needed
- **Confidence**: HIGH

---

### M11 KOT Category-Based Routing to Separate Print Queues
- **Technical mechanism**: kotQueueService.routeOrderToCounters(order, counters, allMenuItems): per item, resolves category via allMenuItems.find(m => m.id === item.id), finds counter whose categories[] contains that category (case-insensitive). Writes RTDB kot_queue/{counterId}/{orderId}_{counterId}. Unmatched items go to kot_queue/uncategorized/.
- **Input**: order.items[]; RTDB kot_counters; Firestore menu (for category resolution)
- **Output**: RTDB kot_queue/{counterId}/{kotId} = { orderId, orderNumber, items[], status:pending, autoPrint, createdAt }
- **System component**: `services/kotQueueService.ts` L143-211
- **Automation**: Full
- **Real-world effect**: A single order with a curry and a juice generates two separate KOTs to two kitchen stations simultaneously
- **Confidence**: HIGH

---

### M12 Thermal KOT Printing with Local Fallback
- **Technical mechanism**: printReceiptSilent(): POST http://localhost:5000/print-kot. On failure, calls printReceipt() (iframe method). Both use global printQueue = Promise.resolve() chain for sequential jobs. Python server: win32print with threading.Lock(timeout=10s).
- **Input**: BillDocument object (orderNumber, userRollNo, slotName, items[])
- **Processing**: Python: 32-char wide text + ESC/POS cut \x1d\x56\x00 -> win32print.WritePrinter(). Browser fallback: ReactDOMServer.renderToString(ThermalReceipt) -> hidden iframe -> window.print().
- **Output**: Physical KOT paper on thermal printer
- **System component**: `modules/ThermalPrinter/printUtils.ts` L119-151; `tools/print_server/print_server.py` L48-96
- **Automation**: Auto-print and fallback selection both fully automatic
- **Real-world effect**: Physical paper KOT at kitchen station without needing a cloud print service
- **Confidence**: HIGH

---

### M13 KOT Queue with Retry and Failure Tracking
- **Technical mechanism**: markKOTFailed(): increments retryCount, sets status=failed. retryFailedKOTs(): finds status=failed AND retryCount < 3, resets to status=pending. clearPrintedKOTs(): bulk-deletes status=printed entries.
- **Input**: RTDB kot_queue/{counterId}/{kotId}
- **Output**: Updated RTDB kot_queue fields
- **System component**: `services/kotQueueService.ts` L85-133
- **Human involvement**: Retry trigger requires staff action; failure detection is automatic
- **Real-world effect**: A printer offline for 30 seconds does not permanently lose the KOT
- **Confidence**: HIGH

---

### M14 Student Wallet Dual-Path Synchronized Balance
- **Technical mechanism**: Balance maintained in two Firestore locations: students/{regNo}.balance (admin-facing) and users/{uid}.walletBalance (student-app-facing), updated in same transaction/batch. students/{regNo} also has .credits mirroring .balance.
- **Input**: Admin initiates top-up: walletService.topUpWalletByRegNo(regNo, amount)
- **Output**: Both Firestore paths updated; ledger/{id} written with type=topup
- **System component**: `walletService.ts` L36-63; `index.ts` L193-211
- **Automation**: Sync between two Firestore paths automated within transaction/batch
- **Real-world effect**: Student sees updated balance instantly after admin recharge without refreshing
- **Confidence**: HIGH

---

### M15 Bulk Monthly Balance Assignment (Chunked Batch Writes)
- **Technical mechanism**: assignMonthlyBalanceToAll(amount): queries students where status == active. Builds Firestore writeBatch() with two writes per student. Commits every 400 records (Firestore batch limit = 500).
- **Input**: amount (Rs integer); Firestore students where status=active
- **Output**: All active students balances set to specified amount
- **System component**: `walletService.ts` L70-122
- **Automation**: Partial — human initiates; bulk write automated
- **Real-world effect**: Monthly mess fee loading takes one click instead of N individual top-ups
- **Confidence**: HIGH

---

### M16 Student Status Watcher with Force-Logout
- **Technical mechanism**: onSnapshot(doc(db, students, regNo), snap => { if snap.data().status === disabled: toast.error(...); firebaseSignOut(auth); })
- **Input**: Firestore students/{regNo}.status (real-time)
- **Output**: Firebase Auth sign-out; user redirected to login
- **System component**: `student-portal/src/core/auth/AuthContext.tsx` L99-130
- **Automation**: Force-logout is fully automatic upon status change
- **Real-world effect**: Banned student ejected from app within seconds of admin action even if mid-session
- **Confidence**: HIGH

---

### M17 Live Menu Merged Firestore and RTDB Stock Subscription
- **Technical mechanism**: menuService.subscribeToMenu(callback) opens two simultaneous subscriptions: (1) Firestore onSnapshot on menu; (2) RTDB onValue on menu_stock. On either update, emitMenu() overrides stock/minStock/available from RTDB stockMap onto Firestore items.
- **Input**: Firestore menu (canonical); RTDB menu_stock/{itemId} (live stock)
- **Output**: Record<slotName, MenuItem[]> with live stock values
- **System component**: `services/menuService.ts` L41-93
- **Automation**: Full — both listeners push updates independently
- **Real-world effect**: When kitchen marks an item sold out, the student menu updates within milliseconds without page refresh
- **Confidence**: HIGH

---

### M18 Offline Cart Persistence via IndexedDB (localforage)
- **Technical mechanism**: offlineStorage creates three localforage instances (menu, user, cart stores in messflow DB). Cart saved on every state change via useEffect([cart]); loaded from offlineStorage.getCart() on mount.
- **Input**: React state cart[]; menu subscription payload
- **Output**: Cart persisted across page reloads
- **System component**: `shared/lib/offline/storage.ts`
- **Automation**: Full
- **Real-world effect**: Student closes browser and re-opens to find cart intact
- **Confidence**: HIGH

---

### M19 Cart Pre-Check Against Live Menu
- **Technical mechanism**: menuService.subscribeToMenu() -> builds Set<number> of current item IDs -> cart.filter(item => allIds.has(Number(item.id))) -> if filtered count < original, calls toast.warning(...)
- **Input**: Live Firestore menu; current cart state
- **Output**: Cart updated with invalid items removed; toast notification
- **System component**: `student-portal/features/ordering/CartScreen.tsx` L47-68
- **Automation**: Full
- **Real-world effect**: Prevents Unknown Item errors at checkout if admin deleted an item while student was browsing
- **Confidence**: HIGH

---

### M20 Client-Side Token Bucket Rate Limiter
- **Technical mechanism**: Module-level Map<string, TokenBucket>. tryConsume(): computes elapsed time, adds floor(elapsed/refillRateMs) tokens (capped at maxTokens), checks tokens >= 1. ORDER_RATE = { key:placeOrder, max:3, refillMs:100_000 }.
- **Input**: In-memory bucket state (resets on page refresh)
- **Output**: Boolean allow/deny; secondsUntilNextToken() for user display
- **System component**: `shared/utils/rateLimiter.ts`
- **Automation**: Full — client-side only; server validates independently
- **Real-world effect**: Reduces accidental double-submission; not a security control (resets on refresh)
- **Confidence**: HIGH

---

### M21 Active Slot Subscription with Four-Level Fuzzy Menu Matching
- **Technical mechanism**: subscribeToActiveSlot() -> Firestore onSnapshot on timeSlots/current. Menu rendered via useMemo with four-level fallback: (1) exact match; (2) includes() match; (3) prefix match (first 3 chars); (4) single-slot fallback.
- **Input**: Firestore timeSlots/current; local menuData state
- **Output**: activeItems: MenuItem[] displayed to student
- **System component**: `student-portal/features/ordering/HomeScreen.tsx` L107-152
- **Automation**: Full
- **Real-world effect**: If admin names slot Lunch and menu items have slot lunch (case mismatch), items still display
- **Confidence**: HIGH

---

### M22 Admin Kill-Switch Client-Side Enforcement
- **Technical mechanism**: RTDB onValue(ref(rtdb, system_status/admin_online), snap => setIsAdminOnline(snap.val() !== false)). Button disabled={!isAdminOnline}.
- **Input**: RTDB system_status/admin_online (boolean, real-time)
- **Output**: UI: button disabled, message shown
- **System component**: `student-portal/features/ordering/CartScreen.tsx` L38-45, L396-413
- **Automation**: Full
- **Real-world effect**: Students cannot submit orders at the UI level when admin is offline; combined with server-side CF enforcement
- **Confidence**: HIGH

---

### M23 Kiosk Multi-Mode Order Processing
- **Technical mechanism**: securePlaceKioskOrder CF receives orderType: counter | external | shop. Counter: validates student regNo, deducts wallet, writes ledger. External/Shop: only increments order counter, no student lookup. Order ID prefixes: CNT-, EXT-, SHP-.
- **Input**: cart[], slotName, orderType, paymentMode, studentRegNo (counter only)
- **Output**: RTDB active_orders/{orderId} with type-specific fields (isExternal, isCounterOrder, autoPrint)
- **System component**: `index.ts` L302-496; `kiosk-counter/features/counter/CounterOrderPage.tsx`
- **Automation**: Wallet deduction, stock decrement, ledger entry fully automated
- **Real-world effect**: Single terminal serves registered students (wallet debit), retail customers, and walk-in guests
- **Confidence**: HIGH

---

### M24 HID Barcode Scanner Input via Global keydown Buffer
- **Technical mechanism**: Global window.addEventListener(keydown, onKeyDown). Characters accumulate in bufferRef.current. 100ms debounce timer clears buffer on silence. On Enter: flush buffer to handleScan(). Scan throttle: max 1 per 1000ms.
- **Input**: Physical keyboard events from USB HID barcode scanner
- **Output**: handleScan(bufferContents) called with complete barcode string
- **System component**: `kiosk-counter/features/scan/BarcodeScanPage.tsx` L180-206
- **Automation**: Input capture and processing is automatic
- **Real-world effect**: USB scanner works without special drivers — browser captures HID keyboard events natively
- **Confidence**: HIGH

---

### M25 Student Registration Lookup at Counter
- **Technical mechanism**: getStudentByRegNo(regNo): Firestore getDoc(doc(db, students, regNo)). Result checked: status === disabled -> show error, block proceeding.
- **Input**: Registration number typed by counter staff
- **Output**: Student name, balance, status displayed; or error message
- **System component**: `kiosk-counter/features/counter/CounterOrderPage.tsx` L61-87; `studentService.ts` L159-164
- **Automation**: Lookup and validation automated
- **Real-world effect**: Counter staff verifies student identity and checks balance before placing order on their behalf
- **Confidence**: HIGH

---

### M26 Order Archival on Terminal State Transition
- **Technical mechanism**: orderService.updateOrderStatus(): on terminal status in [completed, collected, cancelled, expired, refunded]: setDoc(doc(db, historical_orders, id), { ...orderData, archivedAt }) then remove(orderRef).
- **Input**: Terminal status string; RTDB active_orders/{orderId} data
- **Output**: Firestore historical_orders/{orderId} created; RTDB active_orders/{orderId} deleted
- **System component**: `shared-core/rtdb/orderService.ts` L34-58, L72-88
- **Automation**: Archive-and-delete fully automated once status change triggered
- **Real-world effect**: RTDB stays lean (active orders only); Firestore has full historical record for auditing
- **Confidence**: HIGH

---

### M27 Immutable Financial Ledger
- **Technical mechanism**: Ledger writes happen inside the same Firestore transaction as wallet deduction (CF) or same batch as top-up (walletService). No ledger delete operations exist in the codebase.
- **Input**: Transaction type, amount, studentRegNo, orderId, serverTimestamp()
- **Output**: Firestore ledger/{autoId} document
- **System component**: `index.ts` L202-211 (purchase); `walletService.ts` L52-62 (top-up)
- **Automation**: Full
- **Real-world effect**: Auditable financial trail — every rupee movement has a server-timestamped record
- **Confidence**: HIGH

---

### M28 Daily Sequential Order Token via Firestore Transaction
- **Technical mechanism**: orderCounters/${today} Firestore doc (key = YYYY-MM-DD). Within Firestore transaction: read -> count+1 -> update. orderNumber = count + 1.
- **Input**: Firestore orderCounters/{YYYY-MM-DD}
- **Output**: orderNumber integer (e.g., 47) stored on order; counter incremented
- **System component**: `index.ts` L88-130, L404-426, L598-610
- **Automation**: Full; counter resets daily (new doc key per date)
- **Real-world effect**: KDS shows Order #47 not a UUID; kitchen staff can call out order numbers verbally
- **Confidence**: HIGH

---

### M29 Per-Item GST Calculation on Kiosk Bills
- **Technical mechanism**: totalGst = cart.reduce((sum, item) => sum + Math.round(item.price * ((item.gst || 0) / 100)) * item.quantity). In mapOrderToBill(): gstAmount = Math.round(basePrice * (gstPercentage / 100)); inclusiveRate = basePrice + gstAmount. Default gstPercentage = 5.0.
- **Input**: item.price, item.gst (from Firestore menu), item.quantity
- **Output**: GST line total on thermal receipt; inclusiveRate per item in BillDocument
- **System component**: `kiosk-counter/CounterOrderPage.tsx` L144-147; `ThermalPrinter/mapper.ts` L17-22
- **Automation**: Full
- **Real-world effect**: Kiosk receipts include GST breakdown; default rate is 5%
- **Confidence**: HIGH

---

### M30 Real-Time Admin Dashboard with Live Metrics
- **Technical mechanism**: subscribeActiveOrders() -> RTDB onValue. fetchTodayStats() -> Firestore historical_orders where createdAt >= today 00:00. Stats via useMemo: totalOrders, totalRevenue (completed only), avgOrderValue.
- **Input**: RTDB active_orders; Firestore historical_orders; Firestore students
- **Output**: Dashboard cards: todays orders, active students, revenue (Rs), avg order value (Rs)
- **System component**: `admin-hq/features/dashboard/DashboardPage.tsx` L17-100
- **Automation**: Full; active order count updates in real-time
- **Real-world effect**: Admin sees live operational metrics without refreshing
- **Confidence**: HIGH

---

### M31 Student CSV Bulk Import with Email-Keyed Sync
- **Technical mechanism**: batchReplaceStudents(students[]): Firestore writeBatch(). Per student: batch.set(doc(students, regNo), student, { merge: true }) (merge: true preserves existing uid). If email: batch.set(doc(registered_students, email.toLowerCase()), { email, regNo, name, status }, { merge: true }).
- **Input**: Parsed CSV -> Student[] array
- **Output**: Firestore students/{regNo} and registered_students/{email} created/updated
- **System component**: `shared-core/services/studentService.ts` L67-88
- **Automation**: Parsing and batch write automated
- **Real-world effect**: Admin can onboard hundreds of students in one operation
- **Confidence**: HIGH

---

### M32 Automatic Student Email-to-RegNo Account Linking
- **Technical mechanism**: onAuthStateChanged: queries registered_students where email == user.email. If found: buildRegisteredProfile() reads students/{regNo}, constructs UserProfile with userType=internal. Writes to users/{uid}. Backfills students/{regNo}.uid = user.uid if missing.
- **Input**: Firebase Auth user object (email, uid, displayName)
- **Output**: Firestore users/{uid} created; students/{regNo}.uid backfilled
- **System component**: `student-portal/src/core/auth/AuthContext.tsx` L52-97
- **Automation**: Email->regNo lookup and profile creation fully automated
- **Real-world effect**: Student does not need to type registration number; link is automatic based on institutional email
- **Confidence**: HIGH

---

### M33 KOT Auto-Print Mode on KDS
- **Technical mechanism**: autoPrint boolean persisted in localStorage. In subscribeActiveOrders callback: filters o.autoPrint && !autoPrintedOrders.current.has(o.id) -> calls printReceiptSilent(mapOrderToKOTs(order, allMenuItems), settings). autoPrintedOrders is useRef<Set<string>> to prevent re-prints on React re-renders.
- **Input**: RTDB active_orders (orders with autoPrint: true); localStorage kds_autoPrint
- **Output**: Physical KOT printed (or iframe fallback)
- **System component**: `inventory-kitchen/features/kds/KitchenDisplayPage.tsx` L28-67
- **Automation**: Full in auto mode
- **Real-world effect**: Every new student order automatically generates a kitchen ticket without staff pressing Print
- **Confidence**: HIGH

---

### M34 KOT Item Grouping by Food Category
- **Technical mechanism**: mapOrderToKOTs(order, allMenuItems): builds groups: Record<category, items[]>. Resolves category via allMenuItems.find(i => i.id === item.id). Combines identical item names within same category (sum qty). Returns one BillDocument per category with isKOT: true.
- **Input**: order.items[]; allMenuItems (merged Firestore+RTDB menu)
- **Output**: BillDocument[] — one per category, each with isKOT: true
- **System component**: `modules/ThermalPrinter/mapper.ts` L62-109
- **Automation**: Full
- **Real-world effect**: Order with curry + cold drink generates two separate KOTs to two kitchen stations
- **Confidence**: HIGH

---

### M35 KOT Counter Heartbeat and Session Tracking
- **Technical mechanism**: kotQueueService.updateCounterHeartbeat(counterId, sessionId): RTDB update() on kot_counters/{counterId} with { lastHeartbeat: ISO string, activeSessionId: sessionId }. updateCounterStatus() sets status field.
- **Input**: counterId, sessionId; triggered by counter listener app events
- **Output**: RTDB kot_counters/{counterId}.lastHeartbeat and .activeSessionId updated
- **System component**: `shared-core/services/kotQueueService.ts` L38-44; KOTControlCenterPage.tsx L157-159
- **Automation**: Full
- **Real-world effect**: Admin can see which printer stations are online from the KOT Control Center
- **Confidence**: HIGH

---

## 6. Algorithms and Computational Processes

| ID | Algorithm | Location | Detail |
|---|---|---|---|
| **A01** | Token Bucket Rate Limiter | `rateLimiter.ts` | `tokens = min(maxTokens, tokens + floor(elapsed/refillRateMs))`; consume 1 token per order |
| **A02** | Queue Position Wait Time | `index.ts` L222-232 | `queuePos = max(0, orderNumber - currentlyServing)`. `waitSec = queuePos * 3` (constant). Window = [now+wait, now+wait+180s] |
| **A03** | RTDB OCC Stock Decrement | `index.ts` L153-186 | Per-item sequential runTransaction() with compensating rollbacks |
| **A04** | Menu Price Cache with TTL | `index.ts` L20-37 | In-memory Map; `menuCacheExpiry = Date.now() + 5*60*1000`; shared across warm CF instances |
| **A05** | Fuzzy Slot-Menu Matching | `HomeScreen.tsx` L107-152 | 4-level cascade: exact -> includes -> prefix-3 -> single-slot fallback |
| **A06** | GST Calculation | `mapper.ts` L17-22 | `gstAmount = round(basePrice * gst/100)`. Inclusive rate = base + gst |
| **A07** | Daily Order Counter | `index.ts` L88-130 | Firestore transaction: read doc -> count+1 -> update |
| **A08** | Stale Order Detection | `index.ts` L753-770 | Filter: paymentStatus === PENDING AND new Date(createdAt).getTime() < Date.now() - 900000 |
| **A09** | KOT Category Grouping | `mapper.ts` L62-109 | Reduce to Record<category, items[]>; deduplication by name within category; qty summing |
| **A10** | Batch Wallet Assignment | `walletService.ts` L70-122 | Firestore batch writes in chunks <= 400 (Firestore batch limit = 500) |

---

## 7. Prediction Mechanisms

**No predictive or machine learning mechanisms are present in the codebase.**

The wait-time estimation (M06, A02) is deterministic, not predictive: it uses a fixed constant of 3 seconds per queue position. No model, no training data, no statistical inference.

The `isEnrolled` flag (AuthContext.tsx L91) is heuristic, not a prediction:
```
isEnrolled: studentData.isNightMessEnrolled === true ||
            ((studentData.balance > 0) && (studentData.status === "active"))
```

All features are rule-based or deterministic. No demand forecasting, no recommendation engine, no ML model of any kind was found.

---

## 8. Optimization Mechanisms

| ID | Mechanism | Location | What it optimizes |
|---|---|---|---|
| **OP01** | Firestore menu cache (5-min TTL) | `index.ts` L23-37 | Reduces Firestore reads per CF invocation |
| **OP02** | localforage IndexedDB for cart/menu | `storage.ts` | Reduces re-fetches; enables offline-first load |
| **OP03** | Virtual list rendering for student table | `StudentsPage.tsx` (useVirtualizer) | Prevents DOM bloat when rendering 1000+ student rows |
| **OP04** | Menu subscription 30-sec polling fallback | `HomeScreen.tsx` L77 | Ensures menu sync even if WebSocket drops |
| **OP05** | Sequential print queue | `printUtils.ts` L7-8 | Prevents overlapping thermal print jobs |
| **OP06** | autoPrintedOrders ref set | `KitchenDisplayPage.tsx` L26 | Prevents repeated auto-prints on React re-renders |
| **OP07** | Server-side menu cache shared across CF warm instances | `index.ts` L20-21 | Module-level cache reduces cold-path Firestore reads |
| **OP08** | merge: true on student batch write | `studentService.ts` L73 | Preserves uid field during CSV re-import |

---

## 9. Feedback Loops

| ID | Loop | Trigger | Effect |
|---|---|---|---|
| **FL01** | Stock -> Menu Availability | RTDB stock decrement crosses minStock -> available = false -> subscribeToMenu merge -> student menu removes item | Students stop ordering depleted items |
| **FL02** | Admin Presence -> Order Gate | Admin HQ TCP disconnect -> admin_online = false -> Student Cart + CFs block orders | Orders blocked automatically when admin disconnects |
| **FL03** | Status Change -> Force Logout | Admin sets students/{regNo}.status = disabled -> onSnapshot in AuthContext -> firebaseSignOut() | Banned student ejected within seconds |
| **FL04** | Order Status -> Student UI | KDS marks order ready -> RTDB write -> subscribeToActiveOrder in tracking screen -> stepper advances | Student sees live status progression |
| **FL05** | UPI Payment Confirmation -> Auto-Navigation | Staff confirms payment -> RTDB paymentStatus=PAID -> subscribeToOrder in UpiPendingScreen -> auto-navigate to success | Student UI self-updates without polling |
| **FL06** | KOT Print Failure -> Retry Queue | markKOTFailed() -> retryCount++, status=failed -> manual retry resets to status=pending -> counter listener re-prints | Failed KOTs persist for retry |

---

## 10. State Machines

### Order State Machine

```
[Student places credit order] -> status: ordered
[Student places UPI order]    -> status: pending (paymentStatus: PENDING)

ordered
  -> QR scanned [collectOrder CF] -> status: processing (qrUsed: true)

pending (PENDING)
  -> Staff confirms UPI [confirmAndCollectUpiOrder CF] -> status: processing (PAID, qrUsed: true)
  -> 15-min timeout [cancelStalePendingOrders scheduler] -> status: expired

processing
  -> Kitchen marks ready -> status: ready

ready
  -> finalizeCollection() -> status: collected
     -> Archived to Firestore historical_orders; removed from RTDB

Any active state:
  -> Admin rejects PENDING -> status: cancelled (stock restored)
  -> Manual terminal status -> status: completed
```

### Admin Online State Machine

```
Admin HQ loaded -> RTDB: system_status/admin_online = true
  TCP disconnect -> Firebase onDisconnect -> admin_online = false
  Admin HQ reloaded -> admin_online = true
```

### KOT State Machine

```
pushKOTToQueue -> status: pending
  -> print success -> status: printed -> clearPrintedKOTs() -> deleted
  -> print failure -> status: failed
    -> retryCount < 3 -> retryFailedKOTs() -> status: pending (loop)
    -> retryCount >= 3 -> stays failed (manual intervention)
```

---

## 11. Real-World Constraints Addressed

| Constraint | How MessFloww addresses it |
|---|---|
| No reliable internet on campus | Offline cart/menu persistence via IndexedDB; 30-sec polling fallback |
| USB HID barcode scanner at counter | Global keydown event listener with 100ms character buffer — no special driver needed |
| Windows thermal printer at counter | Local Python Flask server with win32print; browser window.print() fallback |
| Students may manipulate browser client | Server-side price recomputation; server-side stock/balance check; RTDB write rules block direct writes |
| Rush hour concurrency | RTDB atomic transactions prevent two students buying the last item |
| Student forgets to pay UPI | Auto-cancel cron at 15 minutes; stock automatically restored |
| Admin needs to leave mid-service | Kill-switch via RTDB onDisconnect auto-blocks orders |
| Multiple kitchen stations | Category-based KOT routing to separate RTDB queues per counter |
| Daily token reset for human readability | orderCounters/{date} Firestore document resets naturally each day |
| Large student list rendering | useVirtualizer from @tanstack/react-virtual for 1000+ row tables |

---

## 12. Known Unknowns (Requires Further Investigation)

| # | Unknown | Where |
|---|---|---|
| U01 | What does sessionGuard.ts implement? Exported but not traced. | `shared-core/rtdb/sessionGuard.ts` |
| U02 | Is there session collision detection? claimSession and watchSessionCollision are imported in AuthContext. | `AuthContext.tsx` L4 |
| U03 | What exactly is Night Mess / isNightMessEnrolled distinction? | `AuthContext.tsx` L91 |
| U04 | Does autoToggleEnabled + thresholdMinutes have any active implementation? No scheduled function found. | `TimeSlotsPage.tsx`; `timeSlotService.ts` L89-108 |
| U05 | What does ManualOrderModal in Admin Dashboard allow? Not fully read. | `admin-hq/features/dashboard/ManualOrderModal.tsx` |
| U06 | Who writes mess_status.currentlyServing? Read during wait-time computation but no write code found. | RTDB `mess_status.currentlyServing` |
| U07 | Is printReceiptSilent correct for multi-KOT arrays? Current code only POSTs itemsArray[0] to Python server. | `printUtils.ts` L128 |
| U08 | Report Subscriptions: email feature is commented out in CF. Is any part of ReportsPage.tsx functional? | `admin-hq/features/reports/ReportsPage.tsx` |
| U09 | kiosk_users.csv at project root — is it used for kiosk authentication? | `Messfloww-main/kiosk_users.csv` |
| U10 | sync_status: cloud field on orders — was there a previous local sync mode? | `index.ts` order object construction |

---

## 13. MessFloww Technical Fingerprint

The 15 most technically specific features that characterize MessFloww as a system:

| Rank | Feature | Key Technical Detail |
|---|---|---|
| 1 | M05 Dual-database cross-transactional order placement | Firestore + RTDB coordinated multi-step transaction with compensating rollbacks; no 2PC |
| 2 | M03 RTDB atomic stock decrement with rollback | Per-item runTransaction() with OCC; stockReverts[] compensating array |
| 3 | M01 Kill-switch via RTDB onDisconnect | Firebase TCP-loss detection auto-sets admin_online=false; enforced in all 3 CF order functions |
| 4 | M09 Stale UPI auto-cancellation (Cloud Scheduler) | every 5 minutes, Asia/Kolkata; 15-min expiry; stock revert + archive + RTDB delete per order |
| 5 | M07 QR redemption idempotency via RTDB transaction | qrUsed flag set atomically; duplicate scan rejected in same transaction |
| 6 | M17 Dual-subscription live menu merge | Firestore onSnapshot + RTDB onValue both feeding emitMenu() with merged stock overlay |
| 7 | M11 Category-based KOT routing to separate RTDB queues | Items split by category -> matched to configured counters -> separate kot_queue/{counterId}/{kotId} writes |
| 8 | M04 Auto-availability toggle at minStock threshold | Within stock-decrement RTDB transaction: if (stock <= minStock) available = false |
| 9 | M02 Server-side price anti-spoofing | Module-level Firestore menu cache (5-min TTL); |clientTotal - serverTotal| > 1 -> reject |
| 10 | M26 Order archival on terminal state transition | RTDB -> Firestore copy + RTDB delete on any terminal status; RTDB stays lean |
| 11 | M32 Automatic student email->regNo account linking | Firestore lookup in registered_students/{email} at first login; auto-backfill of uid |
| 12 | M10 Dual-mode UPI confirmation | collectOrder (pre-paid) vs confirmAndCollectUpiOrder (simultaneous confirm+collect); both RTDB transactions |
| 13 | M24 HID scanner via global keydown buffer | Character accumulation with 100ms debounce; Enter-flush; no input focus required |
| 14 | M28 Daily sequential order token via Firestore transaction | Per-day Firestore doc orderCounters/{date}; atomic read-increment; human-readable #N |
| 15 | M06 Deterministic queue-position wait time | waitSec = max(0, orderNumber - currentlyServing) * 3; 3-second-per-order constant; 180-second window |
