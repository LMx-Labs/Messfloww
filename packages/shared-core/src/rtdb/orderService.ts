import { ref, onValue, set, update, remove, get, runTransaction, query as rtdbQuery, orderByChild, equalTo } from "firebase/database";
import { doc, setDoc } from "firebase/firestore";
import { rtdb, db, app } from "../firebaseConfig";
import { getFunctions, httpsCallable } from "firebase/functions";
import { stockService } from "./stockService";
import type { OrderItem, MealSlot } from "../types";

export const orderService = {
  // ---- Active Orders ----
  /**
   * subscribeActiveOrders: Real-time listener for the active order stream.
   * ARCHITECTURAL NOTE: 
   * 1. RTDB single-child filtering is limited; we fetch the full list and sort client-side.
   * 2. Recommended future path: Mirror active_orders to Firestore for better query/indexing.
   */
  subscribeActiveOrders(callback: (orders: any[]) => void) {
    const activeOrdersRef = ref(rtdb, "active_orders");
    return onValue(activeOrdersRef, (snapshot: any) => {
      const orders: any[] = [];
      snapshot.forEach((childSnapshot: any) => {
        orders.push({ id: childSnapshot.key, ...childSnapshot.val() });
      });
      // Sort by createdAt descending
      orders.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return timeB - timeA;
      });
      
      callback(orders);
    });
  },

  async updateOrderStatus(orderId: string, field: string, status: string) {
    const orderRef = ref(rtdb, `active_orders/${orderId}`);
    
    const terminalStatuses = ["completed", "collected", "cancelled", "expired", "refunded"];
    if (field === 'status' && terminalStatuses.includes(status)) {
        // Fetch full order
        const snap = await get(orderRef);
        if (snap.exists()) {
            const orderData = snap.val();
            orderData.status = status;
            orderData.updatedAt = new Date().toISOString();
            
            // 1. Move to historical_orders in Firestore
            await setDoc(doc(db, "historical_orders", orderId), {
                ...orderData,
                archivedAt: new Date().toISOString()
            });
            // 2. Remove from RTDB
            await remove(orderRef);
            return;
        }
    }
    
    // Otherwise, normal update in RTDB
    await update(orderRef, { [field]: status, updatedAt: new Date().toISOString() });
  },

  async pushActiveOrder(orderData: any) {
    const activeOrdersRef = ref(rtdb, `active_orders/${orderData.id}`);
    await set(activeOrdersRef, orderData);
    return orderData.id;
  },

  async markOrderReady(orderId: string) {
    const orderRef = ref(rtdb, `active_orders/${orderId}`);
    await update(orderRef, { status: 'ready', updatedAt: new Date().toISOString() });
  },

  async finalizeCollection(orderId: string) {
    const orderRef = ref(rtdb, `active_orders/${orderId}`);
    const snap = await get(orderRef);
    if (snap.exists()) {
      const orderData = snap.val();
      orderData.status = 'collected';
      orderData.updatedAt = new Date().toISOString();
      orderData.collectedAt = new Date().toISOString();
      
      await setDoc(doc(db, "historical_orders", orderId), {
          ...orderData,
          archivedAt: new Date().toISOString()
      });
      await remove(orderRef);
      return orderData;
    }
  },

  async removeActiveOrder(orderId: string) {
    const orderRef = ref(rtdb, `active_orders/${orderId}`);
    await remove(orderRef);
  },

  /**
   * cancelPendingOrder — Gatekeeper rejection: "Admin clicked No, student hasn't paid."
   * 1. Fetch the order and verify it is still PENDING.
   * 2. Atomically revert stock for each item (incrementStock).
   * 3. Archive to Firestore historical_orders with status=cancelled.
   * 4. Remove from RTDB active_orders.
   */
  async cancelPendingOrder(orderId: string): Promise<void> {
    const orderRef = ref(rtdb, `active_orders/${orderId}`);
    const snap = await get(orderRef);
    if (!snap.exists()) {
      throw new Error('Order not found.');
    }
    const orderData = { id: orderId, ...snap.val() };

    if (orderData.paymentStatus !== 'PENDING') {
      throw new Error('Order is not PENDING and cannot be cancelled this way.');
    }

    // Atomically revert stock for all items
    await Promise.all(
      (orderData.items || []).map((item: any) =>
        stockService.incrementStock(Number(item.id), Number(item.qty || 1))
      )
    );

    // Archive to Firestore
    const now = new Date().toISOString();
    await setDoc(doc(db, 'historical_orders', orderId), {
      ...orderData,
      status: 'cancelled',
      paymentStatus: 'CANCELLED',
      cancelReason: 'rejected_by_admin',
      cancelledAt: now,
      archivedAt: now,
    });

    // Remove from active RTDB
    await remove(orderRef);
  },

  async getActiveOrderById(orderId: string) {
    const orderRef = ref(rtdb, `active_orders/${orderId}`);
    const snap = await get(orderRef);
    if (snap.exists()) {
      return { id: snap.key, ...snap.val() };
    }
    return null;
  },

  async getActiveOrderSearchFallback(searchTerm: string) {
    const activeOrdersRef = ref(rtdb, "active_orders");
    const snap = await get(activeOrdersRef);
    if (snap.exists()) {
      const allOrders = snap.val();
      const numSearch = Number(searchTerm);
      const isNum = !isNaN(numSearch);
      
      for (const key in allOrders) {
        const order = allOrders[key];
        // Search by orderNumber or Roll No
        if (isNum && order.orderNumber === numSearch) {
          return { id: key, ...order };
        }
        if (order.userRollNo?.toLowerCase() === searchTerm.toLowerCase()) {
            return { id: key, ...order };
        }
      }
    }
    return null;
  },
  
  // Method needed for Student App
  subscribeToActiveOrder(orderId: string, callback: (order: any | null) => void) {
    const orderRef = ref(rtdb, `active_orders/${orderId}`);
    return onValue(orderRef, (snapshot: any) => {
      if (snapshot.exists()) {
        callback({ id: snapshot.key, ...snapshot.val() });
      } else {
        callback(null);
      }
    });
  },

  // Method needed for Student App
  async getActiveOrder(userId: string): Promise<any | null> {
    const activeOrdersRef = ref(rtdb, "active_orders");
    const userOrdersQuery = rtdbQuery(activeOrdersRef, orderByChild("userId"), equalTo(userId));
    const snapshot = await get(userOrdersQuery);
    
    if (snapshot.exists()) {
      let activeOrder = null;
      snapshot.forEach((child: any) => {
        const order = child.val();
        if (["ordered", "preparing", "ready"].includes(order.status)) {
          activeOrder = { id: child.key, ...order };
        }
      });
      return activeOrder;
    }
    return null;
  },
  
  // Method needed for Student App
  async placeOrderWithAtomicStock(
    _userId: string,
    _userRollNo: string,
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
  },

  // Method needed for Kiosk App (Counter, External, Shop orders)
  async placeKioskOrderWithAtomicStock(
    orderType: 'counter' | 'external' | 'shop',
    items: OrderItem[],
    totalPrice: number,
    slotName: string,
    paymentMode: string,
    studentRegNo?: string,
    existingOrderId?: string,
    existingOrderNumber?: number
  ): Promise<{ id: string, orderNumber: number }> {
    try {
      const functions = getFunctions(app);
      const securePlaceKioskOrderFn = httpsCallable(functions, 'securePlaceKioskOrder');
      
      const result = await securePlaceKioskOrderFn({
        cart: items,
        totalPrice,
        slotName,
        orderType,
        paymentMode,
        studentRegNo,
        existingOrderId,
        existingOrderNumber
      });

      const data = result.data as any;
      if (data.success) {
        return {
          id: data.orderId,
          orderNumber: data.orderNumber
        };
      } else {
        throw new Error("Kiosk order creation rejected by server");
      }
    } catch (error: any) {
      console.error("Cloud function securePlaceKioskOrder error:", error);
      throw new Error(error?.message || `Failed to place ${orderType} order.`);
    }
  }
};
