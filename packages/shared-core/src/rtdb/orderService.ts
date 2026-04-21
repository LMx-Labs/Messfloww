import { ref, onValue, set, update, remove, get, runTransaction, query as rtdbQuery, orderByChild, equalTo } from "firebase/database";
import { doc, setDoc } from "firebase/firestore";
import { rtdb, db, app } from "../firebaseConfig";
import { getFunctions, httpsCallable } from "firebase/functions";
import type { OrderItem, MealSlot } from "../types";

export const orderService = {
  // ---- Active Orders ----
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
      
      // Update local storage cache for offline scanning fallback
      try {
        localStorage.setItem("offline_orders_cache", JSON.stringify(orders));
      } catch(e) {
        console.error("Failed to cache offline orders", e);
      }
      
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

  async confirmUpiPayment(orderId: string): Promise<void> {
    const orderRef = ref(rtdb, `active_orders/${orderId}`);
    await runTransaction(orderRef, (data) => {
      if (!data) return data;
      if (data.paymentStatus === 'PENDING') {
        data.paymentStatus = 'PAID';
        data.paidAt = new Date().toISOString();
        return data;
      }
      return; // abort if not pending
    });
  },

  async atomicCollectOrder(orderId: string) {
    const orderRef = ref(rtdb, `active_orders/${orderId}`);
    const result = await runTransaction(orderRef, (orderData) => {
      if (orderData === null) return orderData;
      
      if (orderData.status === 'ordered' || orderData.status === 'pending' || orderData.status === 'preparing') {
        if (!orderData.qrUsed) {
          orderData.qrUsed = true;
          orderData.paymentStatus = 'REDEEMED';
          orderData.status = 'processing'; // Moved to processing first for KOT generation
          orderData.updatedAt = new Date().toISOString();
          orderData.scannedAt = new Date().toISOString();
          return orderData;
        }
      }
      return; // abort
    });

    if (result.committed && result.snapshot.val()) {
      return result.snapshot.val();
    } else {
      throw new Error("Order already scanned, cancelled, or not pending.");
    }
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
  }
};
