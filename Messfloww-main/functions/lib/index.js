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
exports.checkMessSlotTimer = exports.processSubscriptions = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const mailer_1 = require("./config/mailer");
const dataAggregator_1 = require("./services/dataAggregator");
const emailTemplates_1 = require("./services/emailTemplates");
// Admin initialized in dataAggregator.ts, but let's ensure it here just in case this loads first
if (admin.apps.length === 0) {
    admin.initializeApp();
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
                await rtdb.ref('messStatus').set({ isOpen: true, currentlyServing: 0 });
            }
            else {
                // Deactivate
                await slotRef.set({
                    active: false,
                    slot: null,
                    updatedAt: now.toISOString(),
                    autoToggled: true
                });
                await rtdb.ref('messStatus').set({ isOpen: false });
            }
        }
        else {
            // Periodic Sync just in case
            await rtdb.ref('messStatus/isOpen').set(currentSlotData.active);
        }
        return null;
    }
    catch (error) {
        functions.logger.error("Error in checkMessSlotTimer:", error);
        return null;
    }
});
//# sourceMappingURL=index.js.map