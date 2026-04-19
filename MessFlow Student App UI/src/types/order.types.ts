export interface OrderItem {
  id: number;
  name: string;
  price: number;
  qty: number;
}

export interface MealSlot {
  name: string;
  time: string;
}

export type OrderStatus = "pending" | "ordered" | "preparing" | "ready" | "collected" | "completed" | "cancelled" | "refunded" | "expired";

export interface OrderDoc {
  id: string;
  userId: string;
  userRollNo: string;
  items: OrderItem[];
  totalPrice: number;
  status: OrderStatus;
  payment_mode?: "credit" | "upi";
  slotName: string;
  slotTime: string;
  counterNumber: number;
  orderNumber: number; // Daily incremental number
  estimatedServingWindow: string; // e.g. "12:45 PM - 12:48 PM"
  qrUsed: boolean;
  createdAt: string; // ISO string
  updatedAt: string;
}
