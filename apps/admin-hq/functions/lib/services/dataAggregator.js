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
exports.getLowStockAlerts = exports.getDailyRevenueSummary = void 0;
const admin = __importStar(require("firebase-admin"));
// Initialize admin app if not already initialized
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
/**
 * Returns summary stats for daily revenue to embed in the email.
 */
const getDailyRevenueSummary = async (date = new Date()) => {
    try {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
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
    }
    catch (error) {
        console.error("Error aggregating daily revenue:", error);
        return null;
    }
};
exports.getDailyRevenueSummary = getDailyRevenueSummary;
/**
 * Returns low stock alerts using a single pass across the menu collection.
 */
const getLowStockAlerts = async (threshold = 20) => {
    try {
        const q = db.collection("menu").where("stock", "<=", threshold);
        const snapshot = await q.get();
        const alerts = [];
        snapshot.forEach(doc => {
            alerts.push(Object.assign({ id: doc.id }, doc.data()));
        });
        return alerts;
    }
    catch (error) {
        console.error("Error fetching low stock alerts:", error);
        return [];
    }
};
exports.getLowStockAlerts = getLowStockAlerts;
//# sourceMappingURL=dataAggregator.js.map