import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as https from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { randomUUID } from 'crypto';
/*
import { transporter, SENDER_EMAIL } from './config/mailer';
import { getDailyRevenueSummary, getLowStockAlerts } from './services/dataAggregator';
import { generateReportEmailHTML } from './services/emailTemplates';
*/

// Admin initialized in dataAggregator.ts, but let's ensure it here just in case this loads first
if (admin.apps.length === 0) {
  admin.initializeApp({
    databaseURL: "https://messfloww-default-rtdb.asia-southeast1.firebasedatabase.app"
  });
}

// ─── Module-level menu price cache (persists across warm CF invocations) ────
let cachedMenu: Map<string, { price: number; name: string }> | null = null;
let menuCacheExpiry = 0;

async function getMenuPrices(db: admin.firestore.Firestore): Promise<Map<string, { price: number; name: string }>> {
  if (cachedMenu && Date.now() < menuCacheExpiry) return cachedMenu as any;
  const snap = await db.collection('menu').get();
  const priceMap = new Map<string, { price: number; name: string }>();
  // Each document in the 'menu' collection IS one menu item (not a nested array)
  snap.docs.forEach(d => {
    const data = d.data();
    const id = data.id !== undefined ? String(data.id) : d.id;
    const price = Number(data.price || 0);
    const name = String(data.name || 'Unknown Item');
    priceMap.set(id, { price, name });
  });
  cachedMenu = priceMap as any;
  menuCacheExpiry = Date.now() + 5 * 60 * 1000; // 5-minute TTL
  return priceMap;
}

/** Generate a cryptographically secure, non-guessable order ID */
function generateSecureOrderId(): string {
  return `MFW-${randomUUID().replace(/-/g, '').substring(0, 12).toUpperCase()}`;
}

/**
 * Hourly Cron Job: Processes active report subscriptions and emails them.
 * Efficiency constraints: Limit queries, optimize sends.
 */
// processSubscriptions: removed — email reporting feature not active.



/**
 * securePlaceOrder: The "Aspirin Logic" Checkout Flow
 * 1. Checks if Admin is Online.
 * 2. Checks if the student's status is "active".
 * 3. Checks if wallet balance is sufficient.
 * 4. Checks RTDB stock counts.
 * 5. Atomically performs deductions and creates the order.
 */
