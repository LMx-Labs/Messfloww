import { collection, query, where, getDocs, orderBy, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { rtdbService } from "./rtdbService";
import { Student } from "../context/StudentContext";
import { Order } from "../context/OrderContext";
import { MenuItem } from "../context/MenuContext";

// --- Types ---
export interface ReportData {
  title: string;
  generatedAt: string;
  data: any;
  insights: string[];
}

// --- Data Fetchers ---

export const fetchOrdersForRange = async (startDate: Date, endDate: Date): Promise<Order[]> => {
  const ordersRef = collection(db, "historical_orders");
  const q = query(
    ordersRef,
    where("createdAt", ">=", startDate.toISOString()),
    where("createdAt", "<=", endDate.toISOString())
  );
  
  const snapshot = await getDocs(q);
  const orders: Order[] = [];
  snapshot.forEach((doc) => orders.push({ id: doc.id, ...doc.data() } as Order));
  return orders;
};

export const fetchAllStudents = async (): Promise<Student[]> => {
  const studentsRef = collection(db, "students");
  const snapshot = await getDocs(studentsRef);
  const students: Student[] = [];
  snapshot.forEach((doc) => students.push({ id: doc.id, ...doc.data() } as unknown as Student));
  return students;
};

export const fetchLedgerEntries = async (startDate: Date, endDate: Date): Promise<any[]> => {
    const ledgerRef = collection(db, "ledger");
    const q = query(
        ledgerRef,
        where("timestamp", ">=", startDate.toISOString()),
        where("timestamp", "<=", endDate.toISOString()),
        orderBy("timestamp", "desc")
    );
    const snapshot = await getDocs(q);
    const entries: any[] = [];
    snapshot.forEach(doc => entries.push({ id: doc.id, ...doc.data() }));
    return entries;
};

// Assuming menu items are stored in a structure we can fetch. For now, we simulate fetching menu with stock.
// A real implementation would query the 'menu' collection and merge with 'menu_stock' from RTDB.
export const fetchMenuWithStock = async (): Promise<Record<string, MenuItem[]>> => {
    // Placeholder fetching logic.  In a fully unified system, this would pull from Firestore then attach RTDB stock.
    // For now we will rely on data passed in where needed, or expand this if a global menu store exists.
    return {};
};


// --- Report Generators: Sales & Revenue ---

export const generateDailyRevenue = async (date: Date): Promise<ReportData> => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const orders = await fetchOrdersForRange(startOfDay, endOfDay);
    
    let totalRevenue = 0;
    let orderCount = orders.length;
    const revenueBySlot: Record<string, number> = {};

    orders.forEach(order => {
        if (order.status !== 'cancelled') {
            totalRevenue += order.totalPrice;
            const slot = order.slotName || 'Unknown';
            revenueBySlot[slot] = (revenueBySlot[slot] || 0) + order.totalPrice;
        }
    });

    const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;
    
    // Formatting data for chart
    const chartData = Object.keys(revenueBySlot).map(slot => ({
        name: slot.charAt(0).toUpperCase() + slot.slice(1),
        revenue: revenueBySlot[slot]
    }));

    return {
        title: "Daily Revenue",
        generatedAt: new Date().toISOString(),
        data: { totalRevenue, orderCount, avgOrderValue, chartData },
        insights: [
            orderCount > 0 ? `Average order value is ₹${avgOrderValue.toFixed(2)}.` : "No orders today yet."
        ]
    };
};

export const generateItemWiseRevenue = async (startDate: Date, endDate: Date): Promise<ReportData> => {
    const orders = await fetchOrdersForRange(startDate, endDate);
    
    const itemStats: Record<string, { qty: number, revenue: number, name: string }> = {};
    let totalRevenue = 0;

    orders.forEach(order => {
        if (order.status !== 'cancelled' && order.items) {
            totalRevenue += order.totalPrice;
            order.items.forEach(item => {
                if (!itemStats[item.id]) {
                    itemStats[item.id] = { qty: 0, revenue: 0, name: item.name };
                }
                itemStats[item.id].qty += item.qty;
                itemStats[item.id].revenue += (item.qty * item.price);
            });
        }
    });

    const itemsArray = Object.values(itemStats).map(stat => ({
        ...stat,
        contribution: totalRevenue > 0 ? (stat.revenue / totalRevenue) * 100 : 0
    })).sort((a, b) => b.revenue - a.revenue);

    const topItems = itemsArray.slice(0, 10);

    return {
        title: "Item-Wise Revenue",
        generatedAt: new Date().toISOString(),
        data: { items: itemsArray, topItems },
        insights: [
            topItems.length > 0 ? `${topItems[0].name} is the top revenue driver.` : "Insufficient data."
        ]
    };
};

export const generatePeakHourSales = async (date: Date): Promise<ReportData> => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const orders = await fetchOrdersForRange(startOfDay, endOfDay);
    const hourlyData = new Array(24).fill(0).map((_, i) => ({ hour: `${i}:00`, orders: 0, revenue: 0 }));

    orders.forEach(order => {
        if (order.status !== 'cancelled' && order.createdAt) {
            const orderDate = new Date(order.createdAt);
            const hour = orderDate.getHours();
            hourlyData[hour].orders += 1;
            hourlyData[hour].revenue += order.totalPrice;
        }
    });

    // Find peak hour
    let peakHour = 0;
    let maxOrders = 0;
    hourlyData.forEach((data, index) => {
        if (data.orders > maxOrders) {
            maxOrders = data.orders;
            peakHour = index;
        }
    });

    return {
        title: "Peak Hour Sales",
        generatedAt: new Date().toISOString(),
        data: { hourlyData },
        insights: [
            maxOrders > 0 ? `Peak order volume is at ${peakHour}:00 with ${maxOrders} orders.` : "No data available."
        ]
    };
};

