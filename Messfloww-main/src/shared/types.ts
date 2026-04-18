/**
 * Shared Type Definitions for Messflow
 * These interfaces are the single source of truth for the codebase.
 */

export type MealType = string;

export interface MenuItem {
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
  cost?: number; // Optional cost price for profitability reports
}

export interface Student {
  id: number;
  name: string;
  email: string;
  regNo: string;
  phone: string;
  balance: number; // Actual current wallet balance
  credits: number; // Same as balance, used interchangeably in UI
  status: "active" | "disabled";
  uid?: string;
}

export interface Order {
  id: string;
  userId: string;
  userRollNo: string;
  items: { id: number; name: string; price: number; qty: number }[];
  totalPrice: number;
  status: "ordered" | "preparing" | "ready" | "completed" | "cancelled";
  slotName: string;
  slotTime: string;
  orderNumber: number;
  createdAt: string;
  updatedAt: string;
  // External orders only:
  isExternal?: boolean;
  externalLabel?: string;
  // Counter orders only:
  isCounterOrder?: boolean;
}

export interface TimeSlot {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  active?: boolean;
}