export const securePlaceOrder = https.onCall(async (request: https.CallableRequest) => {
  const { data, auth } = request;
  
  if (!auth?.uid) {
    throw new https.HttpsError('unauthenticated', 'You must be logged in to place an order.');
  }

  const { cart, totalPrice, slotName, paymentMode } = data as { cart: any[], totalPrice: number, slotName: string, paymentMode: string };
  
  if (!cart || cart.length === 0 || !totalPrice || !slotName) {
    throw new https.HttpsError('invalid-argument', 'Missing required order fields.');
  }

  const db = admin.firestore();
  const rtdb = admin.database();

  try {
    // 1. Verify Admin is Online (Kill-Switch)
    const systemStatusSnap = await rtdb.ref('system_status/admin_online').once('value');
    const isAdminOnline = systemStatusSnap.val();
    
    if (isAdminOnline === false) {
      throw new https.HttpsError('failed-precondition', 'Admin is offline. Orders cannot be placed at this time.');
    }

    // Generate cryptographically secure, non-guessable order ID
    const orderId = generateSecureOrderId();
    // Get order counter for today
    const today = new Date().toISOString().split('T')[0];
    const dailyCounterRef = db.doc(`orderCounters/${today}`);
    const result = await db.runTransaction(async (transaction) => {
      // 2. Load User and Student records
      const userRef = db.collection('users').doc(auth.uid);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) {
        throw new https.HttpsError('not-found', 'User profile not found.');
      }
      
      const rollNo = userSnap.data()?.rollNo;
      if (!rollNo || rollNo === 'UNREGISTERED' || rollNo === 'EXTERNAL') {
        throw new https.HttpsError('failed-precondition', 'You must be a registered student to place an order with credits.');
      }

      const studentRef = db.collection('students').doc(rollNo);
      const studentSnap = await transaction.get(studentRef);
      if (!studentSnap.exists) {
        throw new https.HttpsError('not-found', 'Student record not found.');
      }

      const studentData = studentSnap.data();

      // Verify Status
      if (studentData?.status === 'disabled') {
        throw new https.HttpsError('permission-denied', 'Account has been disabled. Order denied.');
      }

      // 3. Check Wallet Balance if paying by credit
      if (paymentMode === 'credit') {
        const balance = studentData?.balance || 0;
        if (balance < totalPrice) {
          throw new https.HttpsError('resource-exhausted', 'Insufficient wallet balance.');
        }
      }

      // Read Daily Counter for receipt number
      const counterSnap = await transaction.get(dailyCounterRef);
      let orderNumber = 1;
      if (counterSnap.exists) {
        orderNumber = (counterSnap.data()?.count || 0) + 1;
      }

      // We cannot easily lock RTDB stock inside a Firestore transaction.
      // So we will optimistically decrement Firestore, then try RTDB.
      // If RTDB fails, we revert Firestore. This is cross-DB pseudo-transaction.
      // A better way is using Admin SDK to check stock via RTDB transaction FIRST.
      // Wait, let's do RTDB transaction inside Firestore transaction? It's async. We can!
      
      return { userSnap, studentRef, studentData, dailyCounterRef, orderNumber, counterExists: counterSnap.exists };
    });

    // 4. Perform RTDB Stock checks and deductions atomically for ALL items
    // Using multi-path update to decrement stock IF stock is sufficient.
    // However, multi-path update cannot do conditional checks directly without Security Rules.
    // Instead, we can read stock, check array, and write back in one transaction on the root /menu_stock, 
    // or just run a transaction on each item.
    // Let's do parallel transactions on RTDB for stock.
    const stockReverts: { ref: admin.database.Reference, qty: number }[] = [];
    let stockFailed = false;
    let failedItemName = '';

    for (const item of cart) {
      const stockRef = rtdb.ref(`menu_stock/${item.id}`);
      const fallbackResult = await stockRef.transaction((currentData) => {
        if (currentData === null) return currentData;
        if ((currentData.stock || 0) >= item.qty) {
          currentData.stock -= item.qty;
          if (currentData.stock <= (currentData.minStock || 0)) {
            currentData.available = false;
          }
          return currentData;
        }
        return undefined; // Abort transaction
      });

      if (!fallbackResult.committed) {
        stockFailed = true;
        failedItemName = item.name;
        break;
      } else {
        stockReverts.push({ ref: stockRef, qty: item.qty });
      }
    }

    if (stockFailed) {
      // Revert any decremented stock
      for (const revert of stockReverts) {
        await revert.ref.transaction((currentData) => {
          if (currentData !== null) {
            currentData.stock = (currentData.stock || 0) + revert.qty;
            if (currentData.stock > (currentData.minStock || 0)) {
              currentData.available = true;
            }
          }
          return currentData;
        });
      }
      throw new https.HttpsError('resource-exhausted', `Out of stock: ${failedItemName}`);
    }

    // Now complete the Firestore wallet deduction securely
    await db.runTransaction(async (transaction) => {
       const studentSnap = await transaction.get(result.studentRef);
       if (paymentMode === 'credit') {
         const newBal = (studentSnap.data()?.balance || 0) - totalPrice;
         const newCred = (studentSnap.data()?.credits || 0) - totalPrice;
         transaction.update(result.studentRef, { balance: newBal, credits: newCred });
         
         // Sync walletBalance to users/{uid} for consistency
         const userRef = db.collection('users').doc(auth.uid);
         transaction.update(userRef, { walletBalance: newBal });
         
         const ledgerRef = db.collection('ledger').doc();
         transaction.set(ledgerRef, {
           type: 'purchase',
           studentRegNo: result.studentData!.regNo,
           studentUid: auth.uid,
           amount: totalPrice,
           orderId: orderId,
           timestamp: admin.firestore.FieldValue.serverTimestamp(),
           description: `Order ${orderId}`
         });
       }
       if (result.counterExists) {
         transaction.update(result.dailyCounterRef, { count: result.orderNumber });
       } else {
         transaction.set(result.dailyCounterRef, { count: result.orderNumber, date: today });
       }
    });

    // 5. Create Order in RTDB
    const nowTimestamp = Date.now();
    const messStatusSnap = await rtdb.ref('mess_status').once('value');
    const currentlyServing = messStatusSnap.exists() ? messStatusSnap.val().currentlyServing || 0 : 0;
    const queuePosition = Math.max(0, result.orderNumber - currentlyServing);
    const waitTimeSeconds = queuePosition * 3; // 3 seconds per order
    
    // Calculate estimate window
    const startTimeDate = new Date(nowTimestamp + waitTimeSeconds * 1000);
    const endTimeDate = new Date(startTimeDate.getTime() + 180 * 1000);
    const formatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    // Keep it generic or use JS formatting
    const estimatedServingWindow = `${formatter.format(startTimeDate)} - ${formatter.format(endTimeDate)}`;

    // Enrich cart items with canonical names & prices from Firestore menu
    // This prevents "Unknown Item" errors in scanning/KDS downstream
    const menuItems = await getMenuPrices(db);
    const enrichedCart = cart.map((item: any) => {
      const menuEntry = menuItems.get(String(item.id));
      return {
        id: item.id,
        name: menuEntry?.name || item.name || 'Unknown Item',
        price: menuEntry?.price ?? item.price ?? 0,
        qty: item.qty || item.quantity || 1,
      };
    });

    const newOrder = {
      id: orderId,
      orderNumber: result.orderNumber,
      userId: auth.uid,
      userRollNo: result.studentData!.regNo,
      items: enrichedCart,
      totalPrice,
      slotName,
      payment_mode: paymentMode,
      status: 'ordered',
      sync_status: 'cloud',
      estimatedServingWindow,
      createdAt: new Date().toISOString(),
      timestamp: admin.database.ServerValue.TIMESTAMP
    };

    await rtdb.ref(`active_orders/${orderId}`).set(newOrder);

    return { success: true, orderId, orderNumber: result.orderNumber, estimatedServingWindow };

  } catch (error: any) {
    functions.logger.error('securePlaceOrder failed', JSON.stringify({
      message: error?.message,
      code: error?.code,
      details: error?.details,
      httpErrorCode: error?.httpErrorCode,
      stack: error?.stack?.substring(0, 500),
    }));
    // HttpsError thrown inside db.runTransaction gets wrapped by Firestore.
    // Check for it directly first, then look for wrapped message patterns.
    if (error instanceof https.HttpsError) {
      throw error;
    }
    // Firestore wraps thrown errors — try to extract meaningful message
    const msg = error?.message || 'Transaction failed';
    // Map common Firestore/RTDB error messages back to useful codes
    if (msg.includes('Insufficient wallet balance')) {
      throw new https.HttpsError('resource-exhausted', msg);
    }
    if (msg.includes('Student record not found') || msg.includes('User profile not found')) {
      throw new https.HttpsError('not-found', msg);
    }
    if (msg.includes('registered student') || msg.includes('disabled') || msg.includes('Admin is offline')) {
      throw new https.HttpsError('failed-precondition', msg);
    }
    if (msg.includes('Out of stock')) {
      throw new https.HttpsError('resource-exhausted', msg);
    }
    throw new https.HttpsError('internal', msg);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// securePlaceUpiOrder — Server-side UPI order with price validation
// ─────────────────────────────────────────────────────────────────────────────
export const securePlaceUpiOrder = https.onCall(async (request: https.CallableRequest) => {
  const { data, auth } = request;

  if (!auth?.uid) {
    throw new https.HttpsError('unauthenticated', 'You must be logged in to place an order.');
  }

  const { cart, totalPrice: clientTotalPrice, slotName } = data as {
    cart: { id: string; name: string; qty: number; price: number }[];
    totalPrice: number;
    slotName: string;
  };

  if (!cart || cart.length === 0 || !slotName) {
    throw new https.HttpsError('invalid-argument', 'Missing required order fields.');
  }

  const db = admin.firestore();
  const rtdb = admin.database();

  try {
    // 1. Kill-switch: verify admin is online
    const adminOnlineSnap = await rtdb.ref('system_status/admin_online').once('value');
    if (adminOnlineSnap.val() === false) {
      throw new https.HttpsError('failed-precondition', 'Admin is offline. Orders cannot be placed at this time.');
    }

    // 2. Server-side price validation against Firestore menu (cached)
    const menuPrices = await getMenuPrices(db);
    let serverTotalPrice = 0;
    for (const item of cart) {
      const menuEntry = menuPrices.get(String(item.id));
      if (menuEntry === undefined) {
        throw new https.HttpsError('invalid-argument', `Unknown menu item: ${item.name}`);
      }
      serverTotalPrice += menuEntry.price * item.qty;
    }

    // Reject if client price differs by more than ₹1 (spoofing guard)
    if (Math.abs(clientTotalPrice - serverTotalPrice) > 1) {
      functions.logger.warn('UPI price spoofing attempt detected', {
        uid: auth.uid, clientPrice: clientTotalPrice, serverPrice: serverTotalPrice
      });
      throw new https.HttpsError('invalid-argument',
        `Price mismatch: expected ₹${serverTotalPrice}, received ₹${clientTotalPrice}.`);
    }

    // 3. Verify user type and status
    const userSnap = await db.collection('users').doc(auth.uid).get();
    if (!userSnap.exists) throw new https.HttpsError('not-found', 'User profile not found.');
    const userData = userSnap.data();
    const userType = userData?.userType;
    let rollNo = userData?.rollNo || 'EXTERNAL';

    if (userType === 'internal') {
      if (!rollNo || rollNo === 'EXTERNAL' || rollNo === 'UNREGISTERED') {
         throw new https.HttpsError('failed-precondition', 'Internal user missing roll number.');
      }
      const studentSnap = await db.collection('students').doc(rollNo).get();
      if (!studentSnap.exists) throw new https.HttpsError('not-found', 'Student record not found.');
      if (studentSnap.data()?.status === 'disabled') {
        throw new https.HttpsError('permission-denied', 'Account has been disabled.');
      }
    } else {
      // For external/guest users
      if (userData?.status === 'disabled') {
         throw new https.HttpsError('permission-denied', 'Guest account has been disabled.');
      }
      rollNo = 'EXTERNAL';
    }

    // 4. Atomically decrement RTDB stock (same pattern as securePlaceOrder)
    const stockReverts: { ref: admin.database.Reference; qty: number }[] = [];
    for (const item of cart) {
      const stockRef = rtdb.ref(`menu_stock/${item.id}`);
      const result = await stockRef.transaction((currentData) => {
        if (currentData === null) return currentData;
        if ((currentData.stock || 0) >= item.qty) {
          currentData.stock -= item.qty;
          if (currentData.stock <= (currentData.minStock || 0)) currentData.available = false;
          return currentData;
        }
        return undefined; // Abort
      });
      if (!result.committed) {
        // Revert already-decremented stock
        for (const revert of stockReverts) {
          await revert.ref.transaction((d) => {
            if (d !== null) { d.stock = (d.stock || 0) + revert.qty; d.available = true; }
            return d;
          });
        }
        throw new https.HttpsError('resource-exhausted', `Out of stock: ${item.name}`);
      }
      stockReverts.push({ ref: stockRef, qty: item.qty });
    }

    // 5. Increment daily order counter in Firestore
    const today = new Date().toISOString().split('T')[0];
    const dailyCounterRef = db.doc(`orderCounters/${today}`);
    let orderNumber = 1;
    await db.runTransaction(async (tx) => {
      const counterSnap = await tx.get(dailyCounterRef);
      orderNumber = (counterSnap.exists ? (counterSnap.data()?.count || 0) : 0) + 1;
      if (counterSnap.exists) {
        tx.update(dailyCounterRef, { count: orderNumber });
      } else {
        tx.set(dailyCounterRef, { count: orderNumber, date: today });
      }
    });

    // 6. Create order in RTDB via Admin SDK (bypasses client write rules)
    // Enrich cart items with canonical names & prices to prevent "Unknown Item" in scanning/KDS
    const menuItems = await getMenuPrices(db);
    const enrichedCart = cart.map((item: any) => {
      const menuEntry = menuItems.get(String(item.id));
      return {
        id: item.id,
        name: menuEntry?.name || item.name || 'Unknown Item',
        price: menuEntry?.price ?? item.price ?? 0,
        qty: item.qty || item.quantity || 1,
      };
    });

    const orderId = generateSecureOrderId();
    const now = Date.now();
    const newOrder = {
      id: orderId,
      orderNumber,
      userId: auth.uid,
      userRollNo: rollNo,
      userType: userType === 'external' ? 'guest' : 'student',
      items: enrichedCart,
      totalPrice: serverTotalPrice,
      slotName,
      payment_mode: 'upi',
      status: 'pending',
      paymentStatus: 'PENDING',
      qrUsed: false,
      sync_status: 'cloud',
      createdAt: new Date(now).toISOString(),
      timestamp: admin.database.ServerValue.TIMESTAMP,
    };
    await rtdb.ref(`active_orders/${orderId}`).set(newOrder);

    functions.logger.info('UPI order created', { orderId, uid: auth.uid, amount: serverTotalPrice });
    return { success: true, orderId, orderNumber };

  } catch (error: any) {
    if (error instanceof https.HttpsError) throw error;
    throw new https.HttpsError('internal', error?.message || 'Failed to place UPI order.');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// collectOrder — Atomically mark order as collected (replaces client atomicCollectOrder)
// ─────────────────────────────────────────────────────────────────────────────
export const collectOrder = https.onCall(async (request: https.CallableRequest) => {
  const { data, auth } = request;

  if (!auth?.uid) {
    throw new https.HttpsError('unauthenticated', 'Authentication required.');
  }

  const { orderId } = data as { orderId: string };
  if (!orderId) throw new https.HttpsError('invalid-argument', 'orderId is required.');

  const rtdb = admin.database();
  const orderRef = rtdb.ref(`active_orders/${orderId}`);

  let collectedOrder: any = null;

  const txResult = await orderRef.transaction((order) => {
    if (order === null) return order; // Abort — not found
    if (order.qrUsed === true) {
      throw new Error('ORDER_ALREADY_COLLECTED');
    }
    if (order.paymentStatus === 'PENDING') {
      throw new Error('PAYMENT_PENDING');
    }
    const terminalStatuses = ['collected', 'expired', 'cancelled'];
    if (terminalStatuses.includes(order.status)) {
      throw new Error('ORDER_ALREADY_COLLECTED');
    }
    order.qrUsed = true;
    order.status = 'processing';
    order.paymentStatus = order.paymentStatus === 'PAID' ? 'PAID' : 'REDEEMED';
    order.scannedAt = new Date().toISOString();
    collectedOrder = { ...order };
    return order;
  });

  if (!txResult.committed) {
    throw new https.HttpsError('not-found', 'Order not found.');
  }

  functions.logger.info('Order collected', { orderId, uid: auth.uid });
  return { success: true, order: { id: orderId, ...collectedOrder } };
});

// ─────────────────────────────────────────────────────────────────────────────
// confirmAndCollectUpiOrder — Confirm UPI payment + collect in one atomic transaction
// ─────────────────────────────────────────────────────────────────────────────
export const confirmAndCollectUpiOrder = https.onCall(async (request: https.CallableRequest) => {
  const { data, auth } = request;

  if (!auth?.uid) {
    throw new https.HttpsError('unauthenticated', 'Authentication required.');
  }

  const { orderId } = data as { orderId: string };
  if (!orderId) throw new https.HttpsError('invalid-argument', 'orderId is required.');

  const rtdb = admin.database();
  const orderRef = rtdb.ref(`active_orders/${orderId}`);
  const now = new Date().toISOString();

  let collectedOrder: any = null;

  const txResult = await orderRef.transaction((order) => {
    if (order === null) return order; // Abort — not found
    if (order.paymentStatus !== 'PENDING') {
      throw new Error('PAYMENT_NOT_PENDING');
    }
    if (order.qrUsed === true) {
      throw new Error('ORDER_ALREADY_COLLECTED');
    }
    order.paymentStatus = 'PAID';
    order.qrUsed = true;
    order.status = 'processing';
    order.paidAt = now;
    order.scannedAt = now;
    collectedOrder = { ...order };
    return order;
  });

  if (!txResult.committed) {
    throw new https.HttpsError('not-found', 'Order not found.');
  }

  functions.logger.info('UPI order confirmed and collected', { orderId, uid: auth.uid });
  return { success: true, order: { id: orderId, ...collectedOrder } };
});

// ─────────────────────────────────────────────────────────────────────────────
// cancelStalePendingOrders — Cron: auto-cancel PENDING UPI orders older than 15 min
// ─────────────────────────────────────────────────────────────────────────────
export const cancelStalePendingOrders = onSchedule(
  { schedule: 'every 5 minutes', timeZone: 'Asia/Kolkata' },
  async () => {
    const rtdb = admin.database();
    const firestoreDb = admin.firestore();
    const cutoffMs = Date.now() - 15 * 60 * 1000; // 15 minutes ago

    const snap = await rtdb.ref('active_orders').once('value');
    if (!snap.exists()) {
      functions.logger.info('cancelStalePendingOrders: no active orders.');
      return;
    }

    const staleOrders: any[] = [];
    snap.forEach((child) => {
      const order = child.val();
      if (
        order?.paymentStatus === 'PENDING' &&
        new Date(order.createdAt).getTime() < cutoffMs
      ) {
        staleOrders.push({ id: child.key, ...order });
      }
    });

    if (staleOrders.length === 0) {
      functions.logger.info('cancelStalePendingOrders: no stale orders.');
      return;
    }

    for (const order of staleOrders) {
      try {
        // 1. Revert stock atomically per item
        for (const item of order.items || []) {
          await rtdb.ref(`menu_stock/${item.id}`).transaction((stock) => {
            if (!stock) return stock;
            stock.stock = (stock.stock || 0) + item.qty;
            if (stock.stock > (stock.minStock || 0)) stock.available = true;
            return stock;
          });
        }

        // 2. Archive to Firestore
        const cancelledOrder = {
          ...order,
          status: 'expired',
          paymentStatus: 'CANCELLED',
          cancelledAt: new Date().toISOString(),
          cancelReason: 'auto_expired_15min',
          archivedAt: new Date().toISOString(),
        };
        await firestoreDb.collection('historical_orders').doc(order.id).set(cancelledOrder);

        // 3. Remove from RTDB
        await rtdb.ref(`active_orders/${order.id}`).remove();

        functions.logger.info('Auto-cancelled stale order', { orderId: order.id });
      } catch (err) {
        functions.logger.error('Failed to cancel order', { orderId: order.id, err });
      }
    }

    functions.logger.info(`cancelStalePendingOrders: cancelled ${staleOrders.length} orders.`);
  }
);
