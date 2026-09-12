# Domain Model

## Core Concept: `messId`
All domain entities operating within a mess context must contain a `messId` field to enforce strict multi-tenant isolation. This is critical for Phase 1.

## 1. Mess & Configuration
```typescript
interface Mess {
  messId: string;
  name: string;
  location: string;
  status: "active" | "inactive";
  operationMode: OperationMode;
}

type OperationMode = "PAID_DAY" | "NIGHT";
```

## 2. User & Access
```typescript
interface Customer {
  uid: string; // Firebase Auth UID
  type: "student" | "outsider";
  regNo?: string;
  name: string;
  status: "active" | "disabled";
}
```

## 3. Financials
```typescript
interface Wallet {
  uid: string;
  balance: number;
  credits: number; // For special logic if any
}

interface WalletTransaction {
  transactionId: string;
  uid: string;
  messId: string;
  amount: number;
  type: "credit" | "debit";
  referenceOrderId?: string;
  timestamp: string;
}

type PaymentMode = "wallet" | "upi" | "cash";
type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
```

## 4. Menu & Inventory
```typescript
interface Menu {
  menuId: string;
  messId: string;
  active: boolean;
  operationMode: OperationMode;
  items: string[]; // References to InventoryItem IDs
}

interface InventoryItem {
  id: string;
  messId: string;
  name: string;
  price: number;
  available: boolean;
  stock: number;
  isVeg: boolean;
  category: string;
}
```

## 5. Orders & Kitchen
```typescript
type OrderStatus = "pending" | "preparing" | "ready" | "collected" | "cancelled" | "refunded";

interface Order {
  id: string;
  messId: string;
  userId: string;
  items: { id: string, qty: number, price: number }[];
  totalPrice: number;
  status: OrderStatus;
  paymentMode: PaymentMode;
  paymentStatus: PaymentStatus;
  createdAt: number;
  updatedAt: number;
}

interface KOT {
  kotId: string;
  orderId: string;
  messId: string;
  items: { name: string, qty: number }[];
  status: "pending" | "preparing" | "ready";
  createdAt: number;
}
```

## 6. System Integrity
```typescript
interface TransactionIntent {
  intentId: string;
  userId: string;
  messId: string;
  amount: number;
  status: "initiated" | "processing" | "completed" | "failed";
  timestamp: number;
}

interface AuditLog {
  logId: string;
  messId: string;
  actorId: string;
  action: string;
  entityId: string;
  timestamp: number;
}
```
