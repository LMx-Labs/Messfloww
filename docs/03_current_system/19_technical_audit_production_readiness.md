# MessFloww — Technical Audit for Production-Grade Multi-Mess Deployment

> **Auditor**: Senior Software Architect & Technical Auditor
> **Date**: 12 September 2026
> **Scope**: Complete codebase of the `Messfloww-main` monorepo
> **Objective**: Assess production readiness for institutional deployment at VIT supporting ~25 independently operating messes

---

## 1. Executive Summary

MessFloww is a well-structured food commerce platform built as a **pnpm monorepo** with four frontend applications (Student Portal, Admin HQ, Kiosk Counter, Inventory Kitchen), a shared core library, and Firebase Cloud Functions as the server-side backend. The system uses a **dual-database architecture** — Firebase Realtime Database (RTDB) for low-latency operational data and Firestore for persistent transactional/financial records.

### What Works Well

The system has several technically sophisticated components:

1. **ARCH-B Transaction Engine** — A two-phase commit pattern with inventory leasing, fence tokens, journal-based recovery, and a background reconciler. This is the single most advanced piece of the codebase and is architecturally sound for single-mess operation.
2. **Server-side price validation** — All Cloud Functions validate prices against the Firestore menu, preventing client-side price spoofing.
3. **Idempotent order placement** — `securePlaceOrder` uses idempotency keys and intent-based state machines to prevent duplicate orders.
4. **Session collision detection** — Prevents concurrent logins from the same student account.
5. **Monorepo with shared types** — `@messflow/shared-core` provides type safety and code reuse across all four apps.

### Critical Deficiency

> **⚠️ CAUTION:**
> **The entire system is designed as a single-mess application.** There is no concept of a `messId`, `tenantId`, or any isolation boundary anywhere in the data model, security rules, Cloud Functions, or frontend code. Every collection, RTDB path, and Cloud Function operates on a single flat namespace. This is the single most important architectural limitation and affects every subsection of this audit.

### Bottom Line

The current system is a **functional single-mess MVP** with an above-average transaction safety model. However, it requires a **fundamental architectural rework** to support multi-mess operations, and several categories of features (wallets, night mess, paid mess, outsider payments) are either absent or rudimentary.

---

## 2. Current Architecture

### 2.1 High-Level Topology

```
┌─────────────────────────── Frontend Apps (React + Vite + TailwindCSS) ───────────────────────────┐
│                                                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  Student Portal   │  │    Admin HQ      │  │  Kiosk Counter   │  │ Inventory Kitchen │          │
│  │  React 18/Vite 6  │  │  React 18/Vite 6 │  │  React 18/Vite 6 │  │  React 18/Vite 6  │          │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘          │
│           └──────────────────────┼──────────────────────┼──────────────────────┘                   │
│                                  ▼                      │                                          │
│                     @messflow/shared-core                │                                          │
│                 (Firebase Config, Types, Services)       │                                          │
└──────────────────────────────────┬──────────────────────┘                                          │
                                   │                                                                 │
┌──────────────────────────── Firebase Backend ──────────────────────────────────────────────────────┘
│                                                                                                    │
│  ┌────────────────────────────────────┐  ┌────────────────────┐  ┌────────────────────┐           │
│  │       Cloud Functions (Node 22)    │  │     Firestore      │  │    Realtime DB     │           │
│  │  securePlaceOrder                  │  │  (Persistent,      │  │  (Low-latency,     │           │
│  │  securePlaceKioskOrder             │  │   financial)       │  │   operational)     │           │
│  │  securePlaceUpiOrder               │  └────────────────────┘  └────────────────────┘           │
│  │  collectOrder                      │                                                            │
│  │  confirmAndCollectUpiOrder         │  ┌────────────────────┐  ┌────────────────────┐           │
│  │  cancelStalePendingOrders          │  │   Firebase Auth    │  │  Firebase Hosting  │           │
│  │  reconcileIncompleteIntents        │  │  (Google + Email)  │  │  (4 site targets)  │           │
│  └────────────────────────────────────┘  └────────────────────┘  └────────────────────┘           │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘

External Tools:
  ┌──────────────────────┐  ┌──────────────────────┐
  │ Print Server (Flask) │  │ Kiosk Launcher (.bat) │
  └──────────────────────┘  └──────────────────────┘
```

### 2.2 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend Framework | React | 18.3.1 |
| Build Tool | Vite | 6.3.5 |
| CSS Framework | TailwindCSS | 4.1.12 |
| UI Components | Radix UI + shadcn/ui + MUI | Various |
| Router | React Router | 7.13.0 |
| Animations | Motion (Framer Motion) | 12.23.24 |
| State Management | React Context | (built-in) |
| Backend-as-a-Service | Firebase | 12.11–12.12 |
| Cloud Functions Runtime | Node.js | 22 |
| Cloud Functions SDK | firebase-functions | 5.x |
| Admin SDK | firebase-admin | 12–13.x |
| Package Manager | pnpm | ≥9 |
| Monorepo | pnpm workspaces | — |
| Print Server | Python/Flask | 3.x |

### 2.3 Folder Structure