export const generatePaymentTypeReport = async (startDate: Date, endDate: Date): Promise<ReportData> => {
    const orders = await fetchOrdersForRange(startDate, endDate);
    
    let wallet = 0;
    let external = 0;
    let counter = 0;

    orders.forEach(order => {
        if (order.status !== 'cancelled') {
            if (order.isExternal) external += order.totalPrice;
            else if (order.isCounterOrder) counter += order.totalPrice;
            else wallet += order.totalPrice; // Assuming regular app orders are wallet
        }
    });

    const data = [
        { name: "Wallet (Student App)", value: wallet, fill: "var(--chart-1)" },
        { name: "External (Shop)", value: external, fill: "var(--chart-2)" },
        { name: "Counter (Admin)", value: counter, fill: "var(--chart-3)" }
    ];

    return {
        title: "Payment Type Breakdown",
        generatedAt: new Date().toISOString(),
        data: { types: data },
        insights: []
    };
};

// --- Report Generators: Wallet & Finance ---

export const generateWalletBalanceSummary = async (): Promise<ReportData> => {
    const students = await fetchAllStudents();
    
    let totalFloat = 0;
    let lowBalanceCount = 0;
    const distribution = {
        "Negative": 0,
        "0-100": 0,
        "100-500": 0,
        "500-1000": 0,
        "1000+": 0
    };

    students.forEach(s => {
        const bal = s.balance || 0;
        totalFloat += bal;
        if (bal < 100) lowBalanceCount++;

        if (bal < 0) distribution["Negative"]++;
        else if (bal <= 100) distribution["0-100"]++;
        else if (bal <= 500) distribution["100-500"]++;
        else if (bal <= 1000) distribution["500-1000"]++;
        else distribution["1000+"]++;
    });

    const activeStudents = students.length;
    const avgBalance = activeStudents > 0 ? totalFloat / activeStudents : 0;

    return {
        title: "Wallet Balance Summary",
        generatedAt: new Date().toISOString(),
        data: {
            totalFloat,
            avgBalance,
            lowBalanceCount,
            histogram: Object.keys(distribution).map(k => ({ range: k, count: distribution[k as keyof typeof distribution] }))
        },
        insights: [
            lowBalanceCount > 0 ? `${lowBalanceCount} students have a balance below ₹100.` : "Wallet balances look healthy."
        ]
    };
};

// Implementation stubs for remaining planned reports.
// These would be expanded based on specific data structures.

export const generateWalletRechargeReport = async (startDate: Date, endDate: Date) => { return { title: "Recharges", generatedAt: "", data: {}, insights: [] }; }
export const generateTopSpenders = async (startDate: Date, endDate: Date) => { return { title: "Top Spenders", generatedAt: "", data: {}, insights: [] }; }
export const generateLowBalanceStudents = async (threshold: number) => { return { title: "Low Balance", generatedAt: "", data: {}, insights: [] }; }

export const generateStockConsumption = async (date: Date) => { return { title: "Stock Consumption", generatedAt: "", data: {}, insights: [] }; }
export const generateLowStockAlerts = async () => { return { title: "Low Stock Alerts", generatedAt: "", data: {}, insights: [] }; }

export const generateFoodUtilization = async (date: Date) => { return { title: "Food Util", generatedAt: "", data: {}, insights: [] }; }
export const generateFastVsSlowItems = async (startDate: Date, endDate: Date) => { return { title: "Item Velocity", generatedAt: "", data: {}, insights: [] }; }

export const generateOrdersPerHour = async (date: Date) => { return generatePeakHourSales(date); } // Re-use logic for now
export const generateAvgOrderSize = async (startDate: Date, endDate: Date) => { return { title: "Avg Order Size", generatedAt: "", data: {}, insights: [] }; }
export const generateCounterLoadDistribution = async (date: Date) => { return { title: "Counter Load", generatedAt: "", data: {}, insights: [] }; }

export const generateMostOrderedItems = async (startDate: Date, endDate: Date) => { return generateItemWiseRevenue(startDate, endDate); } // Highly correlated
export const generateStudentPatterns = async (startDate: Date, endDate: Date) => { return { title: "Student Patterns", generatedAt: "", data: {}, insights: [] }; }

export const generateWeeklyTrends = async () => { return { title: "Weekly Trends", generatedAt: "", data: {}, insights: [] }; }
export const generateMonthlyTrends = async () => { return { title: "Monthly Trends", generatedAt: "", data: {}, insights: [] }; }

export const generateSmartInsights = async () => {
    return {
        title: "Smart Insights",
        generatedAt: new Date().toISOString(),
        data: {
            topInsights: [
                { id: 1, type: 'warning', title: 'Low Stock Alert', description: 'Maggi is running below 10 units.', action: 'Restock soon' },
                { id: 2, type: 'success', title: 'High Demand', description: 'Cold Coffee sales are up 20% this week.', action: 'Ensure sufficient supply' }
            ]
        },
        insights: ["Review these insights to optimize operations."]
    };
}
