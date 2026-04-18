import { ShoppingCart, Users, DollarSign, TrendingUp, Download, Package } from "lucide-react";
import { Link } from "react-router";
import { useOrders } from "../context/OrderContext";
import { useStudents } from "../context/StudentContext";
import { useTimeSlots } from "../context/TimeSlotContext";
import { useMemo, useState, useEffect } from "react";
import { EmptyState } from "../components/EmptyState";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Order } from "../context/OrderContext";

export function Dashboard() {
  const { orders } = useOrders();
  const { activeStudentsCount } = useStudents();
  const { activeSlot } = useTimeSlots();
  const [historicalOrders, setHistoricalOrders] = useState<Order[]>([]);

  useEffect(() => {
    const fetchHistorical = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const q = query(
          collection(db, "historical_orders"),
          where("createdAt", ">=", today.toISOString())
        );
        const snap = await getDocs(q);
        const hOrders: Order[] = [];
        snap.forEach(doc => hOrders.push({ id: doc.id, ...doc.data() } as Order));
        setHistoricalOrders(hOrders);
      } catch (err) {
        console.error("Error fetching historical orders:", err);
      }
    };
    fetchHistorical();
  }, []);

  // Calculate real-time statistics
  const stats = useMemo(() => {
    // Combine live active orders with today's completed ones
    const allTodayOrders = [...orders, ...historicalOrders];
    // Get today's date in local time
    const todayStr = new Date().toLocaleDateString();

    // Filter today's orders
    const todayOrders = allTodayOrders.filter((order) => {
      if (!order.createdAt) return false;
      // Handle both Firestore Timestamp objects and raw date strings/numbers
      const orderDate = typeof order.createdAt === 'object' && 'toDate' in order.createdAt 
        ? (order.createdAt as any).toDate() 
        : new Date(order.createdAt);
      return orderDate.toLocaleDateString() === todayStr;
    });

    // Calculate total orders
    const totalOrders = todayOrders.length;

    // Calculate completed orders list
    const completedOrdersList = todayOrders.filter(
      (order) => order.status === "completed"
    );

    // Calculate total revenue from completed orders
    const totalRevenue = completedOrdersList.reduce((sum, order) => {
      return sum + order.totalPrice;
    }, 0);

    // Calculate average order value (completed orders only)
    const avgOrderValue = completedOrdersList.length > 0 
      ? Math.round(totalRevenue / completedOrdersList.length) 
      : 0;

    return [
      {
        name: "Today's Orders",
        value: totalOrders.toString(),
        icon: ShoppingCart,
        color: "primary",
      },
      {
        name: "Active Students",
        value: activeStudentsCount.toLocaleString(),
        icon: Users,
        color: "secondary",
      },
      {
        name: "Revenue Today",
        value: `₹${totalRevenue.toLocaleString()}`,
        icon: DollarSign,
        color: "accent",
      },
      {
        name: "Avg Order Value",
        value: `₹${avgOrderValue}`,
        icon: TrendingUp,
        color: "primary",
      },
    ];
  }, [orders, historicalOrders, activeStudentsCount]);

  const downloadDashboardReport = () => {
    // Prepare CSV content
    let csvContent = "MessFlow Dashboard Report\n";
    csvContent += `Generated: ${new Date().toLocaleString()}\n\n`;
    
    // Stats Summary
    csvContent += "=== SUMMARY STATISTICS ===\n";
    stats.forEach(stat => {
      csvContent += `${stat.name},${stat.value}\n`;
    });
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `MessFlow_Dashboard_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's what's happening today.</p>
        </div>
        <button
          onClick={downloadDashboardReport}
          className="bg-primary hover:bg-secondary text-primary-foreground px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors"
        >
          <Download className="h-5 w-5" />
          Download Report
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="bg-card rounded-xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg bg-${stat.color}/10`}>
                <stat.icon className={`h-6 w-6 text-${stat.color}`} />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-1">{stat.value}</h3>
            <p className="text-muted-foreground text-sm">{stat.name}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {activeSlot ? (
          <>
            <Link
              to="/scan"
              className="bg-primary hover:bg-secondary text-primary-foreground rounded-xl p-6 transition-colors shadow-md text-center"
            >
              <h3 className="text-xl font-bold mb-2">Scan Barcode</h3>
              <p className="text-sm opacity-90">Complete orders at counter</p>
            </Link>
            <Link
              to="/external-order"
              className="bg-primary hover:bg-secondary text-primary-foreground rounded-xl p-6 transition-colors shadow-md text-center"
            >
              <h3 className="text-xl font-bold mb-2">External Order</h3>
              <p className="text-sm opacity-90">Place shop/walk-in orders</p>
            </Link>
            <Link
              to="/orders"
              className="bg-primary hover:bg-secondary text-primary-foreground rounded-xl p-6 transition-colors shadow-md text-center"
            >
              <h3 className="text-xl font-bold mb-2">Live Orders</h3>
              <p className="text-sm opacity-90">Monitor active orders</p>
            </Link>
          </>
        ) : (
          <>
            <div className="bg-muted/50 text-muted-foreground rounded-xl p-6 shadow-md text-center opacity-60 cursor-not-allowed">
              <h3 className="text-xl font-bold mb-2">Scan Barcode</h3>
              <p className="text-sm opacity-90">Mess is closed</p>
            </div>
            <div className="bg-muted/50 text-muted-foreground rounded-xl p-6 shadow-md text-center opacity-60 cursor-not-allowed">
              <h3 className="text-xl font-bold mb-2">External Order</h3>
              <p className="text-sm opacity-90">Mess is closed</p>
            </div>
            <Link
              to="/orders"
              className="bg-primary hover:bg-secondary text-primary-foreground rounded-xl p-6 transition-colors shadow-md text-center"
            >
              <h3 className="text-xl font-bold mb-2">Live Orders</h3>
              <p className="text-sm opacity-90">View existing orders</p>
            </Link>
          </>
        )}
      </div>

      {/* View All Orders Button */}
      <div className="flex justify-center pt-4">
        <Link
          to="/orders"
          className="inline-flex items-center gap-2 bg-muted hover:bg-muted/80 text-foreground px-8 py-4 rounded-xl font-bold transition-all shadow-sm hover:shadow-md border border-border"
        >
          <ShoppingCart className="h-5 w-5" />
          View All Live Orders
        </Link>
      </div>
    </div>
  );
}