```
Messfloww-main/
├── apps/
│   ├── student-portal/       # Student-facing PWA
│   │   ├── src/
│   │   │   ├── core/          # App.tsx, Auth, Layout, UI (shadcn)
│   │   │   ├── features/      # ordering/, orders/, profile/, staff/
│   │   │   ├── shared/        # hooks, utils, offline storage
│   │   │   └── styles/
│   │   └── public/
│   ├── admin-hq/              # Admin/Manager dashboard
│   │   ├── src/
│   │   │   ├── app/           # App.tsx, modules (ThermalPrinter), utils
│   │   │   ├── core/          # Auth, Layout, UI (shadcn)
│   │   │   ├── features/      # dashboard/, finance/, menu/, reports/, settings/, students/, timeslots/
│   │   │   ├── imports/
│   │   │   └── styles/
│   │   └── functions/         # Firebase Cloud Functions
│   │       └── src/index.ts   # 1,367 lines — ALL server logic in one file
│   ├── kiosk-counter/         # Barcode scanner + counter POS
│   │   └── src/
│   │       ├── core/          # Auth (anonymous), Layout
│   │       ├── features/      # counter/, external/, scan/, shop/
│   │       └── hooks/         # useOfflineQueue
│   └── inventory-kitchen/     # KDS, KOT, Live Orders
│       └── src/
│           ├── core/          # Auth (hardcoded), Layout, OrderContext
│           ├── features/      # counter/, kds/, kot/, orders/
│           └── services/      # kotQueueService (local copy)
├── packages/
│   └── shared-core/           # Shared library consumed by all apps
│       └── src/
│           ├── firebaseConfig.ts
│           ├── types.ts
│           ├── formatters.ts
│           ├── transactions/   # processTransaction.ts
│           ├── rtdb/           # orderService, stockService, messStatusService, presenceService, sessionGuard
│           ├── services/       # menuService, studentService, settingsService, timeSlotService, kotQueueService
│           ├── modules/        # ThermalPrinter
│           └── utils/          # qrParser
├── tools/
│   ├── kiosk_launcher/        # start_kiosk.bat
│   └── print_server/          # Python Flask thermal print server
├── docs/                      # Patent/invention documentation (18 docs)
├── anchor docd/               # Anchor documents
├── firebase.json              # Multi-site hosting config
├── firestore.rules            # Security rules
├── database.rules.json        # RTDB security rules
├── pnpm-workspace.yaml
└── package.json               # Root workspace
```

---

## 3. Existing Modules

### 3.1 Student Portal (`apps/student-portal`)

| Screen | Route | Purpose |
|--------|-------|---------|
| LoginScreen | `/` | Google OAuth login |
| HomeScreen | `/home` | Menu browsing, meal selection, cart |
| CartScreen | `/cart` | Order review, payment (credit/UPI) |
| OrderSuccessScreen | `/order-success` | Confirmation + QR code |
| UpiPendingScreen | `/upi-pending` | UPI payment confirmation wait |
| OrderTrackingScreen | `/order-tracking/:orderId` | Real-time order status |
| ProfileScreen | `/profile` | Wallet balance, profile info |
| OrderHistoryScreen | `/order-history` | Past orders from Firestore |
| StaffDashboardScreen | `/staff` | Staff-level dashboard (unclear role gating) |

**Key Components**: MenuItem.tsx, CartPreview, OfflineIndicator, EmptyState, InstallPromptBanner

**Notable**: Has PWA support via `vite-plugin-pwa`, offline profile caching via `localforage`.

### 3.2 Admin HQ (`apps/admin-hq`)

| Feature Area | Files | Purpose |
|-------------|-------|---------|
| Dashboard | DashboardPage, ManualOrderModal | Live order management, barcode scanning |
| Menu Management | MenuPage, MenuContext | CRUD for menu items by slot |
| Student Management | StudentsPage, StudentContext, studentService | CSV import, CRUD, wallet ops |
| Finance | LedgerPage, PassbookPage, financeService | Ledger entries, historical orders |
| Reports | ReportsPage, 8 sub-components, reportEngine, reportExporter | Sales, food tally, inventory, trends, wallets, insights, operational |
| Time Slots | TimeSlotsPage, TimeSlotContext, slotCloseService | Meal slot activation/deactivation |
| Settings | SettingsPage, settingsService | Roles, passwords, app config |

**Notable**: Has a ThermalPrinter module duplicated from shared-core, CSV parser, QR parser, rate limiter.

### 3.3 Kiosk Counter (`apps/kiosk-counter`)

| Feature | Route | Purpose |
|---------|-------|---------|
| KioskLayout | `/` | Tab-based layout: Scan, Counter, External |
| BarcodeScanPage | (tab) | QR code scanning for student orders |
| CounterOrderPage | (tab) | In-person counter orders with student lookup |
| ExternalOrderPage | (tab) | Guest/external orders |
| ShopOrderPage | (tab) | Shop item ordering |

**Auth**: Anonymous Firebase authentication — no role enforcement.

### 3.4 Inventory Kitchen (`apps/inventory-kitchen`)

| Feature | Route | Purpose |
|---------|-------|---------|
| LiveOrdersPage | `/dashboard` | Real-time active order list |
| KitchenDisplayPage | `/kds` | Kitchen Display System |
| KOTControlCenterPage | `/kot` | KOT queue management |
| CounterListenerPage | `/counter` | Counter-specific KOT listener |

**Auth**: **HARDCODED** — no actual authentication. Uses static `{ uid: "kitchen_user", email: "kitchen@messflow.local" }`.

### 3.5 Cloud Functions (`apps/admin-hq/functions/src/index.ts`)

| Function | Type | Purpose |
|----------|------|---------|
| `securePlaceOrder` | `onCall` | ARCH-B student credit order with 2PC inventory + wallet |
| `securePlaceKioskOrder` | `onCall` | Counter/External/Shop orders |
| `securePlaceUpiOrder` | `onCall` | UPI-based orders (internal + external) |
| `collectOrder` | `onCall` | Atomic QR scan → mark collected |
| `confirmAndCollectUpiOrder` | `onCall` | UPI confirm + collect in single transaction |
| `cancelStalePendingOrders` | Scheduled (5 min) | Auto-cancel PENDING UPI orders > 15 min |
| `reconcileIncompleteIntents` | Scheduled (1 min) | ARCH-B reconciler for stuck transaction intents |

