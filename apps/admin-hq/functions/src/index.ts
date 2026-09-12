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
// ─── ARCH-B: Transaction Intent State Machine & Schema ────────────────────────
export type TransactionIntentState =
  | 'INITIALIZED'
  | 'RESERVED'
  | 'FINANCIALLY_COMMITTED'
  | 'COMMITTED'
  | 'CANCELLED'
  | 'FAILED';

export interface TransactionIntentJournal {
  rtdbLeaseAcquired: boolean;
  firestoreWalletDebited: boolean;
  rtdbOrderDispatched: boolean;
  rtdbLeaseReleased: boolean;
  fenceToken?: string;
}

export interface TransactionIntentDocument {
  intentId: string;
  orderId: string;
  userId: string;
  userRollNo: string;
  userType?: string;
  cart: { id: string | number; name: string; qty: number; price: number }[];
  totalPrice: number;
  slotName: string;
  paymentMode: string;
  state: TransactionIntentState;
  leaseExpiresAt: number; // Unix timestamp in ms
  journal: TransactionIntentJournal;
  orderNumber?: number;
  estimatedServingWindow?: string;
  errorMessage?: string;
  createdAt: admin.firestore.Timestamp | admin.firestore.FieldValue | string;
  updatedAt: admin.firestore.Timestamp | admin.firestore.FieldValue | string;
  reconciledAt?: admin.firestore.Timestamp | admin.firestore.FieldValue | string;
}

/**
 * acquireRtdbLeases:
 * Atomically acquires two-phase inventory leases on RTDB with INLINE OCC LAZY LEASE RECLAMATION and FENCING.
 * Generates and associates an immutable fenceToken with the active lease.
 * If any expired leases exist on an item, they are reclaimed on the spot inside the single-threaded OCC callback.
 * If stock is sufficient, reserves the requested quantity and records activeLeases[intentId].
 * If any item fails, rolls back all preceding acquired leases.
 */
export async function acquireRtdbLeases(
  rtdb: admin.database.Database,
  cart: { id: string | number; name: string; qty: number; price?: number }[],
  intentId: string,
  leaseDurationMs: number = 120 * 1000, // 120s default for credit checkout
  fenceToken?: string
): Promise<{ success: boolean; failedItemName?: string; fenceToken?: string }> {
  const acquiredLeases: { ref: admin.database.Reference; qty: number; itemId: string }[] = [];
  const now = Date.now();
  const expiresAt = now + leaseDurationMs;
  const token = fenceToken || `${intentId}-${now}-${randomUUID().replace(/-/g, '').slice(0, 8)}`;

  for (const item of cart) {
    const itemIdStr = String(item.id);
    const stockRef = rtdb.ref(`menu_stock/${itemIdStr}`);
    const qty = Number(item.qty || 1);

    const txResult = await stockRef.transaction((currentData) => {
      if (currentData === null) return currentData;

      // ── INLINE OCC LAZY LEASE RECLAMATION ──
      // Reclaim dead leases on this item before checking available stock
      if (currentData.activeLeases && typeof currentData.activeLeases === 'object') {
        for (const [otherIntentId, lease] of Object.entries(currentData.activeLeases as Record<string, any>)) {
          if (lease && typeof lease.expiresAt === 'number' && lease.expiresAt < now) {
            const expiredQty = Number(lease.qty || 0);
            currentData.stock = (currentData.stock || 0) + expiredQty;
            currentData.reserved = Math.max(0, (currentData.reserved || 0) - expiredQty);
            delete currentData.activeLeases[otherIntentId];
            if (currentData.stock > (currentData.minStock || 0)) {
              currentData.available = true;
            }
          }
        }
      }

      // Check if available unreserved stock is sufficient
      if ((currentData.stock || 0) >= qty) {
        currentData.stock = (currentData.stock || 0) - qty;
        currentData.reserved = (currentData.reserved || 0) + qty;
        if (!currentData.activeLeases) currentData.activeLeases = {};
        currentData.activeLeases[intentId] = { qty, expiresAt, fenceToken: token };

        if (currentData.stock <= (currentData.minStock || 0)) {
          currentData.available = false;
        }
        return currentData;
      }

      return undefined; // Abort transaction — insufficient stock
    });

    if (!txResult.committed) {
      // Rollback all previously acquired leases for this cart
      for (const acquired of acquiredLeases) {
        await acquired.ref.transaction((d) => {
          if (d !== null) {
            if (d.activeLeases && d.activeLeases[intentId]) {
              const leasedQty = d.activeLeases[intentId].qty || acquired.qty;
              d.stock = (d.stock || 0) + leasedQty;
              d.reserved = Math.max(0, (d.reserved || 0) - leasedQty);
              delete d.activeLeases[intentId];
              if (d.stock > (d.minStock || 0)) d.available = true;
            }
          }
          return d;
        });
      }
      return { success: false, failedItemName: item.name };
    }

    acquiredLeases.push({ ref: stockRef, qty, itemId: itemIdStr });
  }

  return { success: true, fenceToken: token };
}

/**
 * commitRtdbLeases:
 * Finalizes two-phase inventory reservation into permanent commitment with FENCING VALIDATION.
 * Validates that activeLeases[intentId] is still actively owned and matching fenceToken.
 * If lease was expired, revoked, or stolen by inline OCC reclamation, the transaction ABORTS.
 * Returns { success: true } if all items committed, or { success: false, reason, failedItemName } if fenced out.
 */
