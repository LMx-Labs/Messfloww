import * as admin from 'firebase-admin';

// Initialize admin app if not already initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Returns summary stats for daily revenue to embed in the email.
 */
export const getDailyRevenueSummary = async (date: Date = new Date()) => {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23,59,59,999);

    const q = db.collection("orders")
      .where("createdAt", ">=", startOfDay.toISOString())
      .where("createdAt", "<=", endOfDay.toISOString())
      .where("status", "==", "completed");
      
    const snapshot = await q.get();
    
    let totalRevenue = 0;
    let orderCount = snapshot.size;

    snapshot.forEach(doc => {
      const data = doc.data();
      totalRevenue += (data.totalPrice || 0);
    });

    return {
      date: date.toISOString().split('T')[0],
      totalRevenue,
      orderCount,
      avgOrderValue: orderCount > 0 ? totalRevenue / orderCount : 0
    };
  } catch (error) {
    console.error("Error aggregating daily revenue:", error);
    return null;
  }
};

/**
 * Returns low stock alerts using a single pass across the menu collection.
 */
export const getLowStockAlerts = async (threshold: number = 20) => {
  try {
    const q = db.collection("menu").where("stock", "<=", threshold);
    const snapshot = await q.get();
    
    const alerts: any[] = [];
    snapshot.forEach(doc => {
      alerts.push({ id: doc.id, ...doc.data() });
    });
    
    return alerts;
  } catch (error) {
    console.error("Error fetching low stock alerts:", error);
    return [];
  }
};