### 3.6 External Tools

| Tool | Technology | Purpose |
|------|-----------|---------|
| `tools/print_server/print_server.py` | Python/Flask | Local thermal receipt printer bridge |
| `tools/kiosk_launcher/start_kiosk.bat` | Batch script | Launches kiosk in Chrome kiosk mode |

---

## 4. Existing Database Schema

### 4.1 Firestore Collections

| Collection | Document Key | Critical Fields | Purpose |
|-----------|-------------|----------------|---------|
| `users` | `{uid}` | email, name, rollNo, walletBalance, userType, status, isEnrolled, photoURL, activeSessionId, createdAt | Student/guest profiles |
| `students` | `{regNo}` | id, name, email, regNo, phone, balance, credits, status, uid, isNightMessEnrolled | Student enrollment records |
| `registered_students` | `{email}` | email, regNo, name, status | Email → regNo lookup index |
| `menu` | `{itemId}` | id, name, price, available, isVeg, category, stock, initialStock, minStock, lowStockAlert, slot, gst, isMRP, cost, quantityUnit, servingSize | Menu item definitions |
| `historical_orders` | `{orderId}` | (Same as Order type + archivedAt, cancelReason, cancelledAt) | Archived/completed orders |
| `ledger` | `{auto-id}` | type, studentRegNo, studentUid, amount, orderId, intentId, timestamp, description | Immutable financial audit trail |
| `orderCounters` | `{YYYY-MM-DD}` | count, date | Daily order number sequence |
| `timeSlots` | `config`, `current`, `settings` | slots[], active, slot, thresholdMinutes, autoToggleEnabled | Meal timing configuration |
| `settings` | `global` | (arbitrary) | App-wide settings |
| `app_config` | `roles`, `passwords` | authorized_admins[], manager_email, staff_email, actionPassword, staffPassword | Auth config |
| `transaction_intents` | `{intentId}` | intentId, orderId, userId, userRollNo, cart[], totalPrice, slotName, paymentMode, state, leaseExpiresAt, journal{}, orderNumber, estimatedServingWindow, errorMessage, createdAt, updatedAt, reconciledAt | ARCH-B transaction state machine |

### 4.2 Realtime Database Paths

| Path | Purpose | Notes |
|------|---------|-------|
| `active_orders/{orderId}` | Live orders (hot path) | Core of real-time order flow |
| `menu_stock/{itemId}` | Real-time inventory stock | Contains stock, reserved, minStock, available, activeLeases |
| `kot_queue/{counterId}/{kotId}` | Kitchen Order Ticket queue | Per-counter print queue |
| `kot_counters/{counterId}` | KOT counter registration | Counter metadata |
| `system_status/admin_online` | Admin presence boolean | Kill switch for order placement |
| `mess_status` | isOpen, currentlyServing | Mess operating status |
| `sessions/{uid}` | Session tracking | Not actively used |
| `users/{uid}/current_session_id` | Session collision detection | Used by sessionGuard |

### 4.3 Firestore Composite Indexes

Defined in `apps/admin-hq/firestore.indexes.json`:

- `historical_orders`: userId + createdAt (desc)
- `historical_orders`: userRollNo + createdAt (desc)
- `historical_orders`: userId + status + createdAt (desc)
- `historical_orders`: userRollNo + status + createdAt (desc)

> **⚠️ WARNING: Missing indexes**: `transaction_intents` needs composite index on `state` + `leaseExpiresAt` for the reconciler query. The `ledger` collection has no indexes for date-range queries used in reports.

### 4.4 Multi-Mess Isolation Assessment

> **⛔ Status: ABSENT**
>
> - No `messId` field exists on ANY collection or RTDB path.
> - All RTDB paths (`menu_stock/`, `active_orders/`, `kot_queue/`) are flat — a single global namespace.
> - All Firestore collections (`menu`, `students`, `ledger`, `historical_orders`) are flat.
> - The Cloud Functions operate on a single RTDB database and a single Firestore database.
> - There is no tenant isolation, namespace prefixing, or per-mess partitioning of any kind.

### 4.5 Financial Data Mutability

| Data | Immutable? | Assessment |
|------|-----------|------------|
| `ledger` entries | ✅ Yes | Write-only by Cloud Functions; no update/delete exposed |
| `transaction_intents` | ⚠️ Partially | State transitions are append-forward-only, but field updates are in-place |
| `students.balance` | ❌ No | Overwritten directly via `topUpWalletByRegNo` (uses batch.set, not append) |
| `historical_orders` | ⚠️ Partially | Archived immutably, but can be deleted via `deleteStudentCompletely` |

### 4.6 Transaction Idempotency

| Flow | Idempotent? | Mechanism |
|------|------------|-----------|
| `securePlaceOrder` | ✅ Yes | Intent ID acts as idempotency key; `intentRef.create()` fails on duplicate |
| `securePlaceKioskOrder` | ❌ No | No idempotency key; each call creates a new order |
| `securePlaceUpiOrder` | ❌ No | No idempotency key; no transaction intent tracking |
| `collectOrder` | ✅ Yes | RTDB transaction checks `qrUsed` flag atomically |
| Wallet top-up | ❌ No | Uses `batch.set` with merge; not idempotent |

---

## 5. Existing User Roles

