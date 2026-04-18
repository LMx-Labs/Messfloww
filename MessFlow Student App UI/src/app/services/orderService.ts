import { 
  collection, doc, getDocs, 
  query, where, orderBy, limit, 
  QueryDocumentSnapshot,
  startAfter, getDoc
} from "firebase/firestore";
import { db } from "../firebase/config";
import { rtdbService } from "./rtdbService";

export interface OrderItem {
  id: number;
  name: string;
  price: number;
  qty: number;
}

export type OrderStatus = "ordered" | "preparing" | "ready" | "completed" | "cancelled" | "expired";

export interface OrderDoc {
  id: string;
  userId: string;
  userRollNo: string;
  items: OrderItem[];
  totalPrice: number;
  status: OrderStatus;
  slotName: string;
  slotTime: string;
  counterNumber: number;
  orderNumber: number; // Daily incremental number
  estimatedServingWindow: string; // e.g. "12:45 PM - 12:48 PM"
  qrUsed: boolean;
  createdAt: string; // ISO string
  updatedAt: string;
}

export interface MealSlot {
  name: string;
  time: string;
}

export const orderService = {
  /**
   * Places an order involving RTDB atomic stock reduction and Firestore wallet update
   */
  async placeOrder(
    userId: string,
    userRollNo: string,
    items: OrderItem[],
    totalPrice: number,
    slotInfo: MealSlot
  ): Promise<{ id: string, orderNumber: number, estimatedServingWindow: string }> {
    return rtdbService.placeOrderWithAtomicStock(userId, userRollNo, items, totalPrice, slotInfo);
  },

  /**
   * Fetches the current active order for a user (Snapshot)
   */
  async getActiveOrder(userId: string): Promise<OrderDoc | null> {
    return rtdbService.getActiveOrder(userId);
  },

  /**
   * Fetches the order history for a user from historical_orders collection
   */
  async getOrderHistory(
    userId: string, 
    lastDocNode: QueryDocumentSnapshot | null = null,
    limitCount: number = 10
  ): Promise<{ orders: OrderDoc[], lastDoc: QueryDocumentSnapshot | null }> {
    let q = query(
      collection(db, "historical_orders"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );

    if (lastDocNode) {
      q = query(q, startAfter(lastDocNode));
    }

    q = query(q, limit(limitCount));
    
    try {
      const querySnapshot = await getDocs(q);
      const orders = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as OrderDoc));

      return {
        orders,
        lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1] || null
      };
    } catch (error: any) {
      const isIndexError = error?.message?.toLowerCase().includes('index') || 
                           error?.code?.includes('failed-precondition') ||
                           error?.message?.includes('FAILED_PRECONDITION');
                           
      if (isIndexError) {
        console.warn("Firestore index error detected. Fallback to manual sort active.", error.message);
        try {
          // Fallback: fetch all, filter and sort manually.
          const fallbackSnapshot = await getDocs(collection(db, "historical_orders"));
          let allOrders = fallbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrderDoc));
          
          allOrders = allOrders.filter(o => o.userId === userId);
          allOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          
          return {
            orders: allOrders.slice(0, limitCount),
            lastDoc: null 
          };
        } catch (fallbackError) {
          throw fallbackError;
        }
      }
      throw error;
    }
  },

  /**
   * Subscribes to a single order for semi-live updates
   */
  subscribeToOrder(orderId: string, callback: (order: OrderDoc | null) => void) {
    return rtdbService.subscribeToActiveOrder(orderId, callback);
  },

  /**
   * Fetches a specific order by ID (Once)
   */
  async getActiveOrderById(orderId: string): Promise<OrderDoc | null> {
    // First check RTDB for active status
    const activeOrder = await rtdbService.getActiveOrderById(orderId);
    if (activeOrder) return activeOrder;

    // If not in RTDB, it might be archived
    const historyDoc = await getDoc(doc(db, "historical_orders", orderId));
    if (historyDoc.exists()) {
      return { id: historyDoc.id, ...historyDoc.data() } as OrderDoc;
    }

    return null;
  }
};
