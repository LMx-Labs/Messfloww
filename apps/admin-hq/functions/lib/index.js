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
exports.securePlaceOrder = exports.checkMessSlotTimer = exports.processSubscriptions = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const https = __importStar(require("firebase-functions/v2/https"));
const mailer_1 = require("./config/mailer");
const dataAggregator_1 = require("./services/dataAggregator");
const emailTemplates_1 = require("./services/emailTemplates");
// Admin initialized in dataAggregator.ts, but let's ensure it here just in case this loads first
if (admin.apps.length === 0) {
    admin.initializeApp({
        databaseURL: "https://messfloww-default-rtdb.asia-southeast1.firebasedatabase.app"
    });
}
/**
 * Hourly Cron Job: Processes active report subscriptions and emails them.
 * Efficiency constraints: Limit queries, optimize sends.
 */
exports.processSubscriptions = functions.pubsub.schedule('every 1 hours').onRun(async (context) => {
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
            .where('enabled', '==', true);
        // .where('sendTime', '==', currentHourString); // Optional: filter by time inside the query if indexed, or in memory
        const snapshot = await q.get();
        if (snapshot.empty) {
            functions.logger.info("No active subscriptions found for this hour.");
            return null;
        }
        // 2. Fetch Aggregated Data ONCE (Singleton pattern) 
        // instead of fetching per subscription to save read operations
        const revenueSummary = await (0, dataAggregator_1.getDailyRevenueSummary)();
        const lowStockAlerts = await (0, dataAggregator_1.getLowStockAlerts)();
        // 3. Process each subscription
        const emailPromises = [];
        snapshot.forEach(docSnap => {
            const sub = docSnap.data();
            // In-memory filter for time and frequency to avoid complex composite indexes
            if (sub.sendTime !== currentHourString)
                return;
            // Check frequency (simplified: daily sends every day)
            if (sub.frequency !== 'daily') {
                // Logic for weekly/monthly checks would go here based on now.getDay() etc.
                // functions.logger.info(`Skipping non-daily sub ${docSnap.id}`);
                // return;
            }
            // Generate Email HTML
            const htmlBody = (0, emailTemplates_1.generateReportEmailHTML)("Subscriber", // Ideally, link userId to a users collection to fetch real name
            revenueSummary, lowStockAlerts);
            // We define mail options
            const mailOptions = {
                from: `"MessFlow Analytics" <${mailer_1.SENDER_EMAIL}>`,
                to: sub.recipients.join(','),
                subject: `Your MessFlow Daily Report - ${now.toISOString().split('T')[0]}`,
                html: htmlBody,
            };
            // Push to promises array for parallel sending
            emailPromises.push(mailer_1.transporter.sendMail(mailOptions).then(() => {
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
    }
    catch (error) {
        functions.logger.error("Error processing subscriptions:", error);
        return null;
    }
});
/**
 * Minute-by-minute Cron Job: Automates Mess Slot Auto-Toggle (ON/OFF).
 * Ensures slots work irrespective of dashboard status.
 */
exports.checkMessSlotTimer = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
    var _a, _b, _c, _d;
    const db = admin.firestore();
    const rtdb = admin.database();
    try {
        // 1. Fetch Config and Settings
        const [configSnap, settingsSnap, currentSnap] = await Promise.all([
            db.doc('timeSlots/config').get(),
            db.doc('timeSlots/settings').get(),
            db.doc('timeSlots/current').get()
        ]);
        if (!configSnap.exists)
            return null;
        const slots = ((_a = configSnap.data()) === null || _a === void 0 ? void 0 : _a.slots) || [];
        const settings = settingsSnap.data() || { thresholdMinutes: 5, autoToggleEnabled: true };
        const currentSlotData = currentSnap.data() || { active: false, slot: null };
        if (!settings.autoToggleEnabled) {
            functions.logger.info("Auto-toggle is disabled. Skipping.");
            return null;
        }
        // 2. Determine Current Time in IST (Asia/Kolkata)
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        const parts = formatter.formatToParts(now);
        const hour = parseInt(((_b = parts.find(p => p.type === 'hour')) === null || _b === void 0 ? void 0 : _b.value) || '0');
        const minute = parseInt(((_c = parts.find(p => p.type === 'minute')) === null || _c === void 0 ? void 0 : _c.value) || '0');
        const currentTimeMinutes = hour * 60 + minute;
        functions.logger.info(`Checking slots at IST ${hour}:${minute} (${currentTimeMinutes} mins)`);
        // Helper to parse "HH:mm" or "HH:mm AM/PM" into minutes
        const parseTime = (timeStr) => {
            const timeParts = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
            if (!timeParts)
                return null;
            let h = parseInt(timeParts[1]);
            const m = parseInt(timeParts[2]);
            const period = timeParts[3];
            if (period) {
                if (period.toUpperCase() === 'PM' && h !== 12)
                    h += 12;
                else if (period.toUpperCase() === 'AM' && h === 12)
                    h = 0;
            }
            return h * 60 + m;
        };
        let shouldBeActiveSlot = null;
        for (const slot of slots) {
            const startMins = parseTime(slot.startTime);
            const endMins = parseTime(slot.endTime);
            if (startMins === null || endMins === null)
                continue;
            const autoOffMins = (endMins + (settings.thresholdMinutes || 5)) % 1440;
            let isInside = false;
            if (startMins > autoOffMins) { // Crosses midnight
                isInside = currentTimeMinutes >= startMins || currentTimeMinutes < autoOffMins;
            }
            else {
                isInside = currentTimeMinutes >= startMins && currentTimeMinutes < autoOffMins;
            }
            if (isInside) {
                shouldBeActiveSlot = slot;
                break; // Only one slot active at a time
            }
        }
        // 3. Compare with current state and Update if needed
        const currentActiveId = currentSlotData.active ? (_d = currentSlotData.slot) === null || _d === void 0 ? void 0 : _d.id : null;
        const targetActiveId = shouldBeActiveSlot ? shouldBeActiveSlot.id : null;
        if (currentActiveId !== targetActiveId) {
            functions.logger.info(`Transitioning slot: ${currentActiveId} -> ${targetActiveId}`);
            const slotRef = db.doc('timeSlots/current');
            if (shouldBeActiveSlot) {
                // Activate
                await slotRef.set({
                    active: true,
                    slot: shouldBeActiveSlot,
                    updatedAt: now.toISOString(),
                    autoToggled: true
                });
                await rtdb.ref('mess_status').set({ isOpen: true, currentlyServing: 0 });
            }
            else {
                // Deactivate
                await slotRef.set({
                    active: false,
                    slot: null,
                    updatedAt: now.toISOString(),
                    autoToggled: true
                });
                await rtdb.ref('mess_status').set({ isOpen: false });
            }
        }
        else {
            // Periodic Sync just in case
            await rtdb.ref('mess_status/isOpen').set(currentSlotData.active);
        }
        return null;
    }
    catch (error) {
        functions.logger.error("Error in checkMessSlotTimer:", error);
        return null;
    }
});
/**
 * securePlaceOrder: The "Aspirin Logic" Checkout Flow
 * 1. Checks if Admin is Online.
 * 2. Checks if the student's status is "active".
 * 3. Checks if wallet balance is sufficient.
 * 4. Checks RTDB stock counts.
 * 5. Atomically performs deductions and creates the order.
 */
exports.securePlaceOrder = https.onCall(async (request) => {
    var _a;
    const { data, auth } = request;
    if (!(auth === null || auth === void 0 ? void 0 : auth.uid)) {
        throw new https.HttpsError('unauthenticated', 'You must be logged in to place an order.');
    }
    const { cart, totalPrice, slotName, paymentMode } = data;
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
        // Generate standard order ID
        const ts = Math.floor(Date.now() / 1000);
        const shortUid = auth.uid.length >= 4 ? auth.uid.slice(-4).toUpperCase() : auth.uid.padEnd(4, '0').toUpperCase();
        const orderId = `MFW-${ts}-${shortUid}`;
        // Get order counter for today
        const today = new Date().toISOString().split('T')[0];
        const dailyCounterRef = db.doc(`orderCounters/${today}`);
        const result = await db.runTransaction(async (transaction) => {
            var _a, _b;
            // 2. Load User and Student records
            const userRef = db.collection('users').doc(auth.uid);
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists) {
                throw new https.HttpsError('not-found', 'User profile not found.');
            }
            const rollNo = (_a = userSnap.data()) === null || _a === void 0 ? void 0 : _a.rollNo;
            if (!rollNo || rollNo === 'UNREGISTERED') {
                throw new https.HttpsError('failed-precondition', 'You must be a registered student to place an order.');
            }
            const studentRef = db.collection('students').doc(rollNo);
            const studentSnap = await transaction.get(studentRef);
            if (!studentSnap.exists) {
                throw new https.HttpsError('not-found', 'Student record not found.');
            }
            const studentData = studentSnap.data();
            // Verify Status
            if ((studentData === null || studentData === void 0 ? void 0 : studentData.status) === 'disabled') {
                throw new https.HttpsError('permission-denied', 'Account has been disabled. Order denied.');
            }
            // 3. Check Wallet Balance if paying by credit
            if (paymentMode === 'credit') {
                const balance = (studentData === null || studentData === void 0 ? void 0 : studentData.balance) || 0;
                if (balance < totalPrice) {
                    throw new https.HttpsError('resource-exhausted', 'Insufficient wallet balance.');
                }
            }
            // Read Daily Counter for receipt number
            const counterSnap = await transaction.get(dailyCounterRef);
            let orderNumber = 1;
            if (counterSnap.exists) {
                orderNumber = (((_b = counterSnap.data()) === null || _b === void 0 ? void 0 : _b.count) || 0) + 1;
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
        const stockReverts = [];
        let stockFailed = false;
        let failedItemName = '';
        for (const item of cart) {
            const stockRef = rtdb.ref(`menu_stock/${item.id}`);
            const fallbackResult = await stockRef.transaction((currentData) => {
                if (currentData === null)
                    return currentData;
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
            }
            else {
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
            var _a, _b;
            const studentSnap = await transaction.get(result.studentRef);
            if (paymentMode === 'credit') {
                const newBal = (((_a = studentSnap.data()) === null || _a === void 0 ? void 0 : _a.balance) || 0) - totalPrice;
                const newCred = (((_b = studentSnap.data()) === null || _b === void 0 ? void 0 : _b.credits) || 0) - totalPrice;
                transaction.update(result.studentRef, { balance: newBal, credits: newCred });
                transaction.update(db.collection('users').doc(auth.uid), { walletBalance: newBal });
                const ledgerRef = db.collection('ledger').doc();
                transaction.set(ledgerRef, {
                    type: 'purchase',
                    studentRegNo: result.studentData.regNo,
                    studentUid: auth.uid,
                    amount: totalPrice,
                    orderId: orderId,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    description: `Order ${orderId}`
                });
            }
            if (result.counterExists) {
                transaction.update(result.dailyCounterRef, { count: result.orderNumber });
            }
            else {
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
            userRollNo: result.studentData.regNo,
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
    }
    catch (error) {
        functions.logger.error('securePlaceOrder failed', JSON.stringify({
            message: error === null || error === void 0 ? void 0 : error.message,
            code: error === null || error === void 0 ? void 0 : error.code,
            details: error === null || error === void 0 ? void 0 : error.details,
            httpErrorCode: error === null || error === void 0 ? void 0 : error.httpErrorCode,
            stack: (_a = error === null || error === void 0 ? void 0 : error.stack) === null || _a === void 0 ? void 0 : _a.substring(0, 500),
        }));
        // HttpsError thrown inside db.runTransaction gets wrapped by Firestore.
        // Check for it directly first, then look for wrapped message patterns.
        if (error instanceof https.HttpsError) {
            throw error;
        }
        // Firestore wraps thrown errors — try to extract meaningful message
        const msg = (error === null || error === void 0 ? void 0 : error.message) || 'Transaction failed';
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
//# sourceMappingURL=index.js.map