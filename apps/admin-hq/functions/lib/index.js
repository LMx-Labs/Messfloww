"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconcileIncompleteIntents = exports.cancelStalePendingOrders = exports.confirmAndCollectUpiOrder = exports.collectOrder = exports.securePlaceUpiOrder = exports.securePlaceKioskOrder = exports.securePlaceOrder = void 0;
exports.acquireRtdbLeases = acquireRtdbLeases;
exports.commitRtdbLeases = commitRtdbLeases;
exports.releaseRtdbLeases = releaseRtdbLeases;
exports.refundStudentWallet = refundStudentWallet;
exports.reconcileIntent = reconcileIntent;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const https = __importStar(require("firebase-functions/v2/https"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const crypto_1 = require("crypto");
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
let cachedMenu = null;
let menuCacheExpiry = 0;
async function getMenuPrices(db) {
    if (cachedMenu && Date.now() < menuCacheExpiry)
        return cachedMenu;
    const snap = await db.collection('menu').get();
    const priceMap = new Map();
    // Each document in the 'menu' collection IS one menu item (not a nested array)
    snap.docs.forEach(d => {
        const data = d.data();
        const id = data.id !== undefined ? String(data.id) : d.id;
        const price = Number(data.price || 0);
        const name = String(data.name || 'Unknown Item');
        priceMap.set(id, { price, name });
    });
    cachedMenu = priceMap;
    menuCacheExpiry = Date.now() + 5 * 60 * 1000; // 5-minute TTL
    return priceMap;
}
/** Generate a cryptographically secure, non-guessable order ID */
function generateSecureOrderId() {
    return `MFW-${(0, crypto_1.randomUUID)().replace(/-/g, '').substring(0, 12).toUpperCase()}`;
}
/**
 * acquireRtdbLeases:
 * Atomically acquires two-phase inventory leases on RTDB with INLINE OCC LAZY LEASE RECLAMATION and FENCING.
 * Generates and associates an immutable fenceToken with the active lease.
 * If any expired leases exist on an item, they are reclaimed on the spot inside the single-threaded OCC callback.
 * If stock is sufficient, reserves the requested quantity and records activeLeases[intentId].
 * If any item fails, rolls back all preceding acquired leases.
 */
async function acquireRtdbLeases(rtdb, cart, intentId, leaseDurationMs = 120 * 1000, // 120s default for credit checkout
fenceToken) {
    const acquiredLeases = [];
    const now = Date.now();
    const expiresAt = now + leaseDurationMs;
    const token = fenceToken || `${intentId}-${now}-${(0, crypto_1.randomUUID)().replace(/-/g, '').slice(0, 8)}`;
    for (const item of cart) {
        const itemIdStr = String(item.id);
        const stockRef = rtdb.ref(`menu_stock/${itemIdStr}`);
        const qty = Number(item.qty || 1);
        const txResult = await stockRef.transaction((currentData) => {
            if (currentData === null)
                return currentData;
            // ── INLINE OCC LAZY LEASE RECLAMATION ──
            // Reclaim dead leases on this item before checking available stock
            if (currentData.activeLeases && typeof currentData.activeLeases === 'object') {
                for (const [otherIntentId, lease] of Object.entries(currentData.activeLeases)) {
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
                if (!currentData.activeLeases)
                    currentData.activeLeases = {};
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
                            if (d.stock > (d.minStock || 0))
                                d.available = true;
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
async function commitRtdbLeases(rtdb, cart, intentId, fenceToken) {
    for (const item of cart) {
        const stockRef = rtdb.ref(`menu_stock/${item.id}`);
        const txResult = await stockRef.transaction((currentData) => {
            if (currentData === null)
                return currentData;
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
async function releaseRtdbLeases(rtdb, cart, intentId, fenceToken) {
    for (const item of cart) {
        const stockRef = rtdb.ref(`menu_stock/${item.id}`);
        await stockRef.transaction((currentData) => {
            if (currentData === null)
                return currentData;
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
 * refundStudentWallet:
 * Immutable refund helper for financial consistency restoration.
 * Credits student balance/credits, syncs users/{uid}, logs ledger audit trail, and cancels intent.
 */
async function refundStudentWallet(db, intent, reason) {
    await db.runTransaction(async (tx) => {
        var _a, _b, _c;
        const studentRef = db.collection('students').doc(intent.userRollNo);
        const studentSnap = await tx.get(studentRef);
        if (studentSnap.exists) {
            const bal = ((_a = studentSnap.data()) === null || _a === void 0 ? void 0 : _a.balance) || 0;
            const cred = ((_b = studentSnap.data()) === null || _b === void 0 ? void 0 : _b.credits) || 0;
            tx.update(studentRef, { balance: bal + intent.totalPrice, credits: cred + intent.totalPrice });
        }
        const userRef = db.collection('users').doc(intent.userId);
        const userSnap = await tx.get(userRef);
        if (userSnap.exists) {
            const uBal = ((_c = userSnap.data()) === null || _c === void 0 ? void 0 : _c.walletBalance) || 0;
            tx.update(userRef, { walletBalance: uBal + intent.totalPrice });
        }
        const ledgerRef = db.collection('ledger').doc();
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
        tx.update(db.collection('transaction_intents').doc(intent.intentId), {
            state: 'CANCELLED',
            errorMessage: reason,
            'journal.rtdbLeaseReleased': true,
            reconciledAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    });
}
/**
 * reconcileIntent:
 * Core deterministic recovery worker. Resolves incomplete transaction intents across Firestore and RTDB.
 * Evaluates the journal bitmask:
 * - If firestoreWalletDebited == true: executes FORWARD RECOVERY (dispatches active_orders and commits leases).
 *   If forward recovery fails after retries, executes backward refund to ensure financial consistency.
 * - If firestoreWalletDebited == false: executes BACKWARD COMPENSATION (releases RTDB leases, cancels intent).
 */
async function reconcileIntent(db, rtdb, intentId, intent) {
    var _a, _b, _c, _d;
    const intentRef = db.collection('transaction_intents').doc(intentId);
    if ((_a = intent.journal) === null || _a === void 0 ? void 0 : _a.firestoreWalletDebited) {
        functions.logger.info('Reconciler: forward recovery for financially committed intent', { intentId, orderId: intent.orderId });
        try {
            // Verify or create RTDB active order
            const orderRef = rtdb.ref(`active_orders/${intent.orderId}`);
            const orderSnap = await orderRef.once('value');
            if (!orderSnap.exists()) {
                await orderRef.set({
                    id: intent.orderId,
                    intentId,
                    orderNumber: intent.orderNumber || 0,
                    userId: intent.userId,
                    userRollNo: intent.userRollNo,
                    items: intent.cart,
                    totalPrice: intent.totalPrice,
                    slotName: intent.slotName,
                    payment_mode: intent.paymentMode,
                    status: 'ordered',
                    sync_status: 'cloud',
                    estimatedServingWindow: intent.estimatedServingWindow || 'Soon',
                    createdAt: new Date().toISOString(),
                    timestamp: admin.database.ServerValue.TIMESTAMP
                });
            }
            const commitRes = await commitRtdbLeases(rtdb, intent.cart, intentId, (_b = intent.journal) === null || _b === void 0 ? void 0 : _b.fenceToken);
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
            return;
        }
        catch (fwdErr) {
            functions.logger.error('Reconciler forward recovery failed, falling back to refund', { intentId, fwdErr });
            await refundStudentWallet(db, intent, 'Forward recovery dispatch or fencing failed; student wallet refunded.');
            await releaseRtdbLeases(rtdb, intent.cart, intentId, (_c = intent.journal) === null || _c === void 0 ? void 0 : _c.fenceToken);
        }
    }
    else {
        // Money not debited — release leases and cancel intent
        functions.logger.info('Reconciler: releasing expired lease for un-debited intent', { intentId });
        await releaseRtdbLeases(rtdb, intent.cart, intentId, (_d = intent.journal) === null || _d === void 0 ? void 0 : _d.fenceToken);
        await intentRef.update({
            state: 'CANCELLED',
            'journal.rtdbLeaseReleased': true,
            errorMessage: 'Lease expired prior to financial commit; stock restored.',
            reconciledAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }
}
exports.securePlaceOrder = https.onCall(async (request) => {
    var _a, _b, _c, _d, _e, _f;
    const { data, auth } = request;
    if (!(auth === null || auth === void 0 ? void 0 : auth.uid)) {
        throw new https.HttpsError('unauthenticated', 'You must be logged in to place an order.');
    }
    const { cart, totalPrice: clientTotalPrice, slotName, paymentMode, idempotencyKey } = data;
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
    let enrichedCart = [];
    let serverTotalPrice = 0;
    let newOrder = null;
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
            throw new https.HttpsError('invalid-argument', `Price mismatch: expected ₹${serverTotalPrice}, received ₹${clientTotalPrice}.`);
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
        const rollNo = (_a = userSnap.data()) === null || _a === void 0 ? void 0 : _a.rollNo;
        if (!rollNo || rollNo === 'UNREGISTERED' || rollNo === 'EXTERNAL') {
            throw new https.HttpsError('failed-precondition', 'You must be a registered student to place an order with credits.');
        }
        const studentRef = db.collection('students').doc(rollNo);
        const studentSnap = await studentRef.get();
        if (!studentSnap.exists) {
            throw new https.HttpsError('not-found', 'Student record not found.');
        }
        const studentData = studentSnap.data();
        if ((studentData === null || studentData === void 0 ? void 0 : studentData.status) === 'disabled') {
            throw new https.HttpsError('permission-denied', 'Account has been disabled. Order denied.');
        }
        // Read Daily Counter for receipt number
        const counterSnap = await dailyCounterRef.get();
        if (counterSnap.exists) {
            orderNumber = (((_b = counterSnap.data()) === null || _b === void 0 ? void 0 : _b.count) || 0) + 1;
        }
        // Prepare enriched cart items
        enrichedCart = cart.map((item) => {
            var _a, _b;
            const menuEntry = menuPrices.get(String(item.id));
            return {
                id: item.id,
                name: (menuEntry === null || menuEntry === void 0 ? void 0 : menuEntry.name) || item.name || 'Unknown Item',
                price: (_b = (_a = menuEntry === null || menuEntry === void 0 ? void 0 : menuEntry.price) !== null && _a !== void 0 ? _a : item.price) !== null && _b !== void 0 ? _b : 0,
                qty: item.qty || item.quantity || 1,
            };
        });
        // ── STEP 1: ATOMIC INTENT ENTRY GATE (Defeating TOCTOU Race & Fencing Initialization) ──
        const leaseDurationMs = 120 * 1000; // 120s TTL
        const nowMs = Date.now();
        const fenceToken = `${intentId}-${nowMs}-${(0, crypto_1.randomUUID)().replace(/-/g, '').slice(0, 8)}`;
        const initialIntent = {
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
        let existingIntent = null;
        try {
            // ATOMIC INSERTION: Fails with ALREADY_EXISTS if doc exists
            await intentRef.create(initialIntent);
            isNewIntent = true;
        }
        catch (createErr) {
            const errCode = createErr === null || createErr === void 0 ? void 0 : createErr.code;
            const errMsg = String((createErr === null || createErr === void 0 ? void 0 : createErr.message) || '');
            if (errCode === 6 || errCode === 'already-exists' || errMsg.includes('ALREADY_EXISTS') || errMsg.includes('already exists')) {
                const snap = await intentRef.get();
                if (snap.exists) {
                    existingIntent = snap.data();
                }
            }
            else {
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
                const commitRes = await commitRtdbLeases(rtdb, existingIntent.cart, intentId, (_c = existingIntent.journal) === null || _c === void 0 ? void 0 : _c.fenceToken);
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
                throw new https.HttpsError('failed-precondition', `Previous order attempt was aborted: ${existingIntent.errorMessage || 'Order cancelled'}. Please start a new order.`);
            }
        }
        // Live Balance pre-check for first-time execution
        if (paymentMode === 'credit') {
            const balance = (studentData === null || studentData === void 0 ? void 0 : studentData.balance) || 0;
            if (balance < serverTotalPrice) {
                await intentRef.update({
                    state: 'FAILED',
                    errorMessage: 'Insufficient wallet balance',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }).catch(() => { });
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
            }).catch(() => { });
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
            if ((liveStudent === null || liveStudent === void 0 ? void 0 : liveStudent.status) === 'disabled') {
                throw new https.HttpsError('permission-denied', 'Account has been disabled.');
            }
            if (paymentMode === 'credit') {
                const liveBal = (liveStudent === null || liveStudent === void 0 ? void 0 : liveStudent.balance) || 0;
                if (liveBal < serverTotalPrice) {
                    throw new https.HttpsError('resource-exhausted', 'Insufficient wallet balance.');
                }
                const newBal = liveBal - serverTotalPrice;
                const newCred = ((liveStudent === null || liveStudent === void 0 ? void 0 : liveStudent.credits) || 0) - serverTotalPrice;
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
            }
            else {
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
            throw new https.HttpsError('deadline-exceeded', 'Checkout took too long and the item reservation expired. Your wallet has been automatically refunded.');
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
    }
    catch (error) {
        functions.logger.error('securePlaceOrder error occurred', {
            intentId,
            orderId,
            errorMessage: error === null || error === void 0 ? void 0 : error.message,
            errorCode: error === null || error === void 0 ? void 0 : error.code
        });
        // ── FAILURE RECOVERY & COMPENSATION ──
        try {
            const currentIntentSnap = await intentRef.get();
            if (currentIntentSnap.exists) {
                const currentIntent = currentIntentSnap.data();
                if ((_d = currentIntent.journal) === null || _d === void 0 ? void 0 : _d.firestoreWalletDebited) {
                    // Money was debited! Attempt immediate Forward Recovery with fencing check
                    functions.logger.info('ARCH-B: Attempting immediate forward recovery in catch handler', { intentId, orderId });
                    if (newOrder) {
                        const commitRes = await commitRtdbLeases(rtdb, cart, intentId, (_e = currentIntent.journal) === null || _e === void 0 ? void 0 : _e.fenceToken);
                        if (commitRes.success) {
                            await rtdb.ref(`active_orders/${orderId}`).set(newOrder);
                            await intentRef.update({
                                state: 'COMMITTED',
                                'journal.rtdbOrderDispatched': true,
                                'journal.rtdbLeaseReleased': true,
                                updatedAt: admin.firestore.FieldValue.serverTimestamp()
                            });
                            return { success: true, orderId, orderNumber, estimatedServingWindow, recovered: true };
                        }
                        else {
                            functions.logger.error('ARCH-B: Catch forward recovery fencing failed — falling back to refund', { intentId, commitRes });
                            await refundStudentWallet(db, currentIntent, 'Fencing failure during catch handler forward recovery; student refunded.');
                        }
                    }
                    else {
                        await refundStudentWallet(db, currentIntent, 'Order dispatch error in catch handler; student refunded.');
                    }
                }
                else {
                    // Money was NOT debited: safe backward compensation — release any acquired leases
                    functions.logger.info('ARCH-B: Compensating by releasing RTDB inventory leases', { intentId });
                    await releaseRtdbLeases(rtdb, cart, intentId, (_f = currentIntent.journal) === null || _f === void 0 ? void 0 : _f.fenceToken);
                    await intentRef.update({
                        state: 'CANCELLED',
                        'journal.rtdbLeaseReleased': true,
                        errorMessage: (error === null || error === void 0 ? void 0 : error.message) || 'Transaction aborted before financial commit',
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            }
        }
        catch (compensationErr) {
            functions.logger.error('ARCH-B: Secondary error during catch compensation handler', { intentId, compensationErr });
        }
        if (error instanceof https.HttpsError) {
            throw error;
        }
        const msg = (error === null || error === void 0 ? void 0 : error.message) || 'Transaction failed';
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
exports.securePlaceKioskOrder = https.onCall(async (request) => {
    const { data, auth } = request;
    // The Kiosk should ideally be authenticated (even anonymously)
    if (!(auth === null || auth === void 0 ? void 0 : auth.uid)) {
        throw new https.HttpsError('unauthenticated', 'Kiosk must be authenticated.');
    }
    const { cart, totalPrice: clientTotalPrice, slotName, orderType, paymentMode, studentRegNo, existingOrderId, existingOrderNumber } = data;
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
        const stockReverts = [];
        for (const item of cart) {
            const stockRef = rtdb.ref(`menu_stock/${item.id}`);
            const result = await stockRef.transaction((currentData) => {
                if (currentData === null)
                    return currentData;
                if ((currentData.stock || 0) >= item.qty) {
                    currentData.stock -= item.qty;
                    if (currentData.stock <= (currentData.minStock || 0))
                        currentData.available = false;
                    return currentData;
                }
                return undefined; // Abort
            });
            if (!result.committed) {
                // Revert already-decremented stock
                for (const revert of stockReverts) {
                    await revert.ref.transaction((d) => {
                        if (d !== null) {
                            d.stock = (d.stock || 0) + revert.qty;
                            d.available = true;
                        }
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
                    var _a;
                    const studentRef = db.collection('students').doc(studentRegNo);
                    const studentSnap = await transaction.get(studentRef);
                    if (!studentSnap.exists) {
                        throw new https.HttpsError('not-found', 'Student record not found.');
                    }
                    const studentData = studentSnap.data();
                    if ((studentData === null || studentData === void 0 ? void 0 : studentData.status) === 'disabled') {
                        throw new https.HttpsError('permission-denied', 'Account is disabled.');
                    }
                    if (paymentMode === 'credit') {
                        const balance = (studentData === null || studentData === void 0 ? void 0 : studentData.balance) || 0;
                        if (balance < serverTotalPrice) {
                            throw new https.HttpsError('resource-exhausted', 'Insufficient wallet balance.');
                        }
                        const newBal = balance - serverTotalPrice;
                        const newCred = ((studentData === null || studentData === void 0 ? void 0 : studentData.credits) || 0) - serverTotalPrice;
                        transaction.update(studentRef, { balance: newBal, credits: newCred });
                        if (studentData === null || studentData === void 0 ? void 0 : studentData.uid) {
                            const userRef = db.collection('users').doc(studentData.uid);
                            transaction.update(userRef, { walletBalance: newBal });
                        }
                        const ledgerRef = db.collection('ledger').doc();
                        transaction.set(ledgerRef, {
                            type: 'purchase',
                            studentRegNo: studentRegNo,
                            studentUid: (studentData === null || studentData === void 0 ? void 0 : studentData.uid) || 'UNKNOWN',
                            amount: serverTotalPrice,
                            orderId: orderId,
                            timestamp: admin.firestore.FieldValue.serverTimestamp(),
                            description: `Counter Order ${orderId}`
                        });
                    }
                    if (!existingOrderNumber) {
                        const counterSnap = await transaction.get(dailyCounterRef);
                        if (counterSnap.exists) {
                            orderNumber = (((_a = counterSnap.data()) === null || _a === void 0 ? void 0 : _a.count) || 0) + 1;
                            transaction.update(dailyCounterRef, { count: orderNumber });
                        }
                        else {
                            transaction.set(dailyCounterRef, { count: orderNumber, date: today });
                        }
                    }
                });
            }
            else {
                // External/Shop: Just increment counter
                if (!existingOrderNumber) {
                    await db.runTransaction(async (transaction) => {
                        var _a;
                        const counterSnap = await transaction.get(dailyCounterRef);
                        if (counterSnap.exists) {
                            orderNumber = (((_a = counterSnap.data()) === null || _a === void 0 ? void 0 : _a.count) || 0) + 1;
                            transaction.update(dailyCounterRef, { count: orderNumber });
                        }
                        else {
                            transaction.set(dailyCounterRef, { count: orderNumber, date: today });
                        }
                    });
                }
            }
        }
        catch (walletErr) {
            // Revert stock if wallet deduction fails!
            for (const revert of stockReverts) {
                await revert.ref.transaction((d) => {
                    if (d !== null) {
                        d.stock = (d.stock || 0) + revert.qty;
                        d.available = true;
                    }
                    return d;
                }).catch(() => { });
            }
            throw walletErr;
        }
        // 5. Create order in RTDB
        const enrichedCart = cart.map((item) => {
            var _a, _b;
            const menuEntry = menuPrices.get(String(item.id));
            return {
                id: item.id,
                name: (menuEntry === null || menuEntry === void 0 ? void 0 : menuEntry.name) || item.name || 'Unknown Item',
                price: (_b = (_a = menuEntry === null || menuEntry === void 0 ? void 0 : menuEntry.price) !== null && _a !== void 0 ? _a : item.price) !== null && _b !== void 0 ? _b : 0,
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
    }
    catch (error) {
        if (error instanceof https.HttpsError)
            throw error;
        throw new https.HttpsError('internal', (error === null || error === void 0 ? void 0 : error.message) || `Failed to place ${orderType} order.`);
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// securePlaceUpiOrder — Server-side UPI order with price validation
// ─────────────────────────────────────────────────────────────────────────────
exports.securePlaceUpiOrder = https.onCall(async (request) => {
    var _a;
    const { data, auth } = request;
    if (!(auth === null || auth === void 0 ? void 0 : auth.uid)) {
        throw new https.HttpsError('unauthenticated', 'You must be logged in to place an order.');
    }
    const { cart, totalPrice: clientTotalPrice, slotName } = data;
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
            throw new https.HttpsError('invalid-argument', `Price mismatch: expected ₹${serverTotalPrice}, received ₹${clientTotalPrice}.`);
        }
        // 3. Verify user type and status
        const userSnap = await db.collection('users').doc(auth.uid).get();
        if (!userSnap.exists)
            throw new https.HttpsError('not-found', 'User profile not found.');
        const userData = userSnap.data();
        const userType = userData === null || userData === void 0 ? void 0 : userData.userType;
        let rollNo = (userData === null || userData === void 0 ? void 0 : userData.rollNo) || 'EXTERNAL';
        if (userType === 'internal') {
            if (!rollNo || rollNo === 'EXTERNAL' || rollNo === 'UNREGISTERED') {
                throw new https.HttpsError('failed-precondition', 'Internal user missing roll number.');
            }
            const studentSnap = await db.collection('students').doc(rollNo).get();
            if (!studentSnap.exists)
                throw new https.HttpsError('not-found', 'Student record not found.');
            if (((_a = studentSnap.data()) === null || _a === void 0 ? void 0 : _a.status) === 'disabled') {
                throw new https.HttpsError('permission-denied', 'Account has been disabled.');
            }
        }
        else {
            // For external/guest users
            if ((userData === null || userData === void 0 ? void 0 : userData.status) === 'disabled') {
                throw new https.HttpsError('permission-denied', 'Guest account has been disabled.');
            }
            rollNo = 'EXTERNAL';
        }
        // 4. Atomically decrement RTDB stock (same pattern as securePlaceOrder)
        const stockReverts = [];
        for (const item of cart) {
            const stockRef = rtdb.ref(`menu_stock/${item.id}`);
            const result = await stockRef.transaction((currentData) => {
                if (currentData === null)
                    return currentData;
                if ((currentData.stock || 0) >= item.qty) {
                    currentData.stock -= item.qty;
                    if (currentData.stock <= (currentData.minStock || 0))
                        currentData.available = false;
                    return currentData;
                }
                return undefined; // Abort
            });
            if (!result.committed) {
                // Revert already-decremented stock
                for (const revert of stockReverts) {
                    await revert.ref.transaction((d) => {
                        if (d !== null) {
                            d.stock = (d.stock || 0) + revert.qty;
                            d.available = true;
                        }
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
            var _a;
            const counterSnap = await tx.get(dailyCounterRef);
            orderNumber = (counterSnap.exists ? (((_a = counterSnap.data()) === null || _a === void 0 ? void 0 : _a.count) || 0) : 0) + 1;
            if (counterSnap.exists) {
                tx.update(dailyCounterRef, { count: orderNumber });
            }
            else {
                tx.set(dailyCounterRef, { count: orderNumber, date: today });
            }
        });
        // 6. Create order in RTDB via Admin SDK (bypasses client write rules)
        // Enrich cart items with canonical names & prices to prevent "Unknown Item" in scanning/KDS
        const menuItems = await getMenuPrices(db);
        const enrichedCart = cart.map((item) => {
            var _a, _b;
            const menuEntry = menuItems.get(String(item.id));
            return {
                id: item.id,
                name: (menuEntry === null || menuEntry === void 0 ? void 0 : menuEntry.name) || item.name || 'Unknown Item',
                price: (_b = (_a = menuEntry === null || menuEntry === void 0 ? void 0 : menuEntry.price) !== null && _a !== void 0 ? _a : item.price) !== null && _b !== void 0 ? _b : 0,
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
    }
    catch (error) {
        if (error instanceof https.HttpsError)
            throw error;
        throw new https.HttpsError('internal', (error === null || error === void 0 ? void 0 : error.message) || 'Failed to place UPI order.');
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// collectOrder — Atomically mark order as collected (replaces client atomicCollectOrder)
// ─────────────────────────────────────────────────────────────────────────────
exports.collectOrder = https.onCall(async (request) => {
    const { data, auth } = request;
    if (!(auth === null || auth === void 0 ? void 0 : auth.uid)) {
        throw new https.HttpsError('unauthenticated', 'Authentication required.');
    }
    const { orderId } = data;
    if (!orderId)
        throw new https.HttpsError('invalid-argument', 'orderId is required.');
    const rtdb = admin.database();
    const orderRef = rtdb.ref(`active_orders/${orderId}`);
    let collectedOrder = null;
    const txResult = await orderRef.transaction((order) => {
        if (order === null)
            return order; // Abort — not found
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
        collectedOrder = Object.assign({}, order);
        return order;
    });
    if (!txResult.committed) {
        throw new https.HttpsError('not-found', 'Order not found.');
    }
    functions.logger.info('Order collected', { orderId, uid: auth.uid });
    return { success: true, order: Object.assign({ id: orderId }, collectedOrder) };
});
// ─────────────────────────────────────────────────────────────────────────────
// confirmAndCollectUpiOrder — Confirm UPI payment + collect in one atomic transaction
// ─────────────────────────────────────────────────────────────────────────────
exports.confirmAndCollectUpiOrder = https.onCall(async (request) => {
    const { data, auth } = request;
    if (!(auth === null || auth === void 0 ? void 0 : auth.uid)) {
        throw new https.HttpsError('unauthenticated', 'Authentication required.');
    }
    const { orderId } = data;
    if (!orderId)
        throw new https.HttpsError('invalid-argument', 'orderId is required.');
    const rtdb = admin.database();
    const orderRef = rtdb.ref(`active_orders/${orderId}`);
    const now = new Date().toISOString();
    let collectedOrder = null;
    const txResult = await orderRef.transaction((order) => {
        if (order === null)
            return order; // Abort — not found
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
        collectedOrder = Object.assign({}, order);
        return order;
    });
    if (!txResult.committed) {
        throw new https.HttpsError('not-found', 'Order not found.');
    }
    functions.logger.info('UPI order confirmed and collected', { orderId, uid: auth.uid });
    return { success: true, order: Object.assign({ id: orderId }, collectedOrder) };
});
// ─────────────────────────────────────────────────────────────────────────────
// cancelStalePendingOrders — Cron: auto-cancel PENDING UPI orders older than 15 min
// ─────────────────────────────────────────────────────────────────────────────
exports.cancelStalePendingOrders = (0, scheduler_1.onSchedule)({ schedule: 'every 5 minutes', timeZone: 'Asia/Kolkata' }, async () => {
    const rtdb = admin.database();
    const firestoreDb = admin.firestore();
    const cutoffMs = Date.now() - 15 * 60 * 1000; // 15 minutes ago
    const snap = await rtdb.ref('active_orders').once('value');
    if (!snap.exists()) {
        functions.logger.info('cancelStalePendingOrders: no active orders.');
        return;
    }
    const staleOrders = [];
    snap.forEach((child) => {
        const order = child.val();
        if ((order === null || order === void 0 ? void 0 : order.paymentStatus) === 'PENDING' &&
            new Date(order.createdAt).getTime() < cutoffMs) {
            staleOrders.push(Object.assign({ id: child.key }, order));
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
                    if (!stock)
                        return stock;
                    stock.stock = (stock.stock || 0) + item.qty;
                    if (stock.stock > (stock.minStock || 0))
                        stock.available = true;
                    return stock;
                });
            }
            // 2. Archive to Firestore
            const cancelledOrder = Object.assign(Object.assign({}, order), { status: 'expired', paymentStatus: 'CANCELLED', cancelledAt: new Date().toISOString(), cancelReason: 'auto_expired_15min', archivedAt: new Date().toISOString() });
            await firestoreDb.collection('historical_orders').doc(order.id).set(cancelledOrder);
            // 3. Remove from RTDB
            await rtdb.ref(`active_orders/${order.id}`).remove();
            functions.logger.info('Auto-cancelled stale order', { orderId: order.id });
        }
        catch (err) {
            functions.logger.error('Failed to cancel order', { orderId: order.id, err });
        }
    }
    functions.logger.info(`cancelStalePendingOrders: cancelled ${staleOrders.length} orders.`);
});
// ─────────────────────────────────────────────────────────────────────────────
// reconcileIncompleteIntents — ARCH-B Background Sweeper & Reconciler
// Runs every 1 minute: sweeps unfinalized transaction intents past lease expiry
// Evaluates journal flags and executes forward recovery or backward refund
// ─────────────────────────────────────────────────────────────────────────────
exports.reconcileIncompleteIntents = (0, scheduler_1.onSchedule)({ schedule: 'every 1 minutes', timeZone: 'Asia/Kolkata' }, async () => {
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
            const intent = docSnap.data();
            try {
                await reconcileIntent(db, rtdb, docSnap.id, intent);
            }
            catch (itemErr) {
                functions.logger.error('reconcileIncompleteIntents: error reconciling intent', {
                    intentId: docSnap.id,
                    itemErr
                });
            }
        }
    }
    catch (err) {
        functions.logger.error('reconcileIncompleteIntents job failed', { err });
    }
});
//# sourceMappingURL=index.js.map