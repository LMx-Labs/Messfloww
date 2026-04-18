import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Wallet, User, Zap, Package, Coffee, Info, X, RotateCcw, AlertTriangle, History, Calendar, ChevronRight } from "lucide-react";
import { MenuItem } from "../components/MenuItem";
import { CartPreview } from "../components/CartPreview";
import { InstallPromptBanner } from "../components/InstallPromptBanner";
import { useAuth } from "../contexts/AuthContext";
import { menuService, MenuData, type MenuItem as MenuItemData } from "../services/menuService";
import { orderService, OrderDoc } from "../services/orderService";
import { messStatusService, MessStatus } from "../services/messStatusService";
import { subscribeToActiveSlot, MealSlot, getCurrentSlot } from "../utils/mealSlots";
import { EmptyState } from "../components/EmptyState";


export function HomeScreen() {
  const navigate = useNavigate();
  const { userProfile, user } = useAuth();
  
  const [menuData, setMenuData] = useState<MenuData>({});
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [cart, setCart] = useState<{ id: number; name: string; price: number; qty: number }[]>([]);
  const [activeOrder, setActiveOrder] = useState<OrderDoc | null>(null);
  const [recentOrders, setRecentOrders] = useState<OrderDoc[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [messStatus, setMessStatus] = useState<MessStatus>({ isOpen: false, currentlyServing: 0 });
  const [activeSlot, setActiveSlot] = useState<MealSlot | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegBanner, setShowRegBanner] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Manual Refresh Function
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Force reload slot and menu data
      const slot = await getCurrentSlot();
      setActiveSlot(slot);
      setActiveSlot(slot);
      if (slot) {
        setSelectedCategory(slot.name.toLowerCase());
      }
      
      const latestMenu = await menuService.getMenu();
      setMenuData(latestMenu);
      
      // Briefly show success
      setTimeout(() => setIsRefreshing(false), 800);
    } catch (error) {
      console.error("Refresh failed:", error);
      setIsRefreshing(false);
    }
  }, []);

  // Load Menu Data and Sync with Active Slot
  useEffect(() => {
    setLoading(true);
    const unsubscribe = menuService.subscribeToMenu((data) => {
      setMenuData(data);
      setLoading(false);
    });
    
    // Polling fallback every 30 seconds to ensure sync even if socket drops
    const pollInterval = setInterval(handleRefresh, 30000);
    
    return () => {
      unsubscribe();
      clearInterval(pollInterval);
    };
  }, [handleRefresh]);

  // Listen to Active Slot
  useEffect(() => {
    const unsubscribe = subscribeToActiveSlot((slot) => {
      setActiveSlot(slot);
      if (slot) {
        setSelectedCategory(slot.name.toLowerCase());
      } else {
        setSelectedCategory("");
      }
    });
    
    // Also fetch all available slots for reference/diagnostics
    (async () => {
      const { getAllSlotsConfig } = await import("../utils/mealSlots");
      const slots = await getAllSlotsConfig();
      setAvailableSlots(slots.map(s => s.name.toLowerCase()));
    })();

    return () => unsubscribe();
  }, []);

  // Compute active items based on selected category with fuzzy matching fallback
  const activeItems: MenuItemData[] = useMemo((): MenuItemData[] => {
    if (!menuData) return [];
    
    // 1. Direct match (e.g., "breakfast" === "breakfast")
    if (selectedCategory && menuData[selectedCategory]) {
      return menuData[selectedCategory];
    }
    
    // 2. Fuzzy match (e.g., look for current slot name in keys, case-insensitive)
    if (selectedCategory) {
      const keys = Object.keys(menuData);
      const matchedKey = keys.find(k => k.toLowerCase() === selectedCategory.toLowerCase() || 
                                       k.toLowerCase().includes(selectedCategory.toLowerCase()) || 
                                       selectedCategory.toLowerCase().includes(k.toLowerCase()));
      if (matchedKey) return menuData[matchedKey];
    }

    // 3. Fallback: If no match but we have items, check for any common slot patterns
    if (selectedCategory && Object.keys(menuData).length > 0) {
      const keys = Object.keys(menuData);
      const bestEffort = keys.find(k => k.startsWith(selectedCategory.substring(0, 3)) || 
                                       selectedCategory.startsWith(k.substring(0, 3)));
      if (bestEffort) return menuData[bestEffort];
    }

    // 4. Last Resort: If there is ONLY ONE slot defined in the entire menu, use it if mess is open
    const allSlots = Object.keys(menuData);
    if (allSlots.length === 1 && selectedCategory) {
      console.log(`[HomeScreen] Failover: Using "${allSlots[0]}" items because it is the only slot available and mess is open.`);
      return menuData[allSlots[0]];
    }

    // Diagnostics
    if (!selectedCategory) {
      console.log("[HomeScreen] No active slot selected.");
    } else {
      const keys = Object.keys(menuData);
      if (keys.length === 0) {
        console.warn("[HomeScreen] Menu data is completely empty from Firestore.");
      } else {
        console.log(`[HomeScreen] No items found for slot: "${selectedCategory}". Available keys in menuData:`, keys);
      }
    }
    
    return [];
  }, [menuData, selectedCategory]);

  // Group active items by their specific category (e.g., Main Course, Drinks)
  const groupedItems = useMemo(() => {
    return activeItems.reduce((acc: Record<string, MenuItemData[]>, item: MenuItemData) => {
      const cat = item.category || "Other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {} as Record<string, MenuItemData[]>);
  }, [activeItems]);

  // Listen to Active Order
  useEffect(() => {
    if (!user) return;
    let unsubscribe: () => void;
    
    async function checkActiveOrder() {
      try {
        const order = await orderService.getActiveOrder(user!.uid);
        if (order) {
          unsubscribe = orderService.subscribeToOrder(order.id, (updatedOrder) => {
            if (updatedOrder && (updatedOrder.status === 'ordered' || updatedOrder.status === 'preparing' || updatedOrder.status === 'ready')) {
              setActiveOrder(updatedOrder);
            } else {
              setActiveOrder(null);
            }
          });
        }
      } catch (error) {
        console.error("Failed to fetch active order", error);
      }
    }
    checkActiveOrder();
    return () => { if (unsubscribe) unsubscribe(); };
  }, [user]);

  // Fetch Recent Orders (Limited to 3)
  useEffect(() => {
    if (!user) return;
    setOrdersLoading(true);
    setOrdersError(null);
    orderService.getOrderHistory(user.uid, null, 3)
      .then(({ orders }) => setRecentOrders(orders))
      .catch((err) => {
        console.error("Recent orders fetch failed:", err);
        setOrdersError(err.message || "Failed to load orders");
      })
      .finally(() => setOrdersLoading(false));
  }, [user, activeOrder]); // Refresh if active order status changes

  // Listen to Global Mess Status
  useEffect(() => {
    const unsubscribe = messStatusService.subscribeToMessStatus((status) => {
      setMessStatus(status);
    });
    return () => unsubscribe();
  }, []);

  const addToCart = (item: { id: number; name: string; price: number }) => {
    if (!userProfile?.isRegistered || userProfile?.status === 'disabled') return;

    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const walletBalance = userProfile?.walletBalance || 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-[#FFD54F] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] pb-24">
      {/* Registration Banner */}
      {showRegBanner && userProfile && !userProfile.isRegistered && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3 flex items-start gap-3 sticky top-0 z-20"
        >
          <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-amber-500 text-[11px] font-bold leading-relaxed uppercase tracking-wider">
              Unregistered Account: You need to be a registered student to place orders.
              Contact the mess admin to link your email.
            </p>
          </div>
          <button 
            onClick={() => setShowRegBanner(false)} 
            className="text-amber-500/50 hover:text-amber-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* Account Disabled Banner */}
      {userProfile && userProfile.status === 'disabled' && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="bg-red-500/20 border-b border-red-500/30 px-4 py-4 flex items-start gap-3 sticky top-0 z-30 backdrop-blur-md"
        >
          <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-500 text-sm font-black leading-tight uppercase tracking-tighter">
              Account Suspended / Disabled
            </p>
            <p className="text-red-400 text-[11px] font-medium leading-relaxed mt-1">
              Your account has been restricted by the mess management. You cannot place orders or use your wallet at this time. Please contact the administrator for clarification.
            </p>
          </div>
        </motion.div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-b from-[#1A1A1A] to-[#1A1A1A]/95 backdrop-blur-lg border-b border-white/5 px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFD54F] to-[#FFE082] flex items-center justify-center">
              <Zap className="w-5 h-5 text-[#121212]" />
            </div>
            <h1 className="text-2xl text-white font-bold">Messfloww</h1>
          </div>
          <div className="flex items-center gap-3">
            <motion.div
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 bg-[#1E2A38] px-4 py-2 rounded-full border border-[#FFD54F]/30"
            >
              <Wallet className="w-4 h-4 text-[#FFD54F]" />
              <span className="text-[#FFD54F] font-bold">₹{walletBalance}</span>
            </motion.div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/profile")}
              className="w-10 h-10 bg-[#1E2A38] rounded-full flex items-center justify-center border border-white/10"
            >
              <User className="w-5 h-5 text-white" />
            </motion.button>
          </div>
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between">
          <motion.div
             key={messStatus.isOpen ? 'open' : 'closed'}
             initial={{ scale: 0 }}
             animate={{ scale: 1 }}
             className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${
               messStatus.isOpen 
                 ? "bg-[#10B981]/20 border-[#10B981]/50" 
                 : "bg-red-500/20 border-red-500/50"
             }`}
           >
             <div className={`w-2 h-2 rounded-full ${messStatus.isOpen ? "bg-[#10B981] animate-pulse" : "bg-red-500"}`} />
             <span className={`text-sm font-medium ${messStatus.isOpen ? "text-[#10B981]" : "text-red-400"}`}>
               {messStatus.isOpen ? "Mess Open" : "Mess Closed"}
             </span>
           </motion.div>

           <button 
             onClick={handleRefresh}
             className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors ${isRefreshing ? 'opacity-50 pointer-events-none' : ''}`}
           >
             <RotateCcw className={`w-4 h-4 text-[#FFD54F] ${isRefreshing ? 'animate-spin' : ''}`} />
             <span className="text-xs text-[#FFD54F] font-bold uppercase tracking-wider">Sync Menu</span>
           </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-6">
        {/* Track Order Button */}
        {activeOrder && (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(`/order-tracking/${activeOrder.id}`)}
            className="w-full bg-gradient-to-r from-[#FFD54F] to-[#FFE082] rounded-2xl p-4 flex items-center justify-between border-2 border-[#FFD54F]/50 shadow-lg shadow-[#FFD54F]/20"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#121212]/20 rounded-full flex items-center justify-center">
                <Package className="w-5 h-5 text-[#121212]" />
              </div>
              <div className="text-left">
                <p className="text-[#121212] font-bold">Active Order #{activeOrder.orderNumber}</p>
                <p className="text-[#121212]/70 text-[10px] font-bold uppercase tracking-wider">
                  Pickup: {activeOrder.estimatedServingWindow}
                </p>
              </div>
            </div>
            <div className="text-[#121212] font-bold">Track →</div>
          </motion.button>
        )}

        {/* Diagnostic Warning (Only shows if there is a detected sync issue) */}
        {messStatus.isOpen && !activeSlot && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-red-500 text-sm font-bold">Slot Sync Issue Detected</p>
              <p className="text-red-500/70 text-xs">Mess is open but no server slot is active. Tap "Sync Menu" to retry.</p>
            </div>
          </div>
        )}

        {/* Recent Orders Section */}
        {userProfile && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#FFD54F]" />
                <h3 className="text-lg text-white font-bold">Recent Orders</h3>
              </div>
              <button 
                onClick={() => navigate("/order-history")}
                className="text-[#FFD54F] text-xs font-bold uppercase tracking-wider hover:opacity-80 transition-opacity"
              >
                View All
              </button>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {ordersLoading ? (
                <div className="flex justify-center py-4">
                  <div className="w-6 h-6 border-2 border-[#FFD54F] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : ordersError ? (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center">
                  <p className="text-red-500 text-xs font-bold">Unable to fetch recent orders</p>
                  <p className="text-red-500/70 text-[9px] mt-1">Please check your connection or try again later.</p>
                </div>
              ) : recentOrders.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                  <p className="text-gray-500 text-sm">No recent orders found</p>
                </div>
              ) : (
                recentOrders.map((order, idx) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    onClick={() => navigate(`/order-tracking/${order.id}`)}
                    className="bg-[#1E2A38] p-4 rounded-2xl border border-white/5 flex items-center justify-between group active:scale-[0.98] transition-all cursor-pointer hover:border-white/20"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-[#121212] rounded-xl flex items-center justify-center text-[#FFD54F] font-bold text-xs border border-white/5">
                        #{order.orderNumber}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium line-clamp-1">
                          {order.items[0]?.name}{order.items.length > 1 ? ` +${order.items.length - 1}` : ''}
                        </p>
                        <p className="text-gray-500 text-[10px] flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} • {order.slotName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-white text-sm font-bold">₹{order.totalPrice}</p>
                        <p className={`text-[9px] uppercase font-black tracking-widest mt-0.5 ${
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
                      <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Menu Section */}
        {activeSlot && messStatus.isOpen && activeItems.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Coffee className="w-5 h-5 text-[#FFD54F]" />
                <h2 className="text-xl text-white font-bold capitalize">{activeSlot.name} Menu</h2>
              </div>
              <span className="text-xs text-[#FFD54F] font-bold bg-[#FFD54F]/10 px-3 py-1 rounded-full border border-[#FFD54F]/20">
                {activeSlot.time}
              </span>
            </div>
            
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedCategory}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {Object.entries(groupedItems).map(([categoryName, items]) => (
                  <div key={categoryName} className="space-y-3">
                    <h3 className="text-lg font-bold text-white/90 border-b border-white/10 pb-2">{categoryName}</h3>
                    {(items as MenuItemData[]).map((item: MenuItemData) => {
                      let stockStatus: "high" | "low" | "out" = "high";
                      if (item.stock <= 0 || !item.available) stockStatus = "out";
                      else if (item.stock <= (item.minStock || 20)) stockStatus = "low";
                      
                      return (
                        <MenuItem 
                          key={item.id} 
                          item={{ ...item, stock: stockStatus }} 
                          onAdd={addToCart} 
                          isRestricted={userProfile?.status === 'disabled'}
                          isUnregistered={!userProfile?.isRegistered}
                        />
                      );
                    })}
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        ) : (
          <EmptyState
            icon={Coffee}
            title={!messStatus.isOpen ? "Mess is Currently Closed" : "No Items Available"}
            description={!messStatus.isOpen 
              ? "We're preparing the next meal for you! Please check back during scheduled mess hours." 
              : !activeSlot 
                ? "The mess is reported as open, but no specific meal slot (like Breakfast/Lunch) is active yet. Please wait for the admin to start the session."
                : `We couldn't find any menu items for the "${activeSlot.name}" slot. Check back in a moment or try syncing the menu.`}
          />
        )}
      </div>

      <InstallPromptBanner />

      {totalItems > 0 && (
        <CartPreview
          totalItems={totalItems}
          totalPrice={totalPrice}
          onViewCart={() => navigate("/cart", { state: { cart, walletBalance } })}
        />
      )}
    </div>
  );
}