export async function commitRtdbLeases(
  rtdb: admin.database.Database,
  cart: { id: string | number; qty: number; name?: string }[],
  intentId: string,
  fenceToken?: string
): Promise<{ success: boolean; reason?: string; failedItemName?: string }> {
  for (const item of cart) {
    const stockRef = rtdb.ref(`menu_stock/${item.id}`);
    const txResult = await stockRef.transaction((currentData) => {
      if (currentData === null) return currentData;
      if (currentData.activeLeases && currentData.activeLeases[intentId]) {
        const lease = currentData.activeLeases[intentId];
        // If fencing token is specified, verify ownership match
        if (fenceToken && lease.fenceToken && lease.fenceToken !== fenceToken) {
          return undefined; // Mismatch: lease was superseded!
        }
        const leasedQty = lease.qty || item.qty;
        currentData.reserved = Math.max(0, (currentData.reserved || 0) - leasedQty);
        delete currentData.activeLeases[intentId];
        return currentData;
      }
      // LEASE REVOKED / MISSING / RECLAIMED!
      // Abort transaction because reservation is no longer owned!
      return undefined;
    });

    if (!txResult.committed) {
      return {
        success: false,
        reason: 'LEASE_FENCING_REVOKED',
        failedItemName: item.name || String(item.id)
      };
    }
  }

  return { success: true };
}

/**
 * releaseRtdbLeases:
 * Compensating transaction: restores stock, decrements reserved count, and removes active lease.
 * Supports fenceToken validation so it does not release someone else's superseded lease.
 */
export async function releaseRtdbLeases(
  rtdb: admin.database.Database,
  cart: { id: string | number; qty: number }[],
  intentId: string,
  fenceToken?: string
): Promise<void> {
  for (const item of cart) {
    const stockRef = rtdb.ref(`menu_stock/${item.id}`);
    await stockRef.transaction((currentData) => {
      if (currentData === null) return currentData;
      if (currentData.activeLeases && currentData.activeLeases[intentId]) {
        const lease = currentData.activeLeases[intentId];
        if (fenceToken && lease.fenceToken && lease.fenceToken !== fenceToken) {
          return currentData; // Don't release someone else's superseded lease
        }
        const leasedQty = lease.qty || item.qty;
        currentData.stock = (currentData.stock || 0) + leasedQty;
        currentData.reserved = Math.max(0, (currentData.reserved || 0) - leasedQty);
        delete currentData.activeLeases[intentId];
        if (currentData.stock > (currentData.minStock || 0)) {
          currentData.available = true;
        }
      }
      return currentData;
    });
  }
}

/**
 * Result enum for idempotent refundStudentWallet.
 * REFUNDED         — Refund applied successfully this invocation.
 * ALREADY_REFUNDED — Intent was already CANCELLED; no wallet credit applied.
 * NOT_ELIGIBLE     — Intent lacks a financial debit; refund is not applicable.
 * FAILED           — Unexpected error inside the Firestore transaction.
 */
export type RefundResult = 'REFUNDED' | 'ALREADY_REFUNDED' | 'NOT_ELIGIBLE' | 'FAILED';

/**
 * refundStudentWallet:
 * Idempotent refund helper for financial consistency restoration.
 *
 * IDEMPOTENCY GUARANTEE:
 * All five operations (intent state read, wallet credit on students/{regNo},
 * wallet sync on users/{uid}, deterministic ledger entry, and intent cancellation)
 * execute inside a single Firestore transaction.
 *
 * The ledger document ID is deterministic: `refund_${intentId}`. Firestore
 * document creation with a fixed ID is idempotent — a second concurrent
 * execution will conflict on the ledger create(), the transaction will abort,
 * and Firestore will retry. On retry it finds the intent already CANCELLED and
 * returns ALREADY_REFUNDED without crediting the wallet again.
 *
 * Concurrent or repeated calls for the same intentId are therefore safe:
 * exactly one will win the Firestore transaction; all others will return
 * ALREADY_REFUNDED.
 */
