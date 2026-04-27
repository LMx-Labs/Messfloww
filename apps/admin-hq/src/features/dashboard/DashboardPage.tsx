import { useState, useEffect, useMemo } from "react";
import { ShoppingCart, Users, DollarSign, TrendingUp, Download } from "lucide-react";
import { Link } from "react-router";
import { db, rtdb, orderService, timeSlotService } from "@messflow/shared-core";
import { Order, TimeSlot } from "@messflow/shared-core";
import { fetchAllStudents } from "../../features/students/studentService";
import { ManualOrderModal } from "./ManualOrderModal";

export function DashboardPage() {
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [historicalOrders, setHistoricalOrders] = useState<Order[]>([]);
  const [activeStudentsCount, setActiveStudentsCount] = useState<number>(0);
  const [activeSlot, setActiveSlot] = useState<TimeSlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  // 1. Subscribe to Active Orders (Core)
  useEffect(() => {
    return orderService.subscribeActiveOrders(setActiveOrders);
  }, []);

  // 2. Fetch Historical Orders for Today (Firestore)
  useEffect(() => {
    const fetchTodayStats = async () => {
      try {
        const { collection, query, where, getDocs } = await import("firebase/firestore");
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
    fetchTodayStats();
  }, []);

  // 3. Fetch Student Count (One-time fetch for dashboard is fine)
  useEffect(() => {
    fetchAllStudents().then(students => {
      setActiveStudentsCount(students.filter(s => s.status === "active").length);
    });
  }, []);

  // 4. Subscribe to Active Slot (Core)
  useEffect(() => {
    const unsubscribe = timeSlotService.subscribeToActiveSlot((slot: TimeSlot | null) => {
      setActiveSlot(slot);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Calculate real-time statistics
  const stats = useMemo(() => {
    const allTodayOrders = [...activeOrders, ...historicalOrders];
    const todayStr = new Date().toLocaleDateString();

    const todayOrders = allTodayOrders.filter((order) => {
      if (!order.createdAt) return false;
      const orderDate = new Date(order.createdAt);
      return orderDate.toLocaleDateString() === todayStr;
    });

    const totalOrders = todayOrders.length;
    const completedOrdersList = todayOrders.filter((order) => order.status === "completed");
    const totalRevenue = completedOrdersList.reduce((sum, order) => sum + order.totalPrice, 0);
    const avgOrderValue = completedOrdersList.length > 0 ? Math.round(totalRevenue / completedOrdersList.length) : 0;

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
  }, [activeOrders, historicalOrders, activeStudentsCount]);

  const downloadDashboardReport = () => {
    let csvContent = "MessFlow Dashboard Report\n";
    csvContent += `Generated: ${new Date().toLocaleString()}\n\n`;
    csvContent += "=== SUMMARY STATISTICS ===\n";
    stats.forEach(stat => {
      csvContent += `${stat.name},${stat.value}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `MessFlow_Dashboard_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading dashboard data...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's what's happening today.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsManualModalOpen(true)}
            className="bg-accent hover:bg-accent/80 text-accent-foreground px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors shadow-lg shadow-accent/20"
          >
            <ShoppingCart className="h-5 w-5" />
            Manual Order
          </button>
          <button
            onClick={downloadDashboardReport}
            className="bg-primary hover:bg-secondary text-primary-foreground px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors"
          >
            <Download className="h-5 w-5" />
            Download Report
          </button>
        </div>
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

      {/* Dashboard Summary Only - Kiosk and Kitchen are now separate applications */}
      <div className="bg-muted/20 border border-dashed border-border p-8 rounded-3xl text-center">
        <p className="text-muted-foreground font-medium">
          Note: Counter scanning and Kitchen displays have been moved to dedicated applications.
        </p>
      </div>

      <ManualOrderModal isOpen={isManualModalOpen} onClose={() => setIsManualModalOpen(false)} />
    </div>
  );
}
