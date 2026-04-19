import { ref, onValue, set, get, runTransaction, push, query as rtdbQuery, orderByChild, equalTo } from "firebase/database";
import { rtdb, db, app } from "../../core/firebase/config";
import { doc, getDoc, writeBatch, runTransaction as firestoreRunTransaction } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { OrderItem, MealSlot } from "../../types/order.types";

export const rtdbService = {
  // ---- Mess Status ----
  subscribeMessStatus(callback: (status: { isOpen: boolean, currentlyServing: number }) => void) {
    const statusRef = ref(rtdb, "mess_status");
    return onValue(statusRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        callback({
          isOpen: data?.isOpen ?? false,
          currentlyServing: data?.currentlyServing ?? 0
        });
      } else {
        callback({ isOpen: false, currentlyServing: 0 });
      }
    });
  },

  // ---- Menu Stock ----
  subscribeToMenuStock(callback: (stockMap: Record<string, { stock: number, minStock: number, available: boolean }>) => void) {
    const stockRef = ref(rtdb, "menu_stock");
    return onValue(stockRef, (snapshot) => {
      const stockMap: Record<string, any> = {};
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          stockMap[child.key] = child.val();
        });
      }
      callback(stockMap);
    });
  },

  // ---- Active Orders ----
  subscribeToActiveOrder(orderId: string, callback: (order: any | null) => void) {
    const orderRef = ref(rtdb, `active_orders/${orderId}`);
    return onValue(orderRef, (snapshot) => {
      if (snapshot.exists()) {
        callback({ id: snapshot.key, ...snapshot.val() });
      } else {
        callback(null);
      }
    });
  },

  async getActiveOrder(userId: string): Promise<any | null> {
    const activeOrdersRef = ref(rtdb, "active_orders");
    const userOrdersQuery = rtdbQuery(activeOrdersRef, orderByChild("userId"), equalTo(userId));
    const snapshot = await get(userOrdersQuery);
    
    if (snapshot.exists()) {
      let activeOrder = null;
      // RTDB queries might return multiple, we want one that is preparing/ordered/ready
      snapshot.forEach((child) => {
        const order = child.val();
        if (["ordered", "preparing", "ready"].includes(order.status)) {
          activeOrder = { id: child.key, ...order };
        }
      });
      return activeOrder;
    }
    return null;
  },

  async getActiveOrderById(orderId: string): Promise<any | null> {
    const snapshot = await get(ref(rtdb, `active_orders/${orderId}`));
    if (snapshot.exists()) {
      return { id: snapshot.key, ...snapshot.val() };
    }
    return null;
  },

  // ---- Atomic Order Placement ----
  async placeOrderWithAtomicStock(
    userId: string,
    userRollNo: string,
    items: OrderItem[],
    totalPrice: number,
    slotInfo: MealSlot
  ): Promise<{ id: string, orderNumber: number, estimatedServingWindow: string }> {
    try {
      const functions = getFunctions(app);
      const securePlaceOrderFn = httpsCallable(functions, 'securePlaceOrder');
      
      const result = await securePlaceOrderFn({
        cart: items,
        totalPrice,
        slotName: slotInfo.name,
        paymentMode: "credit"
      });

      const data = result.data as any;
      if (data.success) {
        return {
          id: data.orderId,
          orderNumber: data.orderNumber,
          estimatedServingWindow: data.estimatedServingWindow || "Soon",
        };
      } else {
        throw new Error("Order creation rejected by server");
      }
    } catch (error: any) {
      console.error("Cloud function securePlaceOrder error:", error);
      throw new Error(error?.message || "Failed to place secure order.");
    }
  }
};