| Role | Auth Method | Source | Verified In |
|------|------------|--------|-------------|
| **Student (Internal)** | Google OAuth | `registered_students` email lookup → `students` collection | `apps/student-portal/src/core/auth/AuthContext.tsx` |
| **Guest (External)** | Google OAuth | Not found in `registered_students` | `apps/student-portal/src/core/auth/AuthContext.tsx` L222-238 |
| **Manager** | Email/Password or Google OAuth | Hardcoded emails + `app_config/roles.manager_email` | `apps/admin-hq/src/core/auth/AuthContext.tsx` |
| **Staff** | Email/Password or Google OAuth | `app_config/roles.authorized_admins` + `roles.staff_email` | `apps/admin-hq/src/core/auth/AuthContext.tsx` |
| **Kiosk** | Anonymous Firebase Auth | Automatic anonymous sign-in | `apps/kiosk-counter/src/core/auth/AuthContext.tsx` |
| **Kitchen** | **NONE (Hardcoded)** | Static object `{ uid: "kitchen_user" }` | `apps/inventory-kitchen/src/core/auth/AuthContext.tsx` |

### Role Granularity Issues

- **Manager vs. Staff**: Only the admin dashboard distinguishes these. The `setRoleOverride` function at `admin-hq AuthContext.tsx L170-172` allows any authenticated admin to **override their own role to manager** — this is a privilege escalation vulnerability.
- **No mess-specific roles**: There is no concept of "Admin of Mess A" vs. "Admin of Mess B."
- **No institutional super-admin**: The hardcoded `lakshya.pms@gmail.com` and `samnagar@gmail.com` serve as de facto super-admins, but this is embedded in both Firestore security rules AND client-side code.

---

## 6. Existing Business Workflows

### 6.1 Mess Selection

> **Status: NOT IMPLEMENTED**
>
> Students are **not presented with a mess selection UI**. The system assumes a single mess. All menu items, time slots, and inventory belong to one global namespace.

### 6.2 Order Flow (Credit — Internal Student)

```
Student App                      securePlaceOrder CF              Firestore            RTDB
    │                                    │                           │                   │
    ├──placeOrder(cart,price,slot)───────►│                           │                   │
    │                                    ├──Validate user, student──►│                   │
    │                                    ├──Server-side price check─►│                   │
    │                                    ├──Create intent(INIT)────►│                   │
    │                                    ├──acquireRtdbLeases──────────────────────────►│
    │                                    ├──Update intent(RESERVED)─►│                   │
    │                                    ├──runTransaction:          │                   │
    │                                    │   debit wallet            │                   │
    │                                    │   write ledger            │                   │
    │                                    │   intent→FIN_COMMITTED───►│                   │
    │                                    ├──commitRtdbLeases(fence)─────────────────────►│
    │                                    ├──Set active_orders/{id}──────────────────────►│
    │                                    ├──intent→COMMITTED────────►│                   │
    │◄──{orderId, orderNumber}───────────┤                           │                   │
```

### 6.3 Order Flow (UPI — Internal or External)

```
Student App                     securePlaceUpiOrder CF              RTDB
    │                                    │                            │
    ├──placeUpiOrder(cart,price,slot)────►│                            │
    │                                    ├──Validate prices, user     │
    │                                    ├──Decrement stock (per-item)─────────────────►│
    │                                    ├──Set active_orders (PENDING)─────────────────►│
    │◄──{orderId, orderNumber}───────────┤                            │
    │                                    │                            │
    │ (Student shows QR to staff)        │                            │
    │                                    │                            │
    ├──confirmAndCollectUpiOrder────────►│                            │
    │                                    ├──RTDB tx: PAID+processing+qrUsed────────────►│
    │◄──{success}────────────────────────┤                            │
```

### 6.4 Kiosk Order Flow

Three sub-flows in `securePlaceKioskOrder`: Counter (student wallet debit), External (cash/UPI), Shop (cash/UPI). No ARCH-B transaction intents — simpler per-item stock decrements with manual revert on failure.

### 6.5 Enrollment Handling

- **Status**: Students are enrolled by admin via CSV upload (`batchReplaceStudents` in `shared-core/services/studentService.ts` L67-88) or individual add.
- The `registered_students` collection serves as a whitelist. When a Google user logs in, their email is checked against this collection.
- External users bypass this check and get a `userType: "external"` profile.
- There is a **real-time registration watcher** (`student-portal AuthContext.tsx` L241-271) that auto-upgrades an external user to internal when an admin registers their email.

### 6.6 Wallet System

| Capability | Status | Notes |
|-----------|--------|-------|
| Wallet balance | ✅ Implemented | Stored in `students.balance` + `users.walletBalance` (dual-write) |
| Credit deduction | ✅ Implemented | Atomic via Firestore `runTransaction` in Cloud Functions |
| Top-up | ✅ Implemented | Admin-only via `walletService.topUpWalletByRegNo` |
| Monthly balance reset | ✅ Implemented | `assignMonthlyBalanceToAll` |
| Refund on failure | ✅ Implemented | `refundStudentWallet` in Cloud Functions |
| Real-time balance sync | ✅ Implemented | `onSnapshot` watcher on `students/{regNo}` |
| Student-initiated top-up | ❌ Missing | No payment gateway integration |
| Transfer between students | ❌ Missing | — |
| Per-mess wallet scoping | ❌ Missing | Single global wallet |

### 6.7 Features NOT Implemented

