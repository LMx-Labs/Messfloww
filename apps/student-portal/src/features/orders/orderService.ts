import { 
  collection, doc, getDocs, 
  query, where, orderBy, limit, 
  QueryDocumentSnapshot,
  startAfter, getDoc
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db, orderService as sharedOrderService } from "@messflow/shared-core";
import { OrderItem, OrderStatus, OrderDoc, MealSlot } from "@messflow/shared-core";

export type { OrderItem, OrderStatus, OrderDoc, MealSlot };

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
    return sharedOrderService.placeOrderWithAtomicStock(userId, userRollNo, items, totalPrice, slotInfo);
  },

  /**
   * Places a UPI order via the securePlaceUpiOrder Cloud Function.
   * Server validates price against Firestore menu and creates order via Admin SDK.
   * Order goes to PENDING state waiting for staff confirmation.
   */
  async placeUpiOrder(
    _userId: string,
    _userRollNo: string,
    items: OrderItem[],
    totalPrice: number,
    slotInfo: MealSlot
  ): Promise<{ id: string, orderNumber: number }> {
    const functions = getFunctions(db.app);
    const securePlaceUpiOrder = httpsCallable(functions, 'securePlaceUpiOrder');

    const result = await securePlaceUpiOrder({
      cart: items.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
      totalPrice,
      slotName: slotInfo.name,
    });

    const data = result.data as { success: boolean; orderId: string; orderNumber: number };
    if (!data.success) throw new Error('UPI order rejected by server.');

    return { id: data.orderId, orderNumber: data.orderNumber };
  },

  /**
   * Fetches the current active order for a user (Snapshot)
   */
  async getActiveOrder(userId: string): Promise<OrderDoc | null> {
    return sharedOrderService.getActiveOrder(userId);
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
    return sharedOrderService.subscribeToActiveOrder(orderId, callback);
  },

  /**
   * Fetches a specific order by ID (Once)
   */
  async getActiveOrderById(orderId: string): Promise<OrderDoc | null> {
    // First check RTDB for active status
    const activeOrder = await sharedOrderService.getActiveOrderById(orderId);
    if (activeOrder) return activeOrder;

    // If not in RTDB, it might be archived
    const historyDoc = await getDoc(doc(db, "historical_orders", orderId));
    if (historyDoc.exists()) {
      return { id: historyDoc.id, ...historyDoc.data() } as OrderDoc;
    }

    return null;
  }
};
