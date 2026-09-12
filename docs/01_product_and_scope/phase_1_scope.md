# Phase 1 Scope Definition

## Overview
Phase 1 focuses on establishing the core transactional engine for the MessFloww application, tailored specifically for **Paid/Special Day Mess** and **Night Mess** operations. It introduces strict multi-mess isolation and a robust, state-machine-driven order flow that can handle wallet, cash, and UPI payments without the complexity of generic institutional entitlements.

## Included in Phase 1 Scope

### 1. Operation Modes
- **Paid/Special Day Mess (`PAID_DAY`)**: Operations during the day with special menus where students pay using their pre-funded wallet/credits.
- **Night Mess (`NIGHT`)**: Late-night operations using direct payment methods like UPI and Cash (wallet is optional or disabled for this mode).

### 2. Multi-Mess Support (Tenant Isolation)
- Strict `messId` isolation across all collections (Users, Orders, Inventory, Menus, Ledgers).
- Mess-specific configurations and isolated kitchen queues.

### 3. User & Access Rules
- **Student Access**: Based on explicit enrollment or allowed status.
- **Outsider Access**: Allowed under specific operation rules (e.g., Night Mess).
- **Roles**: Admin, Manager, Kiosk Staff, Kitchen Staff.

### 4. Payments & Transactions
- **Wallet/Credits**: Deductions with transactional guarantees (Phase 1 focus).
- **UPI/Cash**: Simple recording and reconciliation for Night Mess.
- **Transaction Recovery**: Robust mechanisms (e.g., Transaction Intents) to prevent double-charging or race conditions.

### 5. Menu & Inventory Management
- Mess-specific menus.
- Real-time stock decrements and inventory thresholds.

### 6. Order Workflow & Kitchen Display (KDS)
- Kitchen Order Ticket (KOT) workflow.
- Order states: Pending, Preparing, Ready, Collected, Cancelled.

### 7. Food Collection & Redemption
- QR code or counter-based collection.
- Status update to prevent double redemption.

## Excluded from Phase 1 (Out of Scope)
- Regular veg/non-veg entitlement messes (monthly subscription model).
- Monthly VIT-wide enrollment and mass student onboarding.
- Facial recognition implementation.
- Hardware/card integration (RFID/NFC).
- Full institutional licensing system.

## User Roles
- **System Admin**: Cross-mess configuration and ledger oversight.
- **Mess Manager**: Menu, inventory, and staff management for a specific `messId`.
- **Kiosk Operator**: Order taking, cash/UPI validation, and food redemption.
- **Kitchen Staff**: KDS monitoring and status updates (Preparing, Ready).
- **Student**: Ordering, wallet balance checking, and QR code generation.
- **Outsider**: Cash/UPI purchases via Kiosk.

## Workflows
1. **Wallet Order (Paid Day)**: Student -> Intent Created -> Wallet Reserved -> KOT Generated -> Wallet Deducted -> Food Prepared -> Food Redeemed.
2. **Kiosk Order (Night Mess)**: Outsider/Student -> Cash/UPI paid -> KOT Generated -> Food Prepared -> Food Collected.