| Feature | Status |
|---------|--------|
| Night mess | ❌ **Missing** — `isNightMessEnrolled` field exists on Student type but is **never checked** in any ordering flow |
| Special/paid mess | ❌ **Missing** — No concept of mess categories or differential pricing |
| Per-mess menus | ❌ **Missing** — Single global menu |
| Per-mess inventory | ❌ **Missing** — Single `menu_stock/` namespace |
| Per-mess operating rules | ❌ **Missing** — Single global `timeSlots` config |
| Outsider direct payments | ⚠️ **Partial** — External users can place UPI orders, but no UPI gateway verification exists; payment is trusted on admin scan |
| Central institutional admin | ❌ **Missing** — No super-admin portal for cross-mess oversight |

---

## 7. Existing Transaction Flow — Detailed Trace

### 7.1 `securePlaceOrder` (Credit Path — ARCH-B)

**File**: `apps/admin-hq/functions/src/index.ts` L368-798

**Phase 1: Validation (L371–L600)**
1. Auth check → kill-switch (admin_online) → server-side price validation
2. User/student existence and status check
3. Daily counter pre-read
4. Transaction intent creation (`intentRef.create()` — atomic TOCTOU gate)
5. Balance pre-check (optimistic, non-binding)

**Phase 2: Inventory Reservation (L602–L618)**
1. `acquireRtdbLeases()` — per-item RTDB transactions with OCC, lazy lease reclamation, fence token generation
2. Intent updated → `RESERVED`

**Phase 3: Financial Commit (L620–L671)**
1. Firestore `runTransaction`:
   - Live balance re-read inside transaction (TOCTOU elimination)
   - Wallet debit
   - Ledger entry creation
   - Intent updated → `FINANCIALLY_COMMITTED`

**Phase 4: Order Dispatch (L673–L725)**
1. `commitRtdbLeases()` — validates fence token, removes active leases
2. Write `active_orders/{orderId}` to RTDB
3. Intent updated → `COMMITTED`

**Catch Handler (L729–L797)**
- If `FINANCIALLY_COMMITTED` but dispatch failed → attempts forward recovery with fencing
- If forward recovery fails → refunds wallet via `refundStudentWallet`
- If money not debited → releases RTDB leases, cancels intent

### 7.2 Recovery: `reconcileIncompleteIntents`

**File**: `apps/admin-hq/functions/src/index.ts` L1330-1365

- Runs every 1 minute
- Queries `transaction_intents` where state ∈ {INITIALIZED, RESERVED, FINANCIALLY_COMMITTED} AND `leaseExpiresAt ≤ now`
- Limit: 50 per sweep
- Delegates to `reconcileIntent()` which applies forward or backward recovery based on journal flags

---

## 8. Critical Risks

### RISK-01: Single-Mess Architecture (Severity: BLOCKER)

Every data path is a flat namespace. A multi-mess deployment would cause:
- All 25 messes sharing one menu, one inventory, one order queue
- Students seeing all orders from all messes
- Kitchen displays showing orders from other messes
- Financial records co-mingling across messes

### RISK-02: Kitchen App Has No Authentication (Severity: CRITICAL)

`inventory-kitchen/src/core/auth/AuthContext.tsx` uses a hardcoded user object. Anyone with the URL can access the kitchen display and all active orders.

### RISK-03: Kiosk Anonymous Auth Bypasses Security Rules (Severity: HIGH)

The kiosk uses `signInAnonymously()` which satisfies `isAuth()` in Firestore rules but NOT `isStaff()`. However, `orderCounters` allows `read, write: if isAuth()` (`firestore.rules` L85-87), and the RTDB allows broad writes to `kot_queue` and `mess_status` from any authenticated user.

### RISK-04: Role Override Vulnerability (Severity: HIGH)

`admin-hq/src/core/auth/AuthContext.tsx` L170-172: `setRoleOverride` is exposed in the context. A staff member can call this from the browser console to elevate to manager.

### RISK-05: Hardcoded Super-Admin Emails (Severity: HIGH)

The emails `lakshya.pms@gmail.com` and `samnagar@gmail.com` are hardcoded in:
- `firestore.rules` L21-22
- `database.rules.json` L34
- `admin-hq/src/core/auth/AuthContext.tsx` L55-56, L70, L77

This is not scalable for 25 messes and creates a single point of control.

### RISK-06: Kiosk Order Not Idempotent (Severity: MEDIUM-HIGH)

`securePlaceKioskOrder` has no idempotency key. Network retries or double-taps can produce duplicate orders and duplicate wallet debits.

### RISK-07: UPI Payment Verification is Trust-Based (Severity: MEDIUM)

No actual UPI gateway integration exists. When a UPI order is placed, the system trusts the admin/kiosk staff to verify payment visually before scanning. This is vulnerable to social engineering and staff error.

### RISK-08: Wallet Top-Up Overwrites Balance (Severity: MEDIUM)

`walletService.topUpWalletByRegNo` (L37-41) uses `batch.set(studentRef, { balance: amount }, { merge: true })` — this **sets** the balance to the amount, not **adds** to it. This is a design choice (admin sets absolute balance), but combined with no idempotency, concurrent calls can produce incorrect balances.

### RISK-09: `processTransaction.ts` is Dead Code (Severity: LOW)

`shared-core/src/transactions/processTransaction.ts` is superseded by the ARCH-B lease system in Cloud Functions but is still exported and importable. This is confusing and could be mistakenly used.

### RISK-10: `assignMonthlyBalanceToAll` Has Batch Limit Bug (Severity: LOW)

`walletService.ts` L113-117: The code commits the batch at count 400 but continues adding to the same committed batch. This will fail for >400 students.

---

## 9. Scalability Risks

### Assessment Against Target: 25 Messes × 1,000 Orders/Hour/Mess