export async function refundStudentWallet(
  db: admin.firestore.Firestore,
  intent: { intentId: string; orderId: string; userRollNo: string; userId: string; totalPrice: number },
  reason: string
): Promise<RefundResult> {
  // Deterministic ledger document ID prevents duplicate ledger entries even if
  // this function is invoked twice before either transaction commits.
  const deterministicLedgerId = `refund_${intent.intentId}`;

  try {
    await db.runTransaction(async (tx) => {
      // ── GATE: Read the live intent state inside the transaction ──
      const intentRef = db.collection('transaction_intents').doc(intent.intentId);
      const intentSnap = await tx.get(intentRef);

      if (!intentSnap.exists) {
        // Intent document missing — nothing to refund.
        throw Object.assign(new Error('INTENT_NOT_FOUND'), { code: 'NOT_ELIGIBLE' });
      }

      const liveState = intentSnap.data()?.state as TransactionIntentState;

      // If the intent is already CANCELLED, a refund was already committed.
      if (liveState === 'CANCELLED') {
        throw Object.assign(new Error('ALREADY_REFUNDED'), { code: 'ALREADY_REFUNDED' });
      }

      // Only refund if money was actually debited.
      const walletDebited = intentSnap.data()?.journal?.firestoreWalletDebited === true;
      if (!walletDebited) {
        throw Object.assign(new Error('NOT_ELIGIBLE'), { code: 'NOT_ELIGIBLE' });
      }

      // ── CREDIT WALLET: students/{regNo} ──
      const studentRef = db.collection('students').doc(intent.userRollNo);
      const studentSnap = await tx.get(studentRef);
      if (studentSnap.exists) {
        const bal = studentSnap.data()?.balance || 0;
        const cred = studentSnap.data()?.credits || 0;
        tx.update(studentRef, { balance: bal + intent.totalPrice, credits: cred + intent.totalPrice });
      }

      // ── SYNC WALLET: users/{uid} ──
      const userRef = db.collection('users').doc(intent.userId);
      const userSnap = await tx.get(userRef);
      if (userSnap.exists) {
        const uBal = userSnap.data()?.walletBalance || 0;
        tx.update(userRef, { walletBalance: uBal + intent.totalPrice });
      }

      // ── DETERMINISTIC LEDGER ENTRY ──
      // Using a fixed doc ID means a second concurrent transaction will collide
      // on the set() and abort, preventing a double ledger entry and double credit.
      const ledgerRef = db.collection('ledger').doc(deterministicLedgerId);
      tx.set(ledgerRef, {
        type: 'refund',
        studentRegNo: intent.userRollNo,
        studentUid: intent.userId,
        amount: intent.totalPrice,
        orderId: intent.orderId,
        intentId: intent.intentId,
        reason,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        description: `Auto-refund for order ${intent.orderId}: ${reason}`
      });

      // ── CANCEL INTENT (atomic with wallet credit) ──
      tx.update(intentRef, {
        state: 'CANCELLED',
        errorMessage: reason,
        'journal.rtdbLeaseReleased': true,
        reconciledAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    functions.logger.info('refundStudentWallet: REFUNDED', { intentId: intent.intentId, amount: intent.totalPrice, reason });
    return 'REFUNDED';

  } catch (err: any) {
    const code = err?.code as string | undefined;
    if (code === 'ALREADY_REFUNDED') {
      functions.logger.info('refundStudentWallet: ALREADY_REFUNDED — skipping duplicate credit', { intentId: intent.intentId });
      return 'ALREADY_REFUNDED';
    }
    if (code === 'NOT_ELIGIBLE') {
      functions.logger.warn('refundStudentWallet: NOT_ELIGIBLE — no financial debit found', { intentId: intent.intentId });
      return 'NOT_ELIGIBLE';
    }
    functions.logger.error('refundStudentWallet: FAILED', { intentId: intent.intentId, err });
    return 'FAILED';
  }
}

/**
 * reconcileIntent:
 * Core deterministic recovery worker. Resolves incomplete transaction intents across Firestore and RTDB.
 *
 * IDEMPOTENCY: Reads the live intent state from Firestore before acting. If the
 * intent is already COMMITTED or CANCELLED by a concurrent invocation, this
 * function returns early with no side effects. This makes it safe for the
 * background sweeper to run multiple overlapping instances.
 *
 * Evaluates the journal bitmask:
 * - If firestoreWalletDebited == true: executes FORWARD RECOVERY (dispatches active_orders and commits leases).
 *   If forward recovery fails, calls idempotent refundStudentWallet for backward compensation.
 * - If firestoreWalletDebited == false: executes BACKWARD COMPENSATION (releases RTDB leases, cancels intent).
 */
export async function reconcileIntent(
  db: admin.firestore.Firestore,
  rtdb: admin.database.Database,
  intentId: string,
  intent: TransactionIntentDocument
): Promise<void> {
  const intentRef = db.collection('transaction_intents').doc(intentId);

  // ── IDEMPOTENCY GATE: Re-read live state before acting ──────────────────────
  // Prevents duplicate recovery in case two sweeper instances race on the same
  // intent between the initial query and this execution.
  const liveSnap = await intentRef.get();
  if (!liveSnap.exists) {
    functions.logger.warn('reconcileIntent: intent document not found, skipping.', { intentId });
    return;
  }
  const liveState = liveSnap.data()?.state as TransactionIntentState;
  if (liveState === 'COMMITTED' || liveState === 'CANCELLED' || liveState === 'FAILED') {
    functions.logger.info('reconcileIntent: intent already in terminal state, skipping.', { intentId, liveState });
    return;
  }
  // Use the live snapshot to ensure decisions are based on current data.
  const liveIntent = liveSnap.data() as TransactionIntentDocument;

  if (liveIntent.journal?.firestoreWalletDebited) {
    functions.logger.info('Reconciler: forward recovery for financially committed intent', { intentId, orderId: liveIntent.orderId });
    try {
      // Verify or create RTDB active order
      const orderRef = rtdb.ref(`active_orders/${liveIntent.orderId}`);
      const orderSnap = await orderRef.once('value');
      if (!orderSnap.exists()) {
        await orderRef.set({
          id: liveIntent.orderId,
          intentId,
          orderNumber: liveIntent.orderNumber || 0,
          userId: liveIntent.userId,
          userRollNo: liveIntent.userRollNo,
          items: liveIntent.cart,
          totalPrice: liveIntent.totalPrice,
          slotName: liveIntent.slotName,
          payment_mode: liveIntent.paymentMode,
          status: 'ordered',
          sync_status: 'cloud',
          estimatedServingWindow: liveIntent.estimatedServingWindow || 'Soon',
          createdAt: new Date().toISOString(),
          timestamp: admin.database.ServerValue.TIMESTAMP
        });
      }

      const commitRes = await commitRtdbLeases(rtdb, liveIntent.cart, intentId, liveIntent.journal?.fenceToken);
      if (!commitRes.success) {
        throw new Error(`Reconciler lease fencing failure: ${commitRes.reason || 'lease was reclaimed'}`);
      }

      await intentRef.update({
        state: 'COMMITTED',
        'journal.rtdbOrderDispatched': true,
        'journal.rtdbLeaseReleased': true,
        reconciledAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      functions.logger.info('reconcileIntent: forward recovery COMMITTED', { intentId });
      return;
    } catch (fwdErr) {
      functions.logger.error('Reconciler forward recovery failed, falling back to idempotent refund', { intentId, fwdErr });
      const refundResult = await refundStudentWallet(db, liveIntent, 'Forward recovery dispatch or fencing failed; student wallet refunded.');
      functions.logger.info('reconcileIntent: refund result', { intentId, refundResult });
      await releaseRtdbLeases(rtdb, liveIntent.cart, intentId, liveIntent.journal?.fenceToken);
    }
  } else {
    // Money not debited — release leases and cancel intent
    functions.logger.info('Reconciler: releasing expired lease for un-debited intent', { intentId });
    await releaseRtdbLeases(rtdb, liveIntent.cart, intentId, liveIntent.journal?.fenceToken);
    await intentRef.update({
      state: 'CANCELLED',
      'journal.rtdbLeaseReleased': true,
      errorMessage: 'Lease expired prior to financial commit; stock restored.',
      reconciledAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    functions.logger.info('reconcileIntent: backward compensation CANCELLED', { intentId });
  }
}
export const securePlaceOrder = https.onCall(async (request: https.CallableRequest) => {
  const { data, auth } = request;
  
  if (!auth?.uid) {
    throw new https.HttpsError('unauthenticated', 'You must be logged in to place an order.');
  }

  const { cart, totalPrice: clientTotalPrice, slotName, paymentMode, idempotencyKey } = data as {
    cart: any[];
    totalPrice: number;
    slotName: string;
    paymentMode: string;
    idempotencyKey?: string;
  };
  
  if (!cart || cart.length === 0 || !clientTotalPrice || !slotName) {
    throw new https.HttpsError('invalid-argument', 'Missing required order fields.');
  }

  const db = admin.firestore();
  const rtdb = admin.database();

  // Deterministic intent identifier for cross-resource correlation and idempotency
  const intentId = (idempotencyKey && typeof idempotencyKey === 'string' && idempotencyKey.trim().length > 0)
    ? idempotencyKey.trim()
    : generateSecureOrderId();

  const intentRef = db.collection('transaction_intents').doc(intentId);

  let orderId = '';
  let orderNumber = 1;
  let estimatedServingWindow = 'Soon';
  let enrichedCart: any[] = [];
  let serverTotalPrice = 0;
  let newOrder: any = null;

  try {
    // 1. Verify Admin is Online (Kill-Switch)
    const systemStatusSnap = await rtdb.ref('system_status/admin_online').once('value');
    const isAdminOnline = systemStatusSnap.val();
    if (isAdminOnline === false) {
      throw new https.HttpsError('failed-precondition', 'Admin is offline. Orders cannot be placed at this time.');
    }

    // 2. Server-side price validation (Closing Price Spoofing Flaw)
    const menuPrices = await getMenuPrices(db);
    for (const item of cart) {
      const menuEntry = menuPrices.get(String(item.id));
      if (menuEntry === undefined) {
        throw new https.HttpsError('invalid-argument', `Unknown menu item: ${item.name || item.id}`);
      }
      const qty = Number(item.qty || item.quantity || 1);
      serverTotalPrice += menuEntry.price * qty;
    }

    if (Math.abs(clientTotalPrice - serverTotalPrice) > 1) {
      functions.logger.warn('Price spoofing detected in securePlaceOrder', {
        uid: auth.uid, clientPrice: clientTotalPrice, serverPrice: serverTotalPrice
      });
      throw new https.HttpsError('invalid-argument',
        `Price mismatch: expected ₹${serverTotalPrice}, received ₹${clientTotalPrice}.`);
    }

    // 3. Pre-read and validate user & student status in Firestore
    orderId = generateSecureOrderId();
    const today = new Date().toISOString().split('T')[0];
    const dailyCounterRef = db.doc(`orderCounters/${today}`);

    const userRef = db.collection('users').doc(auth.uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new https.HttpsError('not-found', 'User profile not found.');
    }
    const rollNo = userSnap.data()?.rollNo;
    if (!rollNo || rollNo === 'UNREGISTERED' || rollNo === 'EXTERNAL') {
      throw new https.HttpsError('failed-precondition', 'You must be a registered student to place an order with credits.');
    }

    const studentRef = db.collection('students').doc(rollNo);
    const studentSnap = await studentRef.get();
    if (!studentSnap.exists) {
      throw new https.HttpsError('not-found', 'Student record not found.');
    }
    const studentData = studentSnap.data();
    if (studentData?.status === 'disabled') {
      throw new https.HttpsError('permission-denied', 'Account has been disabled. Order denied.');
    }

    // Read Daily Counter for receipt number
    const counterSnap = await dailyCounterRef.get();
    if (counterSnap.exists) {
      orderNumber = (counterSnap.data()?.count || 0) + 1;
    }

    // Prepare enriched cart items
    enrichedCart = cart.map((item: any) => {
      const menuEntry = menuPrices.get(String(item.id));
      return {
        id: item.id,
        name: menuEntry?.name || item.name || 'Unknown Item',
        price: menuEntry?.price ?? item.price ?? 0,
        qty: item.qty || item.quantity || 1,
      };
    });

    // ── STEP 1: ATOMIC INTENT ENTRY GATE (Defeating TOCTOU Race & Fencing Initialization) ──
    const leaseDurationMs = 120 * 1000; // 120s TTL
    const nowMs = Date.now();
    const fenceToken = `${intentId}-${nowMs}-${randomUUID().replace(/-/g, '').slice(0, 8)}`;

    const initialIntent: TransactionIntentDocument = {
      intentId,
      orderId,
      userId: auth.uid,
      userRollNo: rollNo,
      cart: enrichedCart,
      totalPrice: serverTotalPrice,
      slotName,
      paymentMode,
      state: 'INITIALIZED',
      leaseExpiresAt: nowMs + leaseDurationMs,
      journal: {
        rtdbLeaseAcquired: false,
        firestoreWalletDebited: false,
        rtdbOrderDispatched: false,
        rtdbLeaseReleased: false,
        fenceToken,
      },
      orderNumber,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    let isNewIntent = false;
    let existingIntent: TransactionIntentDocument | null = null;

    try {
      // ATOMIC INSERTION: Fails with ALREADY_EXISTS if doc exists
      await intentRef.create(initialIntent);
      isNewIntent = true;
    } catch (createErr: any) {
      const errCode = createErr?.code;
      const errMsg = String(createErr?.message || '');
      if (errCode === 6 || errCode === 'already-exists' || errMsg.includes('ALREADY_EXISTS') || errMsg.includes('already exists')) {
        const snap = await intentRef.get();
        if (snap.exists) {
          existingIntent = snap.data() as TransactionIntentDocument;
        }
      } else {
        throw createErr;
      }
    }

    if (!isNewIntent && existingIntent) {
      // Scenario A: Order already fully committed -> return existing receipt with zero writes
      if (existingIntent.state === 'COMMITTED') {
        functions.logger.info('ARCH-B: Idempotent replay hit for committed order', { intentId, orderId: existingIntent.orderId });
        return {
          success: true,
          orderId: existingIntent.orderId,
          orderNumber: existingIntent.orderNumber,
          estimatedServingWindow: existingIntent.estimatedServingWindow || 'Soon',
          idempotentReplay: true
        };
      }

      // Scenario B: Order was financially debited but dispatch failed -> execute forward recovery with fencing
      if (existingIntent.state === 'FINANCIALLY_COMMITTED') {
        functions.logger.info('ARCH-B: Idempotent retry triggered forward recovery', { intentId, orderId: existingIntent.orderId });
        const commitRes = await commitRtdbLeases(rtdb, existingIntent.cart, intentId, existingIntent.journal?.fenceToken);
        if (!commitRes.success) {
          functions.logger.error('ARCH-B: Forward recovery fencing failed on commit — refunding student', { intentId, commitRes });
          await refundStudentWallet(db, existingIntent, 'Forward recovery fencing failed; stock was reclaimed.');
          throw new https.HttpsError('deadline-exceeded', 'Order reservation expired during processing. Your wallet has been refunded.');
        }

        await rtdb.ref(`active_orders/${existingIntent.orderId}`).set({
          id: existingIntent.orderId,
          intentId,
          orderNumber: existingIntent.orderNumber,
          userId: existingIntent.userId,
          userRollNo: existingIntent.userRollNo,
          items: existingIntent.cart,
          totalPrice: existingIntent.totalPrice,
          slotName: existingIntent.slotName,
          payment_mode: existingIntent.paymentMode,
          status: 'ordered',
          sync_status: 'cloud',
          estimatedServingWindow: existingIntent.estimatedServingWindow || 'Soon',
          createdAt: new Date().toISOString(),
          timestamp: admin.database.ServerValue.TIMESTAMP
        });

        await intentRef.update({
          state: 'COMMITTED',
          'journal.rtdbOrderDispatched': true,
          'journal.rtdbLeaseReleased': true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return {
          success: true,
          orderId: existingIntent.orderId,
          orderNumber: existingIntent.orderNumber,
          estimatedServingWindow: existingIntent.estimatedServingWindow || 'Soon',
          recovered: true
        };
      }

      // Scenario C: Transaction in-flight and lease is not expired -> reject concurrent re-entry
      if ((existingIntent.state === 'INITIALIZED' || existingIntent.state === 'RESERVED') && Date.now() < existingIntent.leaseExpiresAt) {
        throw new https.HttpsError('already-exists', 'Transaction is currently processing. Please wait.');
      }

      // Scenario D: Prior attempt was cancelled or failed -> prompt user for fresh cart
      if (existingIntent.state === 'CANCELLED' || existingIntent.state === 'FAILED') {
        throw new https.HttpsError('failed-precondition',
          `Previous order attempt was aborted: ${existingIntent.errorMessage || 'Order cancelled'}. Please start a new order.`);
      }
    }

    // Live Balance pre-check for first-time execution
    if (paymentMode === 'credit') {
      const balance = studentData?.balance || 0;
      if (balance < serverTotalPrice) {
        await intentRef.update({
          state: 'FAILED',
          errorMessage: 'Insufficient wallet balance',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }).catch(() => {});
        throw new https.HttpsError('resource-exhausted', 'Insufficient wallet balance.');
      }
    }

    // ── STEP 2: TWO-PHASE INVENTORY LEASE ON RTDB (with Inline OCC Lazy Reclamation & Fencing) ──
    const leaseResult = await acquireRtdbLeases(rtdb, cart, intentId, leaseDurationMs, fenceToken);
    if (!leaseResult.success) {
      await intentRef.update({
        state: 'FAILED',
        errorMessage: `Out of stock: ${leaseResult.failedItemName || 'Item'}`,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }).catch(() => {});
      throw new https.HttpsError('resource-exhausted', `Out of stock: ${leaseResult.failedItemName}`);
    }

    // Mark intent as RESERVED
    await intentRef.update({
      state: 'RESERVED',
      'journal.rtdbLeaseAcquired': true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // ── STEP 3: FIRESTORE FINANCIAL COMMIT & ATOMIC JOURNAL UPDATE ──
    await db.runTransaction(async (transaction) => {
      const liveStudentSnap = await transaction.get(studentRef);
      if (!liveStudentSnap.exists) {
        throw new https.HttpsError('not-found', 'Student record not found.');
      }
      const liveStudent = liveStudentSnap.data();
      if (liveStudent?.status === 'disabled') {
        throw new https.HttpsError('permission-denied', 'Account has been disabled.');
      }

      if (paymentMode === 'credit') {
        const liveBal = liveStudent?.balance || 0;
        if (liveBal < serverTotalPrice) {
          throw new https.HttpsError('resource-exhausted', 'Insufficient wallet balance.');
        }
        const newBal = liveBal - serverTotalPrice;
        const newCred = (liveStudent?.credits || 0) - serverTotalPrice;
        transaction.update(studentRef, { balance: newBal, credits: newCred });

        // Sync walletBalance to users/{uid}
        transaction.update(userRef, { walletBalance: newBal });

        // Immutable financial audit trail
        const ledgerRef = db.collection('ledger').doc();
        transaction.set(ledgerRef, {
          type: 'purchase',
          studentRegNo: rollNo,
          studentUid: auth.uid,
          amount: serverTotalPrice,
          orderId,
          intentId, // Cross-resource correlation key
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          description: `Order ${orderId}`
        });
      }

      // Update daily order counter
      if (counterSnap.exists) {
        transaction.update(dailyCounterRef, { count: orderNumber });
      } else {
        transaction.set(dailyCounterRef, { count: orderNumber, date: today });
      }

      // CRITICAL ARCH-B ATOMICITY: Intent journal updated in SAME Firestore transaction
      transaction.update(intentRef, {
        state: 'FINANCIALLY_COMMITTED',
        'journal.firestoreWalletDebited': true,
        orderNumber,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    // ── STEP 4: RTDB ORDER DISPATCH WITH LEASE FENCING COMMIT ──
    const nowTimestamp = Date.now();
    const messStatusSnap = await rtdb.ref('mess_status').once('value');
    const currentlyServing = messStatusSnap.exists() ? messStatusSnap.val().currentlyServing || 0 : 0;
    const queuePosition = Math.max(0, orderNumber - currentlyServing);
    const waitTimeSeconds = queuePosition * 3; // 3 seconds per order
    
    const startTimeDate = new Date(nowTimestamp + waitTimeSeconds * 1000);
    const endTimeDate = new Date(startTimeDate.getTime() + 180 * 1000);
    const formatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    estimatedServingWindow = `${formatter.format(startTimeDate)} - ${formatter.format(endTimeDate)}`;

    newOrder = {
      id: orderId,
      intentId, // Cross-resource correlation key
      orderNumber,
      userId: auth.uid,
      userRollNo: rollNo,
      items: enrichedCart,
      totalPrice: serverTotalPrice,
      slotName,
      payment_mode: paymentMode,
      status: 'ordered',
      sync_status: 'cloud',
      estimatedServingWindow,
      createdAt: new Date().toISOString(),
      timestamp: admin.database.ServerValue.TIMESTAMP
    };

    // Commit the RTDB leases with FENCING VALIDATION
    const commitRes = await commitRtdbLeases(rtdb, cart, intentId, fenceToken);
    if (!commitRes.success) {
      functions.logger.error('ARCH-B: Fencing validation failed on commit — lease was reclaimed', {
        intentId,
        orderId,
        commitRes
      });
      await refundStudentWallet(db, initialIntent, 'Checkout delay exceeded lease TTL; stock reservation was reclaimed.');
      throw new https.HttpsError('deadline-exceeded',
        'Checkout took too long and the item reservation expired. Your wallet has been automatically refunded.');
    }

    // Fencing confirmed! Lease safely transitioned to COMMITTED. Dispatch kitchen ticket:
    await rtdb.ref(`active_orders/${orderId}`).set(newOrder);

    // Finalize Transaction Intent as COMMITTED
    await intentRef.update({
      state: 'COMMITTED',
      'journal.rtdbOrderDispatched': true,
      'journal.rtdbLeaseReleased': true,
      estimatedServingWindow,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, orderId, orderNumber, estimatedServingWindow };

  } catch (error: any) {
    functions.logger.error('securePlaceOrder error occurred', {
      intentId,
      orderId,
      errorMessage: error?.message,
      errorCode: error?.code
    });

    // ── FAILURE RECOVERY & COMPENSATION ──
    try {
      const currentIntentSnap = await intentRef.get();
      if (currentIntentSnap.exists) {
        const currentIntent = currentIntentSnap.data() as TransactionIntentDocument;

        if (currentIntent.journal?.firestoreWalletDebited) {
          // Money was debited! Attempt immediate Forward Recovery with fencing check
          functions.logger.info('ARCH-B: Attempting immediate forward recovery in catch handler', { intentId, orderId });
          if (newOrder) {
            const commitRes = await commitRtdbLeases(rtdb, cart, intentId, currentIntent.journal?.fenceToken);
            if (commitRes.success) {
              await rtdb.ref(`active_orders/${orderId}`).set(newOrder);
              await intentRef.update({
                state: 'COMMITTED',
                'journal.rtdbOrderDispatched': true,
                'journal.rtdbLeaseReleased': true,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
              return { success: true, orderId, orderNumber, estimatedServingWindow, recovered: true };
            } else {
              functions.logger.error('ARCH-B: Catch forward recovery fencing failed — falling back to refund', { intentId, commitRes });
              await refundStudentWallet(db, currentIntent, 'Fencing failure during catch handler forward recovery; student refunded.');
            }
          } else {
            await refundStudentWallet(db, currentIntent, 'Order dispatch error in catch handler; student refunded.');
          }
        } else {
          // Money was NOT debited: safe backward compensation — release any acquired leases
          functions.logger.info('ARCH-B: Compensating by releasing RTDB inventory leases', { intentId });
          await releaseRtdbLeases(rtdb, cart, intentId, currentIntent.journal?.fenceToken);
          await intentRef.update({
            state: 'CANCELLED',
            'journal.rtdbLeaseReleased': true,
            errorMessage: error?.message || 'Transaction aborted before financial commit',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }
    } catch (compensationErr) {
      functions.logger.error('ARCH-B: Secondary error during catch compensation handler', { intentId, compensationErr });
    }

    if (error instanceof https.HttpsError) {
      throw error;
    }
    const msg = error?.message || 'Transaction failed';
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
// securePlaceKioskOrder — Server-side processing for Kiosk Counter & External orders
// ─────────────────────────────────────────────────────────────────────────────
export const securePlaceKioskOrder = https.onCall(async (request: https.CallableRequest) => {
  const { data, auth } = request;

  // The Kiosk should ideally be authenticated (even anonymously)
  if (!auth?.uid) {
    throw new https.HttpsError('unauthenticated', 'Kiosk must be authenticated.');
  }

  const { cart, totalPrice: clientTotalPrice, slotName, orderType, paymentMode, studentRegNo, existingOrderId, existingOrderNumber } = data as {
    cart: { id: string; name: string; qty: number; price: number }[];
    totalPrice: number;
    slotName: string;
    orderType: 'counter' | 'external' | 'shop';
    paymentMode: string;
    studentRegNo?: string;
    existingOrderId?: string;
    existingOrderNumber?: number;
  };

  if (!cart || cart.length === 0 || !slotName || !orderType || !paymentMode) {
    throw new https.HttpsError('invalid-argument', 'Missing required order fields.');
  }

  const db = admin.firestore();
  const rtdb = admin.database();

  try {
    // 1. Verify Admin is Online (Kill-Switch)
    const systemStatusSnap = await rtdb.ref('system_status/admin_online').once('value');
    if (systemStatusSnap.val() === false) {
      throw new https.HttpsError('failed-precondition', 'Admin is offline. Orders cannot be placed at this time.');
    }

    // 2. Validate Prices
    const menuPrices = await getMenuPrices(db);
    let serverTotalPrice = 0;
    for (const item of cart) {
      const menuEntry = menuPrices.get(String(item.id));
      if (menuEntry === undefined) {
        throw new https.HttpsError('invalid-argument', `Unknown menu item: ${item.name}`);
      }
      serverTotalPrice += menuEntry.price * item.qty;
    }

    if (Math.abs(clientTotalPrice - serverTotalPrice) > 1) {
      functions.logger.warn('Price mismatch in kiosk order', { clientPrice: clientTotalPrice, serverPrice: serverTotalPrice });
      throw new https.HttpsError('invalid-argument', `Price mismatch: expected ₹${serverTotalPrice}, received ₹${clientTotalPrice}.`);
    }

    // Generate secure order ID
    const orderPrefix = orderType === 'counter' ? 'CNT' : orderType === 'shop' ? 'SHP' : 'EXT';
    const orderId = existingOrderId || `${orderPrefix}-${Date.now().toString().slice(-6)}`;
    const today = new Date().toISOString().split('T')[0];
    const dailyCounterRef = db.doc(`orderCounters/${today}`);
    let orderNumber = existingOrderNumber || 1;

    // 3. Atomically decrement RTDB stock FIRST (Fixing FM-02 Inversion Bug)
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

    // 4. Counter Order Specific Validation (Wallet deduction) SECOND
    try {
      if (orderType === 'counter') {
        if (!studentRegNo) {
          throw new https.HttpsError('invalid-argument', 'Registration number required for counter orders.');
        }
        
        await db.runTransaction(async (transaction) => {
          const studentRef = db.collection('students').doc(studentRegNo);
          const studentSnap = await transaction.get(studentRef);
          
          if (!studentSnap.exists) {
            throw new https.HttpsError('not-found', 'Student record not found.');
          }

          const studentData = studentSnap.data();
          if (studentData?.status === 'disabled') {
            throw new https.HttpsError('permission-denied', 'Account is disabled.');
          }

          if (paymentMode === 'credit') {
            const balance = studentData?.balance || 0;
            if (balance < serverTotalPrice) {
              throw new https.HttpsError('resource-exhausted', 'Insufficient wallet balance.');
            }

            const newBal = balance - serverTotalPrice;
            const newCred = (studentData?.credits || 0) - serverTotalPrice;
            transaction.update(studentRef, { balance: newBal, credits: newCred });

            if (studentData?.uid) {
              const userRef = db.collection('users').doc(studentData.uid);
              transaction.update(userRef, { walletBalance: newBal });
            }

            const ledgerRef = db.collection('ledger').doc();
            transaction.set(ledgerRef, {
              type: 'purchase',
              studentRegNo: studentRegNo,
              studentUid: studentData?.uid || 'UNKNOWN',
              amount: serverTotalPrice,
              orderId: orderId,
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              description: `Counter Order ${orderId}`
            });
          }

          if (!existingOrderNumber) {
            const counterSnap = await transaction.get(dailyCounterRef);
            if (counterSnap.exists) {
              orderNumber = (counterSnap.data()?.count || 0) + 1;
              transaction.update(dailyCounterRef, { count: orderNumber });
            } else {
              transaction.set(dailyCounterRef, { count: orderNumber, date: today });
            }
          }
        });
      } else {
        // External/Shop: Just increment counter
        if (!existingOrderNumber) {
          await db.runTransaction(async (transaction) => {
            const counterSnap = await transaction.get(dailyCounterRef);
            if (counterSnap.exists) {
              orderNumber = (counterSnap.data()?.count || 0) + 1;
              transaction.update(dailyCounterRef, { count: orderNumber });
            } else {
              transaction.set(dailyCounterRef, { count: orderNumber, date: today });
            }
          });
        }
      }
    } catch (walletErr) {
      // Revert stock if wallet deduction fails!
      for (const revert of stockReverts) {
        await revert.ref.transaction((d) => {
          if (d !== null) { d.stock = (d.stock || 0) + revert.qty; d.available = true; }
          return d;
        }).catch(() => {});
      }
      throw walletErr;
    }

    // 5. Create order in RTDB
    const enrichedCart = cart.map((item: any) => {
      const menuEntry = menuPrices.get(String(item.id));
      return {
        id: item.id,
        name: menuEntry?.name || item.name || 'Unknown Item',
        price: menuEntry?.price ?? item.price ?? 0,
        qty: item.qty || item.quantity || 1,
      };
    });

    const isExternal = orderType === 'external' || orderType === 'shop';
    const newOrder = {
      id: orderId,
      orderNumber,
      userId: isExternal ? 'EXTERNAL' : studentRegNo || 'EXTERNAL',
      userRollNo: isExternal ? 'SHOP' : studentRegNo || 'SHOP',
      userType: isExternal ? 'guest' : 'student',
      items: enrichedCart,
      totalPrice: serverTotalPrice,
      slotName,
      payment_mode: paymentMode,
      status: isExternal ? 'processing' : 'pending',
      paymentStatus: isExternal ? 'PAID' : (paymentMode === 'credit' ? 'PAID' : 'PENDING'),
      sync_status: 'cloud',
      isExternal: isExternal,
      isCounterOrder: orderType === 'counter',
      autoPrint: true,
      createdAt: new Date().toISOString(),
      timestamp: admin.database.ServerValue.TIMESTAMP,
    };
    await rtdb.ref(`active_orders/${orderId}`).set(newOrder);

    functions.logger.info(`${orderType} order created`, { orderId, amount: serverTotalPrice });
    return { success: true, orderId, orderNumber };

  } catch (error: any) {
    if (error instanceof https.HttpsError) throw error;
    throw new https.HttpsError('internal', error?.message || `Failed to place ${orderType} order.`);
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

// ─────────────────────────────────────────────────────────────────────────────
// reconcileIncompleteIntents — ARCH-B Background Sweeper & Reconciler
// Runs every 1 minute: sweeps unfinalized transaction intents past lease expiry
// Evaluates journal flags and executes forward recovery or backward refund
// ─────────────────────────────────────────────────────────────────────────────
export const reconcileIncompleteIntents = onSchedule(
  { schedule: 'every 1 minutes', timeZone: 'Asia/Kolkata' },
  async () => {
    const db = admin.firestore();
    const rtdb = admin.database();
    const nowMs = Date.now();

    try {
      const snap = await db.collection('transaction_intents')
        .where('state', 'in', ['INITIALIZED', 'RESERVED', 'FINANCIALLY_COMMITTED'])
        .where('leaseExpiresAt', '<=', nowMs)
        .limit(50)
        .get();

      if (snap.empty) {
        return;
      }

      functions.logger.info(`reconcileIncompleteIntents: sweeping ${snap.docs.length} incomplete intents.`);

      for (const docSnap of snap.docs) {
        const intent = docSnap.data() as TransactionIntentDocument;
        try {
          await reconcileIntent(db, rtdb, docSnap.id, intent);
        } catch (itemErr) {
          functions.logger.error('reconcileIncompleteIntents: error reconciling intent', {
            intentId: docSnap.id,
            itemErr
          });
        }
      }
    } catch (err) {
      functions.logger.error('reconcileIncompleteIntents job failed', { err });
    }
  }
);

