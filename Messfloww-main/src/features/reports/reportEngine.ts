import { collection, query, where, getDocs, orderBy, Timestamp, limit, getDoc, doc } from "firebase/firestore";
import { ref, get } from "firebase/database";
import { db, rtdb } from "../../core/firebase";
import { Student, Order, MenuItem } from "../../shared/types";

// --- Types ---
export interface ReportData {
  title: string;
  generatedAt: string;
  data: any;
  insights: string[];
}

// --- Utilities ---
export const groupOrdersByHour = (orders: Order[]) => {
  const hourlyData = new Array(24).fill(0).map((_, i) => ({ hour: `${i}:00`, orders: 0, revenue: 0 }));
  orders.forEach(order => {
    if (order.status !== 'cancelled' && order.createdAt) {
        const hour = new Date(order.createdAt).getHours();
        hourlyData[hour].orders += 1;
        hourlyData[hour].revenue += order.totalPrice;
    }
  });
  return hourlyData;
};

export const groupOrdersByDate = (orders: Order[]) => {
  const dailyStats: Record<string, { revenue: number, orders: number }> = {};
  orders.forEach(order => {
    if (order.status !== 'cancelled' && order.createdAt) {
      const dateStr = new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      if (!dailyStats[dateStr]) {
        dailyStats[dateStr] = { revenue: 0, orders: 0 };
      }
      dailyStats[dateStr].revenue += order.totalPrice;
      dailyStats[dateStr].orders += 1;
    }
  });
  return dailyStats;
};

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
        where("timestamp", ">=", Timestamp.fromDate(startDate)),
        where("timestamp", "<=", Timestamp.fromDate(endDate)),
        orderBy("timestamp", "desc")
    );
    const snapshot = await getDocs(q);
    const entries: any[] = [];
    snapshot.forEach(doc => entries.push({ id: doc.id, ...doc.data() }));
    return entries;
};

// Assuming menu items are stored in a structure we can fetch. For now, we simulate fetching menu with stock.
// A real implementation would query the 'menu' collection and merge with 'menu_stock' from RTDB.
export const fetchMenuWithStock = async (): Promise<MenuItem[]> => {
    const menuRef = collection(db, "menu");
    const snapshot = await getDocs(menuRef);
    const items: MenuItem[] = [];
    snapshot.forEach(doc => items.push({ ...doc.data() } as MenuItem));
    return items;
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
    const hourlyData = groupOrdersByHour(orders);

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

export const generateWalletRechargeReport = async (startDate: Date, endDate: Date): Promise<ReportData> => {
    const ledgerRef = collection(db, "ledger");
    const q = query(
        ledgerRef,
        where("type", "==", "topup"),
        where("timestamp", ">=", Timestamp.fromDate(startDate)),
        where("timestamp", "<=", Timestamp.fromDate(endDate)),
        orderBy("timestamp", "desc")
    );
    const snapshot = await getDocs(q);
    const recharges: any[] = [];
    snapshot.forEach((doc) => recharges.push({ id: doc.id, ...doc.data() }));
    
    const dailyMap: Record<string, number> = {};
    const curr = new Date(startDate);
    while (curr <= endDate) {
        const dateStr = curr.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        dailyMap[dateStr] = 0;
        curr.setDate(curr.getDate() + 1);
    }
    
    let totalRecharged = 0;

    recharges.forEach(exec => {
        const ts = exec.timestamp?.toDate ? exec.timestamp.toDate() : new Date(exec.timestamp);
        const dateStr = ts.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        if (dailyMap[dateStr] !== undefined) {
            dailyMap[dateStr] += (exec.amount || 0);
        } else {
            dailyMap[dateStr] = (exec.amount || 0);
        }
        totalRecharged += (exec.amount || 0);
    });

    const dailyRecharges = Object.keys(dailyMap).map(date => ({
        date,
        amount: dailyMap[date]
    }));

    return {
        title: "Recharge Volume",
        generatedAt: new Date().toISOString(),
        data: { dailyRecharges, totalRecharged },
        insights: [
            `Total ₹${totalRecharged.toLocaleString()} recharged in this period.`
        ]
    };
};

export const generateTopSpenders = async (startDate: Date, endDate: Date): Promise<ReportData> => {
    const orders = await fetchOrdersForRange(startDate, endDate);
    const spendersMap: Record<string, { regNo: string, spend: number }> = {};

    orders.forEach(order => {
        if (order.status !== 'cancelled') {
            const key = order.userRollNo || order.userId;
            if (!spendersMap[key]) {
                spendersMap[key] = { regNo: key, spend: 0 };
            }
            spendersMap[key].spend += order.totalPrice;
        }
    });

    const spenders = Object.values(spendersMap)
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 10);

    const fullSpenders = await Promise.all(spenders.map(async (s) => {
        const studentRef = collection(db, "students");
        const querySnap = await getDocs(query(studentRef, where("regNo", "==", s.regNo), limit(1)));
        let name = "Student " + (s.regNo || "Unknown");
        if (!querySnap.empty) {
            name = querySnap.docs[0].data().name || name;
        }
        return {
            ...s,
            name
        };
    }));

    return {
        title: "Top Spenders",
        generatedAt: new Date().toISOString(),
        data: { spenders: fullSpenders },
        insights: fullSpenders.length > 0 ? [`${fullSpenders[0].name} is the highest spender.`] : []
    };
};