| Dimension | Current Capacity | Target | Gap |
|-----------|-----------------|--------|-----|
| **Messes** | 1 | 25 | No multi-tenancy |
| **Concurrent Orders** | ~100/hr (untested) | 25,000/hr | RTDB single-node + Cloud Functions cold starts |
| **RTDB active_orders** | Single flat node | 25 partitioned queues | `subscribeActiveOrders` downloads ALL orders on every change |
| **RTDB menu_stock** | Single flat node | 25 isolated stock namespaces | OCC contention under high concurrency on popular items |
| **Firestore writes** | ~500 writes/min free tier | ~25,000+ writes/hr | Needs Blaze plan provisioning |
| **Cloud Functions** | Cold start ~3-5s, 1 instance | Auto-scales, but single region | Long sequential awaits in `securePlaceOrder` (5+ RTDB transactions + 1 Firestore transaction per call) |
| **KOT Queue** | Per-counter via RTDB | All counters share one RTDB instance | Acceptable at RTDB scale |

### Specific Bottlenecks

1. **`subscribeActiveOrders`** (`shared-core/rtdb/orderService.ts` L16-31): Downloads the ENTIRE `active_orders` node on any change. With 25 messes × 50 concurrent active orders = 1,250 orders downloaded on every single status update.

2. **Sequential RTDB leases**: `acquireRtdbLeases` processes items **sequentially** in a `for` loop. A cart with 5 items makes 5 serial RTDB transactions. Under OCC contention, each may retry multiple times.

3. **Daily counter single-document contention**: `orderCounters/{YYYY-MM-DD}` is a **single Firestore document** updated by every order. Firestore limits a single document to ~1 write/second. At 25K orders/hour, this is a hard blocker.

4. **Menu price cache**: Server-side menu cache has a 5-minute TTL shared across warm CF instances. Menu changes take up to 5 minutes to propagate — acceptable for single mess, problematic if 25 messes need independent menu updates.

5. **No horizontal partitioning**: No sharding, no per-mess RTDB instances, no sub-collections for isolation.

---

## 10. Security Risks

| Risk | Severity | Location | Detail |
|------|---------|----------|--------|
| Kitchen app has zero authentication | CRITICAL | `inventory-kitchen/src/core/auth/AuthContext.tsx` | Hardcoded `kitchen_user` — no RTDB/Firestore rules protect kitchen-specific operations |
| `setRoleOverride` allows privilege escalation | HIGH | `admin-hq/src/core/auth/AuthContext.tsx` L170 | Staff can self-promote to manager via console |
| `orderCounters` writable by any authenticated user | HIGH | `firestore.rules` L85-87 | A malicious student could tamper with order numbering |
| RTDB `kot_queue` and `mess_status` writable by any auth user | HIGH | `database.rules.json` L22, L39 | Any authenticated user can push fake KOTs or flip mess open/closed |
| Passwords stored as base64, not hashed | MEDIUM | `shared-core/services/settingsService.ts` L48-56 | `actionPassword` and `staffPassword` use `btoa` encoding, trivially reversible |
| Hardcoded super-admin emails in security rules | MEDIUM | `firestore.rules` L21-22 | Not maintainable at institutional scale |
| No CORS restriction on Cloud Functions | LOW | Cloud Functions defaults | `onCall` functions accept requests from any origin |
| No rate limiting on Cloud Functions | MEDIUM | All `onCall` functions | A script could spam `securePlaceOrder` |
| `menu` collection publicly readable | LOW | `firestore.rules` L61-63 | `allow read: if true` — no auth required for menu reads |

---

## 11. Missing Capabilities

| Capability | Required For | Status |
|-----------|-------------|--------|
| Multi-mess data model (`messId` everywhere) | 25 messes | ❌ Missing |
| Per-mess admin roles and RBAC | Mess isolation | ❌ Missing |
| Central institutional admin portal | Cross-mess oversight | ❌ Missing |
| Per-mess menu management | Independent operations | ❌ Missing |
| Per-mess inventory isolation | Independent operations | ❌ Missing |
| Per-mess time slot configuration | Independent scheduling | ❌ Missing |
| Night mess enrollment and gating | Night operations | ❌ Missing (field exists but unused) |
| Special/paid mess pricing mode | Differential pricing | ❌ Missing |
| UPI/payment gateway integration | Real payment verification | ❌ Missing |
| Student wallet self-top-up | Student autonomy | ❌ Missing |
| Per-mess wallet scoping | Financial isolation | ❌ Missing |
| Outsider direct cash/card payment | Non-student commerce | ⚠️ Partial |
| Kiosk order idempotency | Reliability | ❌ Missing |
| UPI order idempotency | Reliability | ❌ Missing |
| Monitoring / APM | Production ops | ❌ Missing |
| Structured logging | Debugging | ⚠️ Partial (uses `functions.logger`, no correlation IDs) |
| Error reporting (Sentry/Crashlytics) | Production ops | ❌ Missing |
| Backup strategy | Disaster recovery | ❌ Missing |
| CI/CD pipeline | Deployment automation | ❌ Missing |
| Automated testing | Code quality | ❌ Missing (test dir exists but empty) |
| Load testing results | Capacity planning | ❌ Missing |

---

## 12. Recommended Architecture Changes

### 12.1 Multi-Tenancy Strategy

Every RTDB path and Firestore collection must be scoped by `messId`:

```
// RTDB (option A: prefix-based)
messes/{messId}/active_orders/{orderId}
messes/{messId}/menu_stock/{itemId}
messes/{messId}/kot_queue/{counterId}/{kotId}
messes/{messId}/mess_status

// Firestore (option B: sub-collections under mess documents)
messes/{messId}/menu/{itemId}
messes/{messId}/orders/{orderId}
messes/{messId}/ledger/{entryId}
messes/{messId}/students/{regNo}     // enrollment per mess
```

