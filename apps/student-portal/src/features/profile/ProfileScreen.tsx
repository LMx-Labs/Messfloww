import { useNavigate } from "react-router";
import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  ArrowLeft, Wallet, User, History, LogOut, 
  Loader2, Download, PackageOpen, Database, 
  Shield, Calendar, ShieldCheck, ShieldAlert 
} from "lucide-react";
import { EmptyState } from "../../shared/components/EmptyState";
import { useAuth } from "../../core/auth/AuthContext";
import { orderService, OrderDoc } from "../../features/orders/orderService";
import { useInstallPrompt } from "../../shared/hooks/useInstallPrompt";
import { toast } from "sonner";

export function ProfileScreen() {
  const navigate = useNavigate();
  const { userProfile, user, logout } = useAuth();
  const { isInstallable, promptInstall } = useInstallPrompt();
  
  const [recentOrders, setRecentOrders] = useState<OrderDoc[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setOrdersLoading(true);
    setError(null);
    orderService.getOrderHistory(user.uid, null, 3)
      .then(({ orders }: { orders: OrderDoc[] }) => setRecentOrders(orders))
      .catch((err: any) => {
        console.error("Profile orders fetch failed:", err);
        setError(err.message || "Failed to load orders");
      })
      .finally(() => setOrdersLoading(false));
  }, [user]);

  return (
    <div className="min-h-screen bg-[#121212] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-b from-[#1A1A1A] to-[#1A1A1A]/95 backdrop-blur-lg border-b border-white/5 px-4 py-4">
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate("/home")}
            className="w-10 h-10 bg-[#1E2A38] rounded-full flex items-center justify-center border border-white/5"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </motion.button>
          <h1 className="text-white text-2xl font-bold">Profile</h1>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-[#1E2A38] to-[#1A2530] rounded-3xl p-6 border border-white/10 shadow-xl"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-[#FFD54F] to-[#FFE082] rounded-2xl flex items-center justify-center shadow-lg shadow-[#FFD54F]/20 overflow-hidden border-2 border-white/5">
              {userProfile?.photoURL ? (
                <img src={userProfile.photoURL} alt={userProfile.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-[#121212]" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-white text-xl font-bold">{userProfile?.name || "Student"}</h2>
                {userProfile?.isRegistered && (
                  <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                )}
              </div>
              <p className="text-gray-400 text-sm">{userProfile?.email || ""}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-[10px] bg-white/5 text-gray-400 px-2 py-0.5 rounded uppercase tracking-wider font-medium border border-white/5">
                  Roll: {userProfile?.isRegistered ? userProfile.rollNo : "NOT LINKED"}
                </span>
                {userProfile?.isRegistered ? (
                  <span className="text-[9px] bg-[#10B981]/10 text-[#10B981] px-2 py-0.5 rounded font-black tracking-widest border border-[#10B981]/20 uppercase">
                    Registered
                  </span>
                ) : (
                  <span className="text-[9px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded font-black tracking-widest border border-amber-500/20 uppercase">
                    Unregistered
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Wallet Section */}
          <div className="bg-[#121212]/40 rounded-2xl p-5 border border-[#FFD54F]/20">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-[#FFD54F]/10 rounded-lg flex items-center justify-center">
                <Wallet className="w-4 h-4 text-[#FFD54F]" />
              </div>
              <span className="text-white text-sm font-bold uppercase tracking-widest opacity-70">Credits</span>
            </div>
            <motion.h2 
              key={userProfile?.walletBalance}
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="text-4xl text-white font-black"
            >
              ₹{userProfile?.walletBalance || 0}
            </motion.h2>
          </div>
        </motion.div>

        {/* Recently Ordered */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-white">
              <History className="w-5 h-5 text-[#FFD54F]" />
              <h3 className="font-bold">Recent Orders</h3>
            </div>
            <button 
              onClick={() => navigate("/order-history")}
              className="text-[#FFD54F] text-xs font-bold uppercase tracking-wider"
            >
              View All
            </button>
          </div>

          <div className="space-y-3">
            {ordersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 text-[#FFD54F] animate-spin" />
              </div>
            ) : error ? (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center">
                <p className="text-red-500 text-xs font-bold">Unable to fetch recent orders</p>
                <p className="text-red-500/70 text-[9px] mt-1">Please check your connection or try again later.</p>
              </div>
            ) : recentOrders.length === 0 ? (
              <EmptyState
                icon={PackageOpen}
                title="No Orders Yet"
                description={userProfile?.isRegistered 
                  ? "Your delicious meals will appear here once you place your first order!"
                  : "Register as a student to start ordering delicious meals."}
              />
            ) : (
              recentOrders.map((order, idx) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  onClick={() => navigate(`/order-tracking/${order.id}`)}
                  className="bg-[#1E2A38] p-4 rounded-2xl border border-white/5 flex items-center justify-between group active:scale-95 transition-transform"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-[#121212] rounded-xl flex items-center justify-center text-[#FFD54F] font-bold text-xs border border-white/5">
                      #{order.orderNumber}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">
                        {order.items[0]?.name}{order.items.length > 1 ? ` +${order.items.length - 1}` : ''}
                      </p>
                      <p className="text-gray-500 text-[10px] flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} • {order.slotName}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold">₹{order.totalPrice}</p>
                    <p className={`text-[9px] uppercase font-black tracking-widest ${
                      order.status === 'ordered' ? 'text-amber-500' : 
                      order.status === 'preparing' ? 'text-indigo-400' : 
                      order.status === 'ready' ? 'text-[#10B981]' : 
                      order.status === 'completed' ? 'text-[#10B981]' : 
                      order.status === 'cancelled' ? 'text-red-500' : 
                      order.status === 'expired' ? 'text-gray-500' : 'text-gray-400'
                    }`}>
                      {order.status === 'ordered' ? 'order placed' : order.status}
                    </p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>



        {/* Logout & App Install */}
        <div className="space-y-3 pt-4">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={async () => {
              await logout();
              navigate("/", { replace: true });
            }}
            className="w-full py-4 bg-red-500/10 text-red-400 rounded-2xl border border-red-500/20 font-medium flex items-center justify-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            Log Out
          </motion.button>
        </div>
      </div>
    </div>
  );
}