export const generateLowBalanceStudents = async (threshold: number): Promise<ReportData> => {
    const studentsRef = collection(db, "students");
    const q = query(studentsRef, where("balance", "<=", threshold), orderBy("balance", "asc"), limit(20));
    const snapshot = await getDocs(q);
    const lowBalance: Student[] = [];
    snapshot.forEach((doc) => lowBalance.push({ id: doc.id, ...doc.data() } as unknown as Student));

    return {
        title: "Low Balance Alerts",
        generatedAt: new Date().toISOString(),
        data: { students: lowBalance },
        insights: [`${lowBalance.length} students are below the ₹${threshold} threshold.`]
    };
};

export const generateStockConsumption = async (date: Date): Promise<ReportData> => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const [orders, menuItems] = await Promise.all([
        fetchOrdersForRange(startOfDay, endOfDay),
        fetchMenuWithStock()
    ]);

    const consumedMap: Record<number, number> = {};
    orders.forEach(order => {
        if (order.status !== 'cancelled') {
            order.items?.forEach(item => {
                consumedMap[item.id] = (consumedMap[item.id] || 0) + item.qty;
            });
        }
    });

    const consumption = menuItems.map(item => {
        const consumed = consumedMap[item.id] || 0;
        const initial = Math.max(item.stock || 0, item.initialStock || (consumed + (item.stock || 0)));
        return {
            name: item.name,
            consumed: consumed,
            remaining: Math.max(0, initial - consumed),
            initial: initial
        };
    }).filter(c => c.initial > 0 || c.consumed > 0);

    return {
        title: "Stock Consumption",
        generatedAt: new Date().toISOString(),
        data: { consumption },
        insights: []
    };
};

export const generateLowStockAlerts = async (): Promise<ReportData> => {
    const stockRef = ref(rtdb, "menu_stock");
    const snap = await get(stockRef);
    const stockMap: Record<string, any> = snap.exists() ? snap.val() : {};

    const menuItems = await fetchMenuWithStock();
    const alerts = menuItems.map(item => {
        const live = stockMap[item.id];
        if (live && live.stock <= live.minStock) {
            return { id: item.id, name: item.name, stock: live.stock, minStock: live.minStock };
        }
        return null;
    }).filter(Boolean);

    return {
        title: "Low Stock Alerts",
        generatedAt: new Date().toISOString(),
        data: { alerts },
        insights: alerts.length > 0 ? [`${alerts.length} items are currently critically low.`] : ["Stock levels are healthy."]
    };
};

export const generateFoodUtilization = async (date: Date): Promise<ReportData> => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const [orders, menuItems] = await Promise.all([
        fetchOrdersForRange(startOfDay, endOfDay),
        fetchMenuWithStock()
    ]);

    const consumedMap: Record<number, number> = {};
    orders.forEach(order => {
        if (order.status !== 'cancelled') {
            order.items?.forEach(item => {
                consumedMap[item.id] = (consumedMap[item.id] || 0) + item.qty;
            });
        }
    });

    const utilization = menuItems.map(item => {
        const sold = consumedMap[item.id] || 0;
        const prepared = item.initialStock || 0;
        const rate = prepared > 0 ? Math.round((sold / prepared) * 100) : 0;
        return {
            id: item.id,
            name: item.name,
            prepared,
            sold,
            rate
        };
    }).filter(u => u.prepared > 0 || u.sold > 0);

    return {
        title: "Food Utilization",
        generatedAt: new Date().toISOString(),
        data: { utilization },
        insights: []
    };
};

