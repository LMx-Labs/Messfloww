import { ref, onValue, set, update, push, remove, get, runTransaction } from "firebase/database";
import { doc, setDoc } from "firebase/firestore";
import { rtdb, db } from "../../lib/firebase";

export const rtdbService = {
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
      callback(orders);
    });
  },

  async updateActiveOrderStatus(orderId: string, field: string, status: string) {
    const orderRef = ref(rtdb, `active_orders/${orderId}`);
    
    const terminalStatuses = ["completed", "cancelled", "expired"];
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

  // ---- KOT Counters ----
  subscribeKOTCounters(callback: (counters: any[]) => void) {
    const countersRef = ref(rtdb, "kot_counters");
    return onValue(countersRef, (snapshot) => {
      const counters: any[] = [];
      snapshot.forEach((child) => {
        counters.push({ id: child.key, ...child.val() });
      });
      callback(counters);
    });
  },

  async setKOTCounter(counterId: string, data: any) {
    const counterRef = ref(rtdb, `kot_counters/${counterId}`);
    await set(counterRef, {
      ...data,
      updatedAt: new Date().toISOString()
    });
  },

  async deleteKOTCounter(counterId: string) {
    const counterRef = ref(rtdb, `kot_counters/${counterId}`);
    await remove(counterRef);
    // Also clean up the queue for this counter
    const queueRef = ref(rtdb, `kot_queue/${counterId}`);
    await remove(queueRef);
  },

  async updateCounterStatus(counterId: string, status: string) {
    const counterRef = ref(rtdb, `kot_counters/${counterId}`);
    await update(counterRef, { status, updatedAt: new Date().toISOString() });
  },

  async updateCounterHeartbeat(counterId: string, sessionId: string) {
    const counterRef = ref(rtdb, `kot_counters/${counterId}`);
    await update(counterRef, {
      lastHeartbeat: new Date().toISOString(),
      activeSessionId: sessionId
    });
  },

  // ---- KOT Queue ----
  async pushKOTToQueue(counterId: string, kotId: string, kotData: any) {
    const kotRef = ref(rtdb, `kot_queue/${counterId}/${kotId}`);
    await set(kotRef, {
      ...kotData,
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0
    });
  },

  subscribeKOTQueue(counterId: string, callback: (kots: any[]) => void) {
    const queueRef = ref(rtdb, `kot_queue/${counterId}`);
    return onValue(queueRef, (snapshot) => {
      const kots: any[] = [];
      snapshot.forEach((child) => {
        kots.push({ id: child.key, ...child.val() });
      });
      callback(kots);
    });
  },

  async markKOTPrinted(counterId: string, kotId: string) {
    const kotRef = ref(rtdb, `kot_queue/${counterId}/${kotId}`);
    await update(kotRef, {
      status: 'printed',
      printedAt: new Date().toISOString()
    });
  },

  async markKOTFailed(counterId: string, kotId: string) {
    const kotRef = ref(rtdb, `kot_queue/${counterId}/${kotId}`);
    const snap = await get(kotRef);
    const currentRetry = snap.exists() ? (snap.val().retryCount || 0) : 0;
    await update(kotRef, {
      status: 'failed',
      retryCount: currentRetry + 1,
      lastErrorAt: new Date().toISOString()
    });
  },

  async clearPrintedKOTs(counterId: string) {
    const queueRef = ref(rtdb, `kot_queue/${counterId}`);
    const snap = await get(queueRef);
    if (snap.exists()) {
      const updates: any = {};
      snap.forEach((child) => {
        if (child.val().status === 'printed') {
          updates[child.key] = null;
        }
      });
      await update(queueRef, updates);
    }
  }
};