### 12.2 RBAC Overhaul

Replace hardcoded email checks with a claims-based or document-based RBAC:

```typescript
// Firestore: admin_roles/{uid}
{
  role: "mess_admin" | "institutional_admin" | "staff" | "kitchen",
  messId: "mess_vit_anna",  // null for institutional admin
  permissions: ["manage_menu", "manage_students", "manage_finance", ...]
}
```

Firebase Custom Claims should be used to embed `messId` and `role` into the auth token, making security rules enforceable without extra reads.

### 12.3 Order Counter Sharding

Replace the single `orderCounters/{date}` document with per-mess sharded counters to avoid the 1 write/sec limit:

```
orderCounters/{messId}_{date}_{shardId}
```

### 12.4 Cloud Function Decomposition

The 1,367-line monolith should be split into domain-specific modules:
- `orders/securePlaceOrder.ts`
- `orders/securePlaceKioskOrder.ts`
- `orders/securePlaceUpiOrder.ts`
- `orders/collectOrder.ts`
- `wallet/topUp.ts`
- `reconciler/reconcileIntents.ts`
- `janitor/cancelStaleOrders.ts`

### 12.5 Real Payment Gateway

Integrate Razorpay/Paytm/PhonePe for UPI verification. The current trust-based model won't survive at scale.

---

## 13. Modules That Can Be Retained

| Module | Justification |
|--------|--------------|
| **ARCH-B transaction engine** (acquireRtdbLeases, commitRtdbLeases, releaseRtdbLeases, reconcileIntent, refundStudentWallet) | Architecturally sound; needs multi-mess scoping but logic is correct |
| **Student auth flow** (student-portal AuthContext) | Registration watcher, session collision detection, offline caching — well-built |
| **KOT queue system** (kotQueueService, routeOrderToCounters) | Good counter-routing logic; needs `messId` prefix |
| **Thermal Printer module** | Hardware integration is independent of business logic |
| **Menu service** (menuService, dual Firestore+RTDB pattern) | Effective hybrid approach; needs per-mess scoping |
| **Shared type definitions** (types.ts) | Extend with `messId`; core types are solid |
| **Formatters** (formatters.ts) | Pure utility, no changes needed |
| **QR parser** (qrParser.ts) | Retain and extend for mess-scoped QR codes |
| **Time slot service** | Logic is sound; needs per-mess configuration |

---

## 14. Modules That Should Be Refactored

| Module | Required Changes |
|--------|-----------------|
| **Cloud Functions `index.ts`** | Decompose into separate files; add `messId` parameter to all functions; add rate limiting |
| **Firestore security rules** | Replace hardcoded emails with claims-based checks; add `messId` scoping |
| **RTDB security rules** | Add per-mess path validation; restrict `kot_queue` and `mess_status` writes to authenticated staff |
| **Student service** | Add `messId` enrollment; support multi-mess enrollment |
| **Wallet service** | Fix the `set` vs `increment` bug; add idempotency; scope per mess or keep global with per-mess spending limits |
| **Stock service** | Scope all paths under `messes/{messId}/menu_stock/` |
| **Order service** | Scope active_orders under `messes/{messId}/`; partition subscriptions |
| **Mess status service** | Scope under `messes/{messId}/mess_status` |
| **Admin auth context** | Remove `setRoleOverride`; implement proper RBAC with custom claims |
| **Report engine** | Add mess filtering; currently aggregates everything into one report |

---

## 15. Modules That Should Be Rebuilt

| Module | Reason |
|--------|--------|
| **Kitchen app authentication** | Must be rebuilt from scratch — currently has zero auth |
| **Kiosk app authentication** | Anonymous auth is insufficient; needs device-level authentication with mess binding |
| **Central admin portal** | Does not exist; must be built to provide cross-mess institutional oversight |
| **Wallet top-up flow** | Current `set` approach should be replaced with atomic `increment` + ledger entry in a single transaction |
| **Night mess module** | Field exists but no business logic; needs enrollment gating, menu filtering, time-slot enforcement |
| **Payment gateway integration** | Does not exist; must be built for UPI/card verification |
| **Outsider payment flow** | Currently trust-based; needs real payment verification and guest identity management |
| **`assignMonthlyBalanceToAll`** | Batch limit bug; needs chunked batches with progress tracking |
| **Admin settings/roles management** | Current approach is too simplistic for 25 messes; needs institutional-grade RBAC management UI |

---

## 16. Recommended Implementation Order

| Phase | Priority | Module | Estimated Effort |
|-------|----------|--------|-----------------|
| **0** | BLOCKER | Design multi-mess data model schema + migration strategy | 1 week |
| **1** | CRITICAL | Implement `messId` scoping in RTDB paths and Firestore collections | 2 weeks |
| **2** | CRITICAL | Implement RBAC with Firebase Custom Claims + update security rules | 1.5 weeks |
| **3** | CRITICAL | Refactor Cloud Functions: add messId, decompose, add idempotency to kiosk/UPI | 2 weeks |
| **4** | CRITICAL | Rebuild kitchen + kiosk authentication with mess binding | 1 week |
| **5** | HIGH | Build central institutional admin portal | 2 weeks |
| **6** | HIGH | Per-mess menu, inventory, and time slot management | 1.5 weeks |
| **7** | HIGH | Fix wallet service bugs (set→increment, batch limits) | 3 days |
| **8** | HIGH | Order counter sharding for high throughput | 3 days |
| **9** | MEDIUM | Night mess enrollment + gating logic | 1 week |
| **10** | MEDIUM | Special/paid mess pricing mode | 1 week |
| **11** | MEDIUM | Payment gateway integration (Razorpay/PhonePe) | 2 weeks |
| **12** | MEDIUM | Monitoring, logging, error reporting (Sentry) | 1 week |
| **13** | MEDIUM | CI/CD pipeline (GitHub Actions → Firebase deploy) | 3 days |
| **14** | LOW | Student wallet self-top-up via payment gateway | 1 week |
| **15** | LOW | Load testing + performance tuning | 1 week |
| **16** | LOW | Automated test suite | 2 weeks (ongoing) |
| **17** | LOW | Backup strategy + disaster recovery runbook | 3 days |