export const generateFastVsSlowItems = async (startDate: Date, endDate: Date): Promise<ReportData> => {
    const orders = await fetchOrdersForRange(startDate, endDate);
    const frequency: Record<string, { qty: number, name: string, id: number }> = {};

    orders.forEach(o => {
        o.items?.forEach(i => {
            if (!frequency[i.id]) frequency[i.id] = { qty: 0, name: i.name, id: i.id };
            frequency[i.id].qty += i.qty;
        });
    });

    const sorted = Object.values(frequency).sort((a, b) => b.qty - a.qty);
    const fastMovers = sorted.slice(0, 5);
    const slowMovers = sorted.slice(-5).reverse();

    return {
        title: "Item Velocity",
        generatedAt: new Date().toISOString(),
        data: { fastMovers, slowMovers },
        insights: []
    };
};

export const generateSmartInsights = async (): Promise<ReportData> => {
    // Collect some real signals
    const [lowStock, weeklyOrders] = await Promise.all([
        generateLowStockAlerts(),
        fetchOrdersForRange(new Date(Date.now() - 7 * 86400000), new Date())
    ]);

    const insights = [];

    // Signal: Low Stock
    if (lowStock.data.alerts.length > 0) {
        insights.push({
            id: 'ls',
            type: 'warning',
            title: 'Inventory Alert',
            description: `${lowStock.data.alerts[0].name} is low on stock (${lowStock.data.alerts[0].stock} left).`,
            action: 'Check Menu Stock'
        });
    }

    // Signal: Revenue Growth
    if (weeklyOrders.length > 50) {
        insights.push({
            id: 'hg',
            type: 'success',
            title: 'High Activity',
            description: `You've processed ${weeklyOrders.length} orders this week. Volume is healthy.`,
            action: 'View Sales'
        });
    } else {
        insights.push({
            id: 'hg',
            type: 'info',
            title: 'Low Activity',
            description: `Only ${weeklyOrders.length} orders this week. Consider promotions.`,
            action: 'View Marketing'
        });
    }

    // Signal: Slow Items (Underperforming)
    const velocityData = await generateFastVsSlowItems(new Date(Date.now() - 7 * 86400000), new Date());
    const slowMovers = velocityData.data.slowMovers || [];
    const underperforming = slowMovers.map((i: any) => ({ name: i.name, value: i.qty }));

    // Signal: High Waste (Low Sell-Through)
    const utilizationReport = await generateFoodUtilization(new Date());
    const waste = utilizationReport.data.utilization
        .filter((u: any) => u.rate < 40)
        .map((u: any) => ({ name: u.name, waste: u.prepared - u.sold }));

    // Signal: Demand (Peak Hours)
    const peakReport = await generatePeakHourSales(new Date());
    const demand = peakReport.insights;

    return {
        title: "Smart Insights",
        generatedAt: new Date().toISOString(),
        data: { 
            topInsights: insights,
            underperforming,
            waste,
            demand
        },
        insights: ["Derived from live operational data."]
    };
};

export const generateOrdersPerHour = async (date: Date): Promise<ReportData> => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const orders = await fetchOrdersForRange(startOfDay, endOfDay);
    const hourlyData = groupOrdersByHour(orders);

    return {
        title: "Orders Per Hour",
        generatedAt: new Date().toISOString(),
        data: { hourlyData },
        insights: []
    };
};

export const generateCounterLoadDistribution = async (date: Date): Promise<ReportData> => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const orders = await fetchOrdersForRange(startOfDay, endOfDay);
    const loadMap: Record<string, number> = {};

    orders.forEach(order => {
        if (order.status !== 'cancelled') {
            const slot = order.slotName || 'Unknown';
            loadMap[slot] = (loadMap[slot] || 0) + 1;
        }
    });

    const loadData = Object.keys(loadMap).map(name => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        orders: loadMap[name]
    })).sort((a, b) => b.orders - a.orders);

    return {
        title: "Counter Load Distribution",
        generatedAt: new Date().toISOString(),
        data: { loadData },
        insights: []
    };
};

