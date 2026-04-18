import { ref, onValue, set, get, runTransaction, push, query as rtdbQuery, orderByChild, equalTo } from "firebase/database";
import { rtdb, db } from "../../core/firebase/config";
import { doc, getDoc, writeBatch } from "firebase/firestore";
import { OrderItem, MealSlot } from "./orderService";

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
    
    const stockRollbacks: { ref: any, qty: number }[] = [];
    const newStocks: Record<number, number> = {};
    
    try {
      // 1. RTDB Stock Check & Decrement
      for (const item of items) {
        const itemRef = ref(rtdb, `menu_stock/${item.id}`);
        const result = await runTransaction(itemRef, (data) => {
          if (data === null) return data; // Node doesn't exist yet, can't order
          
          if (data.stock >= item.qty && (data.available || data.stock > 0)) {
            data.stock -= item.qty;
            if (data.stock <= (data.minStock || 0)) {
              data.available = false;
            }
            return data;
          } else {
            return; // Abort transaction
          }
        });
        
        if (!result.committed) {
          throw new Error(`${item.name} is out of stock`);
        } else {
          stockRollbacks.push({ ref: itemRef, qty: item.qty });
          newStocks[item.id] = result.snapshot.val().stock;
        }
      }

      // 2. Firestore Wallet Update & Counter
      const batch = writeBatch(db);
      const userRef = doc(db, "users", userId);
      const studentRef = doc(db, "students", userRollNo);
      
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) throw new Error("User not found");
      const currentBalance = userSnap.data().walletBalance || 0;
      if (currentBalance < totalPrice) throw new Error("Insufficient funds");
      
      const studentSnap = await getDoc(studentRef);

      // Counters & Estimation
      const messStatusSnap = await get(ref(rtdb, "mess_status"));
      const currentlyServing = messStatusSnap.exists() ? messStatusSnap.val().currentlyServing || 0 : 0;
      
      const today = new Date().toISOString().split('T')[0];
      const counterRef = doc(db, "orderCounters", today);
      const counterSnap = await getDoc(counterRef);
      
      let nextNumber = 1;
      if (counterSnap.exists()) {
        nextNumber = counterSnap.data().count + 1;
        batch.update(counterRef, { count: nextNumber });
      } else {
        batch.set(counterRef, { count: 1 });
      }

      // Updates
      batch.update(userRef, { 
        walletBalance: currentBalance - totalPrice, 
        updatedAt: new Date().toISOString() 
      });
      if (studentSnap.exists()) {
        batch.update(studentRef, { 
          balance: currentBalance - totalPrice, 
          credits: currentBalance - totalPrice 
        });
      }

      // Sync Stock to Firestore
      for (const [itemId, stock] of Object.entries(newStocks)) {
        const menuRef = doc(db, "menu", itemId);
        batch.update(menuRef, { stock: stock });
      }
      
      await batch.commit();

      // Calculation
      const queuePosition = Math.max(0, nextNumber - currentlyServing);
      const waitTimeSeconds = queuePosition * 3; // 3 seconds per order
      
      const now = new Date();
      const startTime = new Date(now.getTime() + waitTimeSeconds * 1000);
      const endTime = new Date(startTime.getTime() + 180 * 1000); // 3 minute window
      
      const formatTime = (date: Date) => date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const estimatedServingWindow = `${formatTime(startTime)} - ${formatTime(endTime)}`;

      // 3. Push Order to RTDB
      const activeOrdersRef = ref(rtdb, "active_orders");
      const newOrderRef = push(activeOrdersRef);
      const orderId = newOrderRef.key!;
      
      await set(newOrderRef, {
        id: orderId,
        userId,
        userRollNo,
        items,
        totalPrice,
        status: "ordered",
        slotName: slotInfo.name,
        slotTime: slotInfo.time,
        counterNumber: 1,
        orderNumber: nextNumber,
        estimatedServingWindow,
        qrUsed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      return { id: orderId, orderNumber: nextNumber, estimatedServingWindow };

    } catch (error) {
      // Rollback RTDB Stock
      for (const rollback of stockRollbacks) {
        await runTransaction(rollback.ref, (data) => {
          if (data === null) return data;
          data.stock += rollback.qty;
          if (data.stock > (data.minStock || 0)) {
            data.available = true;
          }
          return data;
        });
      }
      throw error;
    }
  }
};