---

## 17. Questions Requiring Product-Owner Decisions

> **ℹ️ IMPORTANT:**
> The following questions will significantly impact the architecture and implementation plan. They must be resolved before proceeding with Phase 0.

### Data Model

1. **Shared vs. isolated student identities**: Can a student be enrolled in multiple messes (e.g., regular mess + night mess)? Or does each mess have its own student roster?

2. **Wallet scope**: Is the wallet **global** (one balance across all messes, deducted by any mess the student is enrolled in) or **per-mess** (each mess manages its own balance independently)?

3. **Menu independence**: Are the 25 messes completely independent in their menus, or do some share a base menu with customizations?

### Operations

4. **Mess discovery**: How does a student select which mess to order from? Is it based on:
   - Fixed enrollment (student belongs to exactly one regular mess)?
   - Geolocation?
   - Manual selection in the app?

5. **Night mess model**: Is the night mess a separate entity (Mess #26) or a mode within each existing mess (Mess A runs regular 7AM-8PM and night 9PM-11PM)?

6. **Outsider policy**: Can outsiders order from any mess, or only designated "open" messes? Do they pay different prices?

### Administration

7. **Cross-mess visibility**: Can a mess admin see other messes' data? Can they see aggregate institutional data?

8. **Institutional admin functions**: What specific actions can the central admin perform? (e.g., freeze a mess, transfer students between messes, set institution-wide pricing policies)

9. **Financial reporting**: Are financial reports generated per-mess, or is there a consolidated institutional report?

### Technical

10. **Migration strategy**: Is there existing production data that needs to be migrated, or will the multi-mess deployment start fresh?

11. **Deployment topology**: Should all 25 messes share one Firebase project (lower cost, simpler deployment) or use separate projects (stronger isolation, higher cost)?

12. **Offline resilience**: How critical is offline ordering capability? The current system has some offline caching but no offline order queuing.

---

## Appendix A: Current Readiness Assessment

| Dimension | Score (0–10) | Justification |
|-----------|:------------:|---------------|
| **Product Completeness** | 4 | Core ordering works for a single mess; wallet, reports, KOT are functional. Night mess, paid mess, outsider payments, multi-mess are all missing. |
| **Technical Architecture** | 5 | ARCH-B transaction engine is sophisticated. Dual-database approach is well-designed. Monorepo with shared core is good. But single-mess assumption permeates everything. |
| **Security** | 3 | Kitchen has zero auth. Kiosk uses anonymous auth. RTDB rules are overly permissive. Role override vulnerability exists. Passwords stored as base64. |
| **Transaction Reliability** | 6 | ARCH-B provides idempotent credit orders with leasing, fencing, and reconciliation. However, kiosk and UPI paths lack idempotency. Wallet top-up is not transactionally safe. |
| **Scalability** | 2 | Single-document order counter is a hard bottleneck. `subscribeActiveOrders` downloads all orders. No sharding. Untested under load. |
| **Multi-Mess Readiness** | 0 | No `messId` anywhere. No tenant isolation. No per-mess configuration. Zero multi-mess capability. |
| **Production Deployment Readiness** | 2 | No CI/CD, no monitoring, no error reporting, no backup strategy, no load testing, no automated tests. Deployment is manual `firebase deploy`. |

---

## Appendix B: File Reference Index

### Shared Core
- `packages/shared-core/src/types.ts` — All shared TypeScript interfaces
- `packages/shared-core/src/firebaseConfig.ts` — Firebase initialization with offline persistence
- `packages/shared-core/src/transactions/processTransaction.ts` — Legacy stock transaction (DEAD CODE)
- `packages/shared-core/src/rtdb/orderService.ts` — RTDB active order operations
- `packages/shared-core/src/rtdb/stockService.ts` — RTDB stock management
- `packages/shared-core/src/services/menuService.ts` — Menu CRUD with dual Firestore+RTDB
- `packages/shared-core/src/services/studentService.ts` — Student CRUD with wallet deduction
- `packages/shared-core/src/services/kotQueueService.ts` — KOT queue management

### Cloud Functions
- `apps/admin-hq/functions/src/index.ts` — All server-side logic (1,367 lines)

### Security Rules
- `firestore.rules` — Firestore security rules
- `database.rules.json` — RTDB security rules

### Authentication
- `apps/student-portal/src/core/auth/AuthContext.tsx` — Google OAuth + enrollment check + session guard
- `apps/admin-hq/src/core/auth/AuthContext.tsx` — Email/Google login + role assignment
- `apps/kiosk-counter/src/core/auth/AuthContext.tsx` — Anonymous auth
- `apps/inventory-kitchen/src/core/auth/AuthContext.tsx` — No auth (hardcoded)

### Configuration
- `firebase.json` — Multi-site hosting configuration
- `.firebaserc` — Firebase project and hosting targets
- `apps/admin-hq/firestore.indexes.json` — Composite indexes

---

*End of Audit*
