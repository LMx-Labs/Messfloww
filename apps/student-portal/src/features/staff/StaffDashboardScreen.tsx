import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { 
  Users, CheckCircle2, Play, Package, 
  ArrowLeft, Search, Loader2, AlertCircle, 
  Clock, Bell, ChevronRight 
} from "lucide-react";
import confetti from "canvas-confetti";
import { staffService } from "../../features/staff/staffService";
import { messStatusService, MessStatus } from "../../features/ordering/messStatusService";
import { OrderDoc } from "../../features/orders/orderService";
import { toast } from "sonner";

export function StaffDashboardScreen() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [messStatus, setMessStatus] = useState<MessStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // Subscribe to Mess Status
    const unsubStatus = messStatusService.subscribeToMessStatus((status) => {
      setMessStatus(status);
    });

    // Subscribe to Active Orders
    const unsubOrders = staffService.subscribeToActiveOrders((activeOrders) => {
      setOrders(activeOrders);
      setLoading(false);
    });

    return () => {
      unsubStatus();
      unsubOrders();
    };
  }, []);

  const handleNextOrder = async () => {
    try {
      await staffService.serveNextOrder();
      toast.success("Called next order!");
    } catch (err) {
      toast.error("Failed to update queue.");
    }
  };

  const handleUpdateStatus = async (orderId: string, status: "ready" | "completed") => {
    try {
      await staffService.updateOrderStatus(orderId, status);
      toast.success(`Order marked as ${status}`);
      if (status === "completed") {
        confetti({
          particleCount: 100,
          spread: 50,
          origin: { y: 0.8 },
          colors: ["#60A5FA", "#10B981", "#FFD54F"]
        });
      }
    } catch (err) {
      toast.error("Failed to update order status.");
    }
  };

  const filteredOrders = orders.filter(o => 
    o.userRollNo.toLowerCase().includes(searchQuery.toLowerCase()) || 
    o.orderNumber.toString().includes(searchQuery)
  );

  const preparingOrders = filteredOrders.filter(o => o.status === "preparing");
  const readyOrders = filteredOrders.filter(o => o.status === "ready");

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#FFD54F] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] flex flex-col">
      {/* Header */}
      <div className="p-4 bg-[#1A1A1A] border-b border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/home")} className="text-gray-400">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-white text-xl font-bold">Staff Dashboard</h1>
          </div>
          <div className="bg-[#10B981]/20 px-3 py-1.5 rounded-full border border-[#10B981]/30">
            <span className="text-[#10B981] text-xs font-bold uppercase tracking-wider">LIVE</span>
          </div>
        </div>

        {/* Global Controls */}
        <div className="bg-gradient-to-r from-[#1E2A38] to-[#1E2A38]/50 rounded-2xl p-6 border border-white/10 flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm mb-1">Now Serving Order</p>
            <h2 className="text-5xl text-[#FFD54F] font-black">#{messStatus?.currentlyServing || 0}</h2>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleNextOrder}
            className="bg-[#FFD54F] text-[#121212] px-8 py-4 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-[#FFD54F]/20"
          >
            <Bell className="w-5 h-5" />
            CALL NEXT
          </motion.button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-20">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search Roll No or Order #"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-[#FFD54F]/50 transition-colors"
          />
        </div>

        {/* Orders Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Incoming Column */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-white/50 px-2">
              <Clock className="w-4 h-4" />
              <h3 className="text-xs font-bold uppercase tracking-widest">Incoming ({preparingOrders.length})</h3>
            </div>
            
            <AnimatePresence>
              {preparingOrders.map((order) => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  action={{
                    label: "Mark Ready",
                    icon: CheckCircle2,
                    color: "#10B981",
                    onClick: () => handleUpdateStatus(order.id, "ready")
                  }}
                />
              ))}
            </AnimatePresence>
          </section>

          {/* Ready Column */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-[#10B981]/50 px-2">
              <Package className="w-4 h-4" />
              <h3 className="text-xs font-bold uppercase tracking-widest">Ready for Pickup ({readyOrders.length})</h3>
            </div>
            
            <AnimatePresence>
              {readyOrders.map((order) => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  action={{
                    label: "Complete",
                    icon: Play,
                    color: "#60A5FA",
                    onClick: () => handleUpdateStatus(order.id, "completed")
                  }}
                />
              ))}
            </AnimatePresence>
          </section>
        </div>
      </div>
    </div>
  );
}

function OrderCard({ order, action }: { order: OrderDoc, action: any }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-[#1E2A38] rounded-2xl border border-white/5 overflow-hidden"
    >
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#121212] rounded-xl flex items-center justify-center border border-white/5 font-bold text-[#FFD54F]">
            #{order.orderNumber}
          </div>
          <div>
            <h4 className="text-white font-medium">{order.userRollNo}</h4>
            <p className="text-gray-500 text-xs">{order.items.length} items • {order.slotName}</p>
          </div>
        </div>
        
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 text-gray-500"
        >
          <ChevronRight className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </button>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="px-4 pb-4 overflow-hidden border-t border-white/5"
          >
            <div className="py-3 space-y-2">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-gray-400">{item.qty}x {item.name}</span>
                  <span className="text-white">₹{item.price * item.qty}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-white/5 flex justify-between font-bold text-white">
                <span>Total</span>
                <span>₹{order.totalPrice}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={action.onClick}
        className="w-full py-4 flex items-center justify-center gap-2 font-bold text-[10px] uppercase tracking-widest border-t border-white/5 hover:bg-white/5 transition-colors"
        style={{ color: action.color }}
      >
        <action.icon className="w-4 h-4" />
        {action.label}
      </button>
    </motion.div>
  );
}
