import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { ArrowLeft, CheckCircle2, XCircle, Clock, Loader2, PackageOpen } from "lucide-react";
import { EmptyState } from "../components/EmptyState";
import { useAuth } from "../contexts/AuthContext";
import { orderService, OrderDoc } from "../services/orderService";
import { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";

export function OrderHistoryScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial batch
  useEffect(() => {
    async function fetchInitialOrders() {
      if (!user) return;
      try {
        const [historyRes, activeOrder] = await Promise.all([
          orderService.getOrderHistory(user.uid, null, 10),
          orderService.getActiveOrder(user.uid)
        ]);

        let merged = historyRes.orders;
        
        // If there is an active order and it's not already in history, insert at top
        if (activeOrder) {
          merged = [activeOrder as OrderDoc, ...merged.filter(o => o.id !== activeOrder.id)];
        }

        setOrders(merged);
        setLastDoc(historyRes.lastDoc);
        setHasMore(historyRes.orders.length === 10);
      } catch (error: any) {
        console.error("Error fetching orders:", error);
        setError(error.message || "Failed to load order history");
      } finally {
        setLoading(false);
      }
    }
    fetchInitialOrders();
  }, [user]);

  // Fetch next batch
  const loadMore = async () => {
    if (!user || !lastDoc || !hasMore) return;
    
    setLoadingMore(true);
    try {
      const { orders: moreOrders, lastDoc: newLastDoc } = await orderService.getOrderHistory(user.uid, lastDoc, 10);
      setOrders(prev => [...prev, ...moreOrders]);
      setLastDoc(newLastDoc);
      setHasMore(moreOrders.length === 10);
    } catch (error) {
      console.error("Error loading more orders:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const getStatusConfig = (status: OrderDoc["status"]) => {
    if (status === "completed") {
      return {
        icon: CheckCircle2,
        bgColor: "bg-[#10B981]/10",
        borderColor: "border-[#10B981]/30",
        textColor: "text-[#10B981]",
        label: "Completed",
      };
    } else if (status === "ordered") {
      return {
        icon: Clock,
        bgColor: "bg-amber-500/10",
        borderColor: "border-amber-500/30",
        textColor: "text-amber-500",
        label: "Order Placed",
      };
    } else if (status === "preparing") {
      return {
        icon: Clock,
        bgColor: "bg-indigo-500/10",
        borderColor: "border-indigo-500/30",
        textColor: "text-indigo-400",
        label: "Preparing",
      };
    } else if (status === "expired") {
      return {
        icon: XCircle,
        bgColor: "bg-gray-500/10",
        borderColor: "border-gray-500/30",
        textColor: "text-gray-400",
        label: "Slot Expired",
      };
    } else if (status === "cancelled") {
      return {
        icon: XCircle,
        bgColor: "bg-red-500/10",
        borderColor: "border-red-500/30",
        textColor: "text-red-400",
        label: "Cancelled",
      };
    } else {
      return {
        icon: Clock,
        bgColor: "bg-[#FFD54F]/10",
        borderColor: "border-[#FFD54F]/30",
        textColor: "text-[#FFD54F]",
        label: status === 'ready' ? 'Ready' : 'Active',
      };
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#FFD54F] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] pb-32">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-b from-[#1A1A1A] to-[#1A1A1A]/95 backdrop-blur-lg border-b border-white/5 px-4 py-4">
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate("/profile")}
            className="w-10 h-10 bg-[#1E2A38] rounded-full flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </motion.button>
          <div>
            <h1 className="text-white text-2xl">Order History</h1>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
            <p className="text-red-500 font-bold mb-2 uppercase tracking-tight">Access Error</p>
            <p className="text-red-500/70 text-xs leading-relaxed">
              We couldn't load your order history. This is often caused by a missing Firestore index. 
              Please check your browser console for a setup link.
            </p>
          </div>
        ) : (
          orders.map((order, index) => {
          const statusConfig = getStatusConfig(order.status);
          const StatusIcon = statusConfig.icon;

          return (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.05, 0.3) }}
              className={`bg-[#1E2A38] rounded-2xl p-5 border ${
                order.status === "completed" ? "border-white/10" : "border-gray-600/20"
              }`}
            >
              {/* Order Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-white text-lg">Order <span className="text-sm bg-white/5 px-1.5 py-0.5 rounded">#{order.id.slice(-4)}</span></h3>
                    <div
                      className={`px-2 py-1 rounded-lg ${statusConfig.bgColor} border ${statusConfig.borderColor} flex items-center gap-1`}
                    >
                      <StatusIcon className={`w-3 h-3 ${statusConfig.textColor}`} />
                      <span className={`text-xs ${statusConfig.textColor}`}>
                        {statusConfig.label}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(order.createdAt)}</span>
                  </div>
                  <p className="text-gray-500 text-xs">{order.slotName} • {order.slotTime}</p>
                </div>
                <div className="text-right">
                  <span className="text-[#FFD54F] text-xl font-medium">₹{order.totalPrice}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="bg-[#121212]/50 rounded-xl p-4 border border-white/5">
                <h4 className="text-gray-400 text-xs mb-2">Items Ordered</h4>
                <div className="space-y-1">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#FFD54F]" />
                      <span
                        className={`text-sm ${
                          order.status === "completed" ? "text-white" : "text-gray-400"
                        }`}
                      >
                        {item.qty}x {item.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Message */}
              {order.status === "expired" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="mt-3 bg-gray-500/10 rounded-lg p-3 border border-gray-500/20"
                >
                  <p className="text-gray-400 text-xs text-center">
                    This order could not be served as the mess slot time ended
                  </p>
                </motion.div>
              )}
            </motion.div>
          );
        })
      )}

        {hasMore && orders.length > 0 && !error && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full py-3 rounded-xl border border-white/10 text-white flex justify-center items-center gap-2 mt-4 hover:bg-white/5 transition-colors"
          >
            {loadingMore ? <Loader2 className="w-5 h-5 animate-spin" /> : "Load More Orders"}
          </motion.button>
        )}
      </div>

      {/* Empty State (if no orders) */}
      {orders.length === 0 && (
        <div className="px-4 mt-8">
          <EmptyState
            icon={PackageOpen}
            title="No Orders Yet"
            description="Your order history will appear here once you place your first order. Ready for a meal?"
            actionLabel="Browse Menu"
            onAction={() => navigate("/home")}
          />
        </div>
      )}
    </div>
  );
}