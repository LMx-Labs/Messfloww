import { ref, onValue, set, update, remove, get, runTransaction } from "firebase/database";
import { doc, setDoc } from "firebase/firestore";
import { rtdb, db } from "../../core/firebase";

export const kitchenService = {
  // ---- Active Orders ----
  subscribeActiveOrders(callback: (orders: any[]) => void) {
    const activeOrdersRef = ref(rtdb, "active_orders");
    return onValue(activeOrdersRef, (snapshot) => {
      const orders: any[] = [];
      snapshot.forEach((childSnapshot) => {
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

  async updateActiveOrderStatus(orderId: string, field: string, status: string) {
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

  async atomicCollectOrder(orderId: string) {
    const orderRef = ref(rtdb, `active_orders/${orderId}`);
    const result = await runTransaction(orderRef, (orderData) => {
      if (orderData === null) return orderData;
      
      if (orderData.status === 'ordered' || orderData.status === 'pending' || orderData.status === 'preparing') {
        if (!orderData.qrUsed) {
          orderData.qrUsed = true;
          orderData.status = 'collected';
          orderData.updatedAt = new Date().toISOString();
          return orderData;
        }
      }
      return; // abort
    });

    if (result.committed && result.snapshot.val()) {
      const orderData = result.snapshot.val();
      
      await setDoc(doc(db, "historical_orders", orderId), {
          ...orderData,
          archivedAt: new Date().toISOString()
      });
      await remove(orderRef);
      
      return orderData;
    } else {
      throw new Error("Order already collected, cancelled, or not pending.");
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

  // ---- Menu Stock ----
  subscribeMenuStock(callback: (stockMap: Record<string, { stock: number, minStock: number, available: boolean }>) => void) {
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

  async setMenuStock(itemId: number, stockData: { stock: number, minStock: number, available: boolean }) {
    const itemStockRef = ref(rtdb, `menu_stock/${itemId}`);
    await update(itemStockRef, stockData);
  },

  async decrementStock(itemId: number, quantity: number) {
    const itemStockRef = ref(rtdb, `menu_stock/${itemId}`);
    const result = await runTransaction(itemStockRef, (currentData) => {
      if (currentData) {
        const newStock = Math.max(0, (currentData.stock || 0) - quantity);
        return {
          ...currentData,
          stock: newStock,
          available: newStock > (currentData.minStock || 0)
        };
      }
      return currentData;
    });
    return result.snapshot.val();
  },

  // ---- Mess Status ----
  subscribeMessStatus(callback: (status: { isOpen: boolean, currentlyServing: number }) => void) {
    const statusRef = ref(rtdb, "mess_status");
    return onValue(statusRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val());
      } else {
        callback({ isOpen: false, currentlyServing: 0 });
      }
    });
  },

  async setMessStatus(statusData: { isOpen?: boolean, currentlyServing?: number }) {
    const statusRef = ref(rtdb, "mess_status");
    await update(statusRef, { ...statusData, updatedAt: new Date().toISOString() });
  },

  async getMessStatus() {
    const statusRef = ref(rtdb, "mess_status");
    const snap = await get(statusRef);
    if (snap.exists()) {
      return snap.val() as { isOpen: boolean, currentlyServing: number };
    }
    return { isOpen: false, currentlyServing: 0 };
  },
};
