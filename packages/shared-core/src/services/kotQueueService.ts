import { ref, onValue, set, update, remove, get, serverTimestamp, query, orderByChild, equalTo } from "firebase/database";
import { rtdb } from "../firebaseConfig";

export const kotQueueService = {
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
  async pushKOTToQueue(counterId: string, kotId: string, kotData: any, autoPrint: boolean = false) {
    const kotRef = ref(rtdb, `kot_queue/${counterId}/${kotId}`);
    await set(kotRef, {
      ...kotData,
      status: 'pending',
      createdAt: new Date().toISOString(),
      queuePosition: serverTimestamp(),
      retryCount: 0,
      autoPrint
    });
  },

  subscribeKOTQueue(counterId: string, callback: (kots: any[]) => void) {
    const queueRef = ref(rtdb, `kot_queue/${counterId}`);
    return onValue(queueRef, (snapshot) => {
      const kots: any[] = [];
      snapshot.forEach((child) => {
        kots.push({ id: child.key, ...child.val() });
      });
      kots.sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0));
      callback(kots);
    });
  },

  subscribePendingKOTs(counterId: string, callback: (kots: any[]) => void) {
    const queueRef = ref(rtdb, `kot_queue/${counterId}`);
    const pendingQuery = query(queueRef, orderByChild("status"), equalTo("pending"));
    return onValue(pendingQuery, (snapshot) => {
      const kots: any[] = [];
      snapshot.forEach((child) => {
        kots.push({ id: child.key, ...child.val() });
      });
      // Sort by queue position (FIFO)
      kots.sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0));
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

  async retryFailedKOTs(counterId: string) {
    const queueRef = ref(rtdb, `kot_queue/${counterId}`);
    const snap = await get(queueRef);
    if (snap.exists()) {
      const updates: any = {};
      snap.forEach((child) => {
        const kot = child.val();
        if (kot.status === 'failed' && (kot.retryCount || 0) < 3) {
          updates[`${child.key}/status`] = 'pending';
          updates[`${child.key}/retryCount`] = (kot.retryCount || 0) + 1;
        }
      });
      if (Object.keys(updates).length > 0) {
        await update(queueRef, updates);
      }
    }
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
  },
  // ---- KOT ID Generation ----
  generateKOTId(orderId: string, counterId: string): string {
    return `${orderId}_${counterId}`;
  },

  /**
   * Routes an order's items to the appropriate counters based on their categories.
   */
  async routeOrderToCounters(order: any, counters: any[], allMenuItems: any[]) {
    if (!order.items || order.items.length === 0) return;

    // Group items by counter
    const itemsByCounter: Record<string, any[]> = {};
    const uncategorizedItems: any[] = [];

    order.items.forEach((item: any) => {
      // Find the menu item to get its category
      const menuItem = allMenuItems.find(m => m.id === item.id || m.name === item.name);
      const category = menuItem?.category || 'UNCATEGORIZED';

      // Find which counter handles this category
      const counter = counters.find(c => 
        c.categories.some((cat: string) => cat.toUpperCase() === category.toUpperCase())
      );

      if (counter) {
        if (!itemsByCounter[counter.id]) {
          itemsByCounter[counter.id] = [];
        }
        itemsByCounter[counter.id].push(item);
      } else {
        uncategorizedItems.push(item);
      }
    });

    // Enqueue KOTs for each counter that has items
    const promises: Promise<void>[] = Object.entries(itemsByCounter).map(async ([counterId, items]) => {
      const kotId = this.generateKOTId(order.id, counterId);
      const kotData = {
        orderId: order.id,
        orderNumber: order.orderNumber,
        externalLabel: order.externalLabel,
        userRollNo: order.userRollNo,
        items: items.map(i => ({
          name: i.name.toUpperCase(),
          qty: i.qty
        })),
        slotName: order.slotName,
        createdAt: order.createdAt
      };

      await this.pushKOTToQueue(counterId, kotId, kotData, order.autoPrint);
    });

    // Handle items that didn't match any counter
    if (uncategorizedItems.length > 0) {
      promises.push((async () => {
        const kotId = this.generateKOTId(order.id, 'uncategorized');
        const kotData = {
          orderId: order.id,
          orderNumber: order.orderNumber,
          externalLabel: order.externalLabel,
          userRollNo: order.userRollNo,
          items: uncategorizedItems.map(i => ({
            name: i.name.toUpperCase(),
            qty: i.qty
          })),
          slotName: order.slotName,
          createdAt: order.createdAt,
          isUncategorized: true
        };
        await this.pushKOTToQueue('uncategorized', kotId, kotData, order.autoPrint);
      })());
    }

    await Promise.all(promises);
  }
};
