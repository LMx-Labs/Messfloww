import { collection, query, where, orderBy, limit, startAfter, onSnapshot, getDocs, QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "../../core/firebase";

const LEDGER_COLLECTION = "ledger";

export const subscribeLedger = (callback: (entries: any[]) => void) => {
  return onSnapshot(collection(db, LEDGER_COLLECTION), (snapshot) => {
    const entries: any[] = [];
    snapshot.forEach((doc) => {
      entries.push({ id: doc.id, ...doc.data() });
    });
    entries.sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
    callback(entries);
  }, (error) => {
    console.error("Error subscribing to ledger: ", error);
  });
};

export const subscribeStudentLedger = (regNo: string, callback: (entries: any[]) => void) => {
  const q = query(collection(db, LEDGER_COLLECTION), where("studentRegNo", "==", regNo));
  return onSnapshot(q, (snapshot) => {
    const entries: any[] = [];
    snapshot.forEach((doc) => {
      entries.push({ id: doc.id, ...doc.data() });
    });
    entries.sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
    callback(entries);
  }, (error) => {
    console.error("Error subscribing to student ledger: ", error);
  });
};

export const subscribeStudentHistoricalOrders = (regNo: string, callback: (orders: any[]) => void) => {
  const q = query(collection(db, "historical_orders"), where("userRollNo", "==", regNo));
  return onSnapshot(q, (snapshot) => {
    const orders: any[] = [];
    snapshot.forEach((doc) => {
      orders.push({ id: doc.id, ...doc.data() });
    });
    // Sort by createdAt descending
    orders.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeB - timeA;
    });
    callback(orders);
  }, (error) => {
    console.error("Error subscribing to student historical orders: ", error);
  });
};

/**
 * Fetches ALL historical orders for report generation. 
 * Warning: Use with caution on very large collections.
 */
export const fetchAllHistoricalOrders = async () => {
  try {
    const q = query(
      collection(db, "historical_orders"),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching all historical orders:", error);
    throw error;
  }
};

/**
 * Fetches a single page of ledger entries (historical orders).
 */
export const fetchLedgerPage = async (
  pageSize: number,
  lastDocSnapshot?: QueryDocumentSnapshot
) => {
  try {
    let q = query(
      collection(db, "historical_orders"),
      orderBy("createdAt", "desc"),
      limit(pageSize)
    );
    
    if (lastDocSnapshot) {
      q = query(q, startAfter(lastDocSnapshot));
    }
    
    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    return {
      orders,
      lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
      hasMore: snapshot.docs.length === pageSize
    };
  } catch (error) {
    console.error("Error fetching ledger page:", error);
    throw error;
  }
};
