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
let cachedMenu: Map<string, number> | null = null;
let menuCacheExpiry = 0;

async function getMenuPrices(db: admin.firestore.Firestore): Promise<Map<string, number>> {
  if (cachedMenu && Date.now() < menuCacheExpiry) return cachedMenu;
  const snap = await db.collection('menu').get();
  const priceMap = new Map<string, number>();
  snap.docs.forEach(d => {
    const items: any[] = d.data().items || [];
    items.forEach((item: any) => priceMap.set(String(item.id), Number(item.price || 0)));
  });
  cachedMenu = priceMap;
  menuCacheExpiry = Date.now() + 5 * 60 * 1000; // 5-minute TTL
  return cachedMenu;
}

/** Generate a cryptographically secure, non-guessable order ID */
function generateSecureOrderId(): string {
  return `MFW-${randomUUID().replace(/-/g, '').substring(0, 12).toUpperCase()}`;
}

/**
 * Hourly Cron Job: Processes active report subscriptions and emails them.
 * Efficiency constraints: Limit queries, optimize sends.
 */
/*
export const processSubscriptions = functions.pubsub.schedule('every 1 hours').onRun(async (context: any) => {
  const db = admin.firestore();
  
  // Current hour string matching the format stored in DB: "22:00"
  // Since server might be UTC, we should either run it in a specific timezone or 
  // allow the user to define timezone in frontend. For simplicity, we assume UTC matching string.
  // We'll pad hour: "09:00"
  const now = new Date();
  const currentHourString = `${now.getHours().toString().padStart(2, '0')}:00`;

  functions.logger.info(`Running subscription processor at ${currentHourString} (UTC)`);

  try {
    // 1. Fetch only ACTIVE subscriptions that are due to be sent AT THIS HOUR
    // This dramatically reduces our read costs.
    const subsRef = db.collection('report_subscriptions');
    const q = subsRef
      .where('enabled', '==', true)
      // .where('sendTime', '==', currentHourString); // Optional: filter by time inside the query if indexed, or in memory
      
    const snapshot = await q.get();
    
    if (snapshot.empty) {
      functions.logger.info("No active subscriptions found for this hour.");
      return null;
    }

    // 2. Fetch Aggregated Data ONCE (Singleton pattern) 
    // instead of fetching per subscription to save read operations
    const revenueSummary = await getDailyRevenueSummary();
    const lowStockAlerts = await getLowStockAlerts();

    // 3. Process each subscription
    const emailPromises: Promise<any>[] = [];

    snapshot.forEach(docSnap => {
      const sub = docSnap.data();
      
      // In-memory filter for time and frequency to avoid complex composite indexes
      if (sub.sendTime !== currentHourString) return; 
      
      // Check frequency (simplified: daily sends every day)
      if (sub.frequency !== 'daily') {
         // Logic for weekly/monthly checks would go here based on now.getDay() etc.
         // functions.logger.info(`Skipping non-daily sub ${docSnap.id}`);
         // return;
      }

      // Generate Email HTML
      const htmlBody = generateReportEmailHTML(
        "Subscriber", // Ideally, link userId to a users collection to fetch real name
        revenueSummary,
        lowStockAlerts
      );

      // We define mail options
      const mailOptions = {
        from: `"MessFlow Analytics" <${SENDER_EMAIL}>`,
        to: sub.recipients.join(','),
        subject: `Your MessFlow Daily Report - ${now.toISOString().split('T')[0]}`,
        html: htmlBody,
      };

      // Push to promises array for parallel sending
      emailPromises.push(transporter.sendMail(mailOptions).then(() => {
        // Update lastSent timestamp
        return docSnap.ref.update({
          lastSent: now.toISOString(),
          updatedAt: now.toISOString()
        });
      }));
    });

    // 4. Await all emails and return
    await Promise.all(emailPromises);
    functions.logger.info(`Successfully processed ${emailPromises.length} report subscriptions.`);
    
    return null;

  } catch (error) {
    functions.logger.error("Error processing subscriptions:", error);
    return null;
  }
});
*/



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
         // NOTE: walletBalance sync on users/{uid} intentionally removed — saves 4,500 writes/day.
         // AuthContext re-fetches balance from students collection on session start.
         
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

    const newOrder = {
      id: orderId,
      orderNumber: result.orderNumber,
      userId: auth.uid,
      userRollNo: result.studentData!.regNo,
      items: cart,
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
      const canonicalPrice = menuPrices.get(String(item.id));
      if (canonicalPrice === undefined) {
        throw new https.HttpsError('invalid-argument', `Unknown menu item: ${item.name}`);
      }
      serverTotalPrice += canonicalPrice * item.qty;
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
    const orderId = generateSecureOrderId();
    const now = Date.now();
    const newOrder = {
      id: orderId,
      orderNumber,
      userId: auth.uid,
      userRollNo: rollNo,
      userType: userType === 'external' ? 'guest' : 'student',
      items: cart,
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
