import { doc, updateDoc, increment, collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../../core/firebase/config";
import { OrderDoc } from "./orderService";

export const staffService = {
  /**
   * Subscribes to all active orders (preparing or ready)
   */
  subscribeToActiveOrders(callback: (orders: OrderDoc[]) => void) {
    const ordersRef = collection(db, "orders");
    const q = query(
      ordersRef,
      where("status", "in", ["preparing", "ready"]),
      orderBy("createdAt", "asc")
    );

    return onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as OrderDoc[];
      callback(orders);
    });
  },

  /**
   * Increments the global 'Currently Serving' number
   */
  async serveNextOrder() {
    const statusRef = doc(db, "messStatus", "current");
    await updateDoc(statusRef, {
      currentlyServing: increment(1)
    });
  },

  /**
   * Updates an order status
   */
  async updateOrderStatus(orderId: string, status: "ready" | "completed") {
    const orderRef = doc(db, "orders", orderId);
    await updateDoc(orderRef, {
      status,
      updatedAt: new Date().toISOString(),
      ...(status === "completed" ? { qrUsed: true } : {})
    });
  }
};