export const generateMostOrderedItems = async (startDate: Date, endDate: Date): Promise<ReportData> => {
    const orders = await fetchOrdersForRange(startDate, endDate);
    const itemFreq: Record<string, { name: string, qty: number }> = {};

    orders.forEach(order => {
        if (order.status !== 'cancelled' && order.items) {
            order.items.forEach(item => {
                if (!itemFreq[item.id]) itemFreq[item.id] = { name: item.name, qty: 0 };
                itemFreq[item.id].qty += item.qty;
            });
        }
    });

    const topItems = Object.values(itemFreq)
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10);

    return {
        title: "Most Ordered Items",
        generatedAt: new Date().toISOString(),
        data: { topItems },
        insights: []
    };
};

export const generateStudentPatterns = async (startDate: Date, endDate: Date): Promise<ReportData> => {
    const orders = await fetchOrdersForRange(startDate, endDate);
    const userOrderCounts: Record<string, number> = {};

    orders.forEach(order => {
        if (order.status !== 'cancelled') {
            const userKey = order.userRollNo || order.userId || 'Guest';
            userOrderCounts[userKey] = (userOrderCounts[userKey] || 0) + 1;
        }
    });

    let repeat = 0;
    let newUsers = 0;
    
    Object.values(userOrderCounts).forEach(count => {
        if (count >= 2) repeat++;
        else newUsers++;
    });

    const userMix = [
        { name: "Repeat Users", value: repeat, fill: "var(--primary)" },
        { name: "New Users", value: newUsers, fill: "var(--accent)" }
    ];

    return {
        title: "Active Users",
        generatedAt: new Date().toISOString(),
        data: { userMix, totalActive: repeat + newUsers },
        insights: []
    };
};

export const generateWeeklyTrends = async (): Promise<ReportData> => {
    const end = new Date();
    const start = new Date(Date.now() - 6 * 86400000); // last 7 days including today
    start.setHours(0, 0, 0, 0);

    const orders = await fetchOrdersForRange(start, end);
    const dailyStats: Record<string, { revenue: number, orders: number }> = {};

    for (let i = 0; i < 7; i++) {
        const d = new Date(start.getTime() + i * 86400000);
        const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        dailyStats[dateStr] = { revenue: 0, orders: 0 };
    }

    orders.forEach(order => {
        if (order.status !== 'cancelled' && order.createdAt) {
            const d = new Date(order.createdAt);
            const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            if (dailyStats[dateStr]) {
                dailyStats[dateStr].revenue += order.totalPrice;
                dailyStats[dateStr].orders += 1;
            }
        }
    });

    const trend = Object.keys(dailyStats).map(dateStr => ({
        date: dateStr,
        revenue: dailyStats[dateStr].revenue,
        orders: dailyStats[dateStr].orders
    }));

    return {
        title: "Revenue Trend (Last 7 Days)",
        generatedAt: new Date().toISOString(),
        data: { trend },
        insights: []
    };
};

export const generateMonthlyTrends = async (): Promise<ReportData> => {
    const end = new Date();
    const start = new Date(Date.now() - 29 * 86400000); // last 30 days
    start.setHours(0, 0, 0, 0);

    const orders = await fetchOrdersForRange(start, end);
    const dailyStats: Record<string, { revenue: number, orders: number }> = {};

    for (let i = 0; i < 30; i++) {
        const d = new Date(start.getTime() + i * 86400000);
        const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        dailyStats[dateStr] = { revenue: 0, orders: 0 };
    }

    orders.forEach(order => {
        if (order.status !== 'cancelled' && order.createdAt) {
            const d = new Date(order.createdAt);
            const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            if (dailyStats[dateStr]) {
                dailyStats[dateStr].revenue += order.totalPrice;
                dailyStats[dateStr].orders += 1;
            }
        }
    });

    const trend = Object.keys(dailyStats).map(dateStr => ({
        date: dateStr,
        revenue: dailyStats[dateStr].revenue,
        orders: dailyStats[dateStr].orders
    }));

    return {
        title: "Revenue Trend (Last 30 Days)",
        generatedAt: new Date().toISOString(),
        data: { trend },
        insights: []
    };
};
