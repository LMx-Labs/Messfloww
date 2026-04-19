import { get, ref, remove, runTransaction as rtdbRunTransaction } from "firebase/database";
import { runTransaction as firestoreRunTransaction, doc, setDoc } from "firebase/firestore";
import { rtdb, db } from "../../core/firebase";
import { toast } from "sonner";

export const slotCloseService = {
  async refundPendingOrders(slotName: string) {
    const activeOrdersRef = ref(rtdb, "active_orders");
    const snap = await get(activeOrdersRef);
    if (!snap.exists()) return;

    const allOrders = snap.val();
    let refundCount = 0;
    let totalRefundAmount = 0;

    for (const [orderId, order] of Object.entries<any>(allOrders)) {
      if (order.slotName === slotName && (order.status === "ordered" || order.status === "pending" || order.status === "preparing")) {
        try {
          // 1. Credit wallet & student balance via Firestore transaction
          if (order.payment_mode === "credit" && order.userId && order.userRollNo) {
             const userRef = doc(db, "users", order.userId);
             const studentRef = doc(db, "students", order.userRollNo);
             
             await firestoreRunTransaction(db, async (transaction) => {
               const userSnap = await transaction.get(userRef);
               if (userSnap.exists()) {
                 const currentBal = userSnap.data().walletBalance || 0;
                 transaction.update(userRef, {
                   walletBalance: currentBal + order.totalPrice,
                   updatedAt: new Date().toISOString()
                 });
               }
               
               const studentSnap = await transaction.get(studentRef);
               if (studentSnap.exists()) {
                 const stBal = studentSnap.data().balance || 0;
                 const stCred = studentSnap.data().credits || 0;
                 transaction.update(studentRef, {
                   balance: stBal + order.totalPrice,
                   credits: stCred + order.totalPrice
                 });
               }
             });
          }

          // 2. Archive to historical_orders
          order.status = "refunded";
          order.updatedAt = new Date().toISOString();
          await setDoc(doc(db, "historical_orders", orderId), {
            ...order,
            archivedAt: new Date().toISOString()
          });

          // 3. Re-increment stock via RTDB transaction
          if (order.items && Array.isArray(order.items)) {
             for (const item of order.items) {
               const itemStockRef = ref(rtdb, `menu_stock/${item.id}`);
               await rtdbRunTransaction(itemStockRef, (currentData) => {
                 if (currentData !== null) {
                    currentData.stock = (currentData.stock || 0) + (item.qty || item.quantity || 1);
                    if (currentData.stock > (currentData.minStock || 0)) {
                      currentData.available = true;
                    }
                 }
                 return currentData;
               });
             }
          }

          // 4. Remove from active RTDB
          await remove(ref(rtdb, `active_orders/${orderId}`));
          
          refundCount++;
          totalRefundAmount += order.totalPrice;
        } catch (e) {
          console.error(`Failed to refund order ${orderId}`, e);
        }
      }
    }

    if (refundCount > 0) {
      toast.success(`Slot closed: Refunded ${refundCount} orders (₹${totalRefundAmount})`);
    } else {
      toast.info(`Slot closed: No pending orders to refund.`);
    }
  }
};
