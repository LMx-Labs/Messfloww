// ── User & Student ──
export interface Student {
  id: number;
  name: string;
  email: string;
  regNo: string;
  phone: string;
  balance: number;
  credits: number;
  status: "active" | "disabled";
  uid?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  rollNo: string;
  walletBalance: number;
  createdAt: string;
  isRegistered: boolean;
  status: "active" | "disabled" | "pending";
  photoURL?: string;
  activeSessionId?: string;
}

// ── Orders ──
export interface OrderItem {
  id: number;
  name: string;
  price: number;
  qty: number;
}

export type OrderStatus = "pending" | "ordered" | "processing" | "preparing" | "ready" | "collected" | "completed" | "cancelled" | "refunded" | "expired";

export interface Order {
  id: string;
  userId: string;
  userRollNo: string;
  items: OrderItem[];
  totalPrice: number;
  status: OrderStatus;
  payment_mode?: "credit" | "upi" | "cash" | "card";
  slotName: string;
  slotTime?: string;
  counterNumber?: number;
  orderNumber: number;
  estimatedServingWindow?: string;
  qrUsed?: boolean;
  autoPrint?: boolean;
  createdAt: number | string;
  updatedAt?: string;
  sync_status?: "cloud" | "local";
  isExternal?: boolean;
  externalLabel?: string;
  isCounterOrder?: boolean;
}

export type OrderDoc = Order; // Backward compatibility

// ── Time Slots ──
export type MealType = string;

export interface MealSlot {
  name: string;
  time: string;
}

export interface TimeSlot {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  active?: boolean;
}

// ── Inventory ──
export interface InventoryItem {
  id: number;
  name: string;
  price: number;
  available: boolean;
  isVeg: boolean;
  category: string;
  stock: number;
  initialStock: number;
  minStock: number;
  lowStockAlert: boolean;
  slot: MealType;
  gst: number;
  isMRP: boolean;
  cost?: number;
}

// Alias for backward compat
export type MenuItem = InventoryItem;
