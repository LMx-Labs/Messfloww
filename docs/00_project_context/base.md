
### 📦 Dependency Installation Summary

1. **Root & Workspace Apps (`pnpm install`)**:
   - `apps/student-portal` (Vite, React 18, Tailwind CSS, Lucide, Framer Motion)
   - `apps/admin-hq` (Vite, React 18, Tailwind CSS, Recharts, Lucide)
   - `apps/kiosk-counter` (Vite, React 18, Tailwind CSS, HTML5 QR Scanner)
   - `apps/inventory-kitchen` (Vite, React 18, Tailwind CSS)
   - `packages/shared-core` (Firebase 12, Shared Contexts, RTDB Transactions)
2. **Firebase Cloud Functions (`npm install` & `npm run build`)**:
   - `apps/admin-hq/functions` (Firebase Admin, Firebase Functions v2, TypeScript)
3. **Thermal KOT Print Server (`pip install -r requirements.txt`)**:
   - `tools/print_server` (Flask, Flask-CORS, PyWin32 for Windows Thermal Printing)

---

# 🌐 Messfloww Live Websites & Endpoints Report

### 1. Live Websites & Hosted Domains

Configured in [.firebaserc](file:///c:/Users/laksh/Desktop/GIT%20live%20clones/Messfloww/Messfloww-main/.firebaserc) and [firebase.json](file:///c:/Users/laksh/Desktop/GIT%20live%20clones/Messfloww/Messfloww-main/firebase.json):

| Application | Hosting Target | Live Web App URLs | Local Dev URL & Command |
| :--- | :--- | :--- | :--- |
| **Student Portal** | `student` | [https://messfloww-students.web.app](https://messfloww-students.web.app)<br>[https://messfloww-students.firebaseapp.com](https://messfloww-students.firebaseapp.com) | `http://localhost:5173`<br>`pnpm dev:student` |
| **Admin HQ** | `admin` | [https://messfloww-admin.web.app](https://messfloww-admin.web.app)<br>[https://messfloww-admin.firebaseapp.com](https://messfloww-admin.firebaseapp.com) | `http://localhost:5174`<br>`pnpm dev:admin` |
| **Kiosk Counter** | `kiosk` | [https://messfloww-kiosk.web.app](https://messfloww-kiosk.web.app)<br>[https://messfloww-kiosk.firebaseapp.com](https://messfloww-kiosk.firebaseapp.com)<br>[https://messfloww.web.app](https://messfloww.web.app) | `http://localhost:5175`<br>`pnpm dev:kiosk` |
| **Kitchen & KDS** | `kitchen` | [https://messfloww-kitchen.web.app](https://messfloww-kitchen.web.app)<br>[https://messfloww-kitchen.firebaseapp.com](https://messfloww-kitchen.firebaseapp.com) | `http://localhost:5176`<br>`pnpm dev:kitchen` |

---

### 2. Frontend Routes & Screen Catalog

#### 📱 A. Student Portal ([apps/student-portal](file:///c:/Users/laksh/Desktop/GIT%20live%20clones/Messfloww/Messfloww-main/apps/student-portal/src/core/layout/routes.tsx))
- `/` — Student Login Screen (Google Sign-In & Student verification)
- `/home` — Meal slot selection & live menu catalog
- `/cart` — Cart review & checkout (Credit Balance / UPI)
- `/order-success` — Order confirmation & token summary
- `/upi-pending` — UPI transaction verification
- `/order-tracking/:orderId` — Real-time queue tracker with dynamic collection QR code
- `/profile` — Student profile, account details & balance
- `/order-history` — Past orders & digital receipts
- `/staff` — Staff dashboard interface

#### 💻 B. Admin HQ ([apps/admin-hq](file:///c:/Users/laksh/Desktop/GIT%20live%20clones/Messfloww/Messfloww-main/apps/admin-hq/src/core/layout/routes.tsx))
- `/login` — Admin & Manager login
- `/` — Main Executive Dashboard (Real-time orders, revenue, mess health)
- `/passbook` — Financial passbook & student balance audit
- `/menu` — Menu editor, pricing, and live inventory toggle
- `/students` — Student master registry & batch operations
- `/time-slots` — Meal slot timing configuration & capacity limits
- `/ledger` — Financial audit ledger
- `/reports` — Sales, consumption, and financial analytics
- `/subscriptions` — Automated periodic email report distribution
- `/settings` — Admin controls, access roles & system kill-switch

#### 🖥️ C. Kiosk Counter ([apps/kiosk-counter](file:///c:/Users/laksh/Desktop/GIT%20live%20clones/Messfloww/Messfloww-main/apps/kiosk-counter/src/core/layout/routes.tsx))
- `/` (Main tabbed Kiosk terminal):
  - **`QR Scan` (`/scan`)** — Barcode / QR scanner for instant redemption & token printing
  - **`Internal Counter` (`/counter`)** — Direct roll-number counter ordering with wallet debit
  - **`Shop` (`/shop`)** — Quick POS retail shop orders
  - **`External` (`/external`)** — Guest & walk-in cashier checkout

#### 🍳 D. Kitchen Display System ([apps/inventory-kitchen](file:///c:/Users/laksh/Desktop/GIT%20live%20clones/Messfloww/Messfloww-main/apps/inventory-kitchen/src/core/layout/routes.tsx))
- `/` & `/dashboard` — Live kitchen order monitor
- `/kds` — Kitchen Display Screen (Interactive preparation cards & queue)
- `/kot` — Kitchen Order Ticket (KOT) control center
- `/counter` — Counter listener & audio/visual pickup alerts

---

### 3. Backend Cloud Functions (API Endpoints & Schedulers)

Source: [apps/admin-hq/functions/src/index.ts](file:///c:/Users/laksh/Desktop/GIT%20live%20clones/Messfloww/Messfloww-main/apps/admin-hq/functions/src/index.ts)

| Function Name | Protocol / Type | Description & Trigger |
| :--- | :--- | :--- |
| **`securePlaceOrder`** | Firebase HTTPS Callable | Atomically validates student status, wallet balance, decrement RTDB inventory, records ledger entry, and creates active orders. |
| **`securePlaceKioskOrder`** | Firebase HTTPS Callable | Server-side verified order creation for Counter, Shop, and External Guest walk-ins. |
| **`securePlaceUpiOrder`** | Firebase HTTPS Callable | Price-spoof protected UPI checkout, reserves stock, and places order into pending state. |
| **`collectOrder`** | Firebase HTTPS Callable | Atomic QR redemption; validates order status, marks as redeemed/collected. |
| **`confirmAndCollectUpiOrder`** | Firebase HTTPS Callable | Atomic payment confirmation + collection for counter UPI orders. |
| **`cancelStalePendingOrders`** | Cloud Scheduler (Cron) | Runs **every 5 minutes**; automatically cancels unpaid UPI orders older than 15 min, restores stock to RTDB, and archives orders to Firestore. |

---

### 4. Realtime Database (RTDB) & Firestore Endpoints

- **Realtime Database (RTDB)**:
  - `active_orders/{orderId}` — Live orders stream
  - `menu_stock/{itemId}` — Real-time inventory & live stock deduction
  - `kot_queue/{counterId}` — Kitchen Order Ticket print queues
  - `kot_counters` — Counter printer configuration
  - `system_status/admin_online` — Master kill-switch flag
  - `mess_status` — Serving counter state & wait time estimations
- **Cloud Firestore**:
  - `users/{uid}` — Student & staff profiles
  - `students/{regNo}` — Registered student ledger & wallet balances
  - `menu/{docId}` — Canonical menu catalog
  - `timeSlots/{docId}` — Operational meal slots
  - `ledger/{docId}` — Immutable financial transactions
  - `historical_orders/{orderId}` — Completed & cancelled order archives
  - `orderCounters/{date}` — Daily sequential token numbering

---

### 5. Local Hardware Microservice (Thermal KOT Print Server)

Source: [tools/print_server/print_server.py](file:///c:/Users/laksh/Desktop/GIT%20live%20clones/Messfloww/Messfloww-main/tools/print_server/print_server.py)
- **Base Host**: `http://127.0.0.1:5000` (or `http://localhost:5000`)
- **Endpoints**:
  - `GET /health` — Verifies server health and printer connectivity
  - `POST /print-kot` — Formats and sends raw ESC/POS KOT tickets to the connected Windows thermal printer (`win32print`)