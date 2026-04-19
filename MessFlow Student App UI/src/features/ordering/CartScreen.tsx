import { useNavigate, useLocation } from "react-router";
import { motion } from "motion/react";
import { ArrowLeft, Wallet, Trash2, Plus, Minus, Loader2, ShoppingCart, ShieldAlert } from "lucide-react";
import { EmptyState } from "../../shared/components/EmptyState";
import { useState, useEffect } from "react";
import { useAuth } from "../../core/auth/AuthContext";
import { orderService } from "../../features/orders/orderService";
import { getCurrentSlot } from "../../shared/utils/mealSlots";
import { toast } from "sonner";
import { tryConsume, ORDER_RATE, secondsUntilNextToken } from "../../shared/utils/rateLimiter";
import { ref, onValue } from "firebase/database";
import { rtdb } from "../../core/firebase/config";

export function CartScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userProfile, updateUserProfile } = useAuth();
  
  const { cart: initialCart } = location.state || { cart: [] };
  
  const [cart, setCart] = useState(initialCart);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdminOnline, setIsAdminOnline] = useState(true);

  // Kill-Switch: Listen to Admin Presence
  useEffect(() => {
    const adminOnlineRef = ref(rtdb, "system_status/admin_online");
    const unsubscribe = onValue(adminOnlineRef, (snap) => {
      setIsAdminOnline(snap.val() === true);
    });
    return () => unsubscribe();
  }, []);

  // Guard - Block unregistered or disabled users from seeing the cart content
  if (userProfile && (!userProfile.isRegistered || userProfile.status === 'disabled')) {
    const isDisabled = userProfile.status === 'disabled';
    return (
      <div className="min-h-screen bg-[#121212] flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={`w-20 h-20 ${isDisabled ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20'} rounded-full flex items-center justify-center mb-6 border`}
        >
          {isDisabled ? <ShieldAlert className="w-10 h-10 text-red-500" /> : <ShieldAlert className="w-10 h-10 text-amber-500" />}
        </motion.div>
        <h2 className="text-white text-2xl font-bold mb-3 uppercase tracking-tight">
          {isDisabled ? "Account Access Restricted" : "Registration Required"}
        </h2>
        <p className="text-gray-400 max-w-xs mb-8 leading-relaxed text-sm">
          {isDisabled 
            ? "Your account has been restricted by management. You cannot view your cart or place orders at this time." 
            : "You're currently using an unregistered account. Only registered students can place orders with their pre-assigned credits."}
        </p>
        <div className="space-y-4 w-full max-w-[200px]">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/home")}
            className="w-full py-3 bg-[#1E2A38] text-white rounded-xl border border-white/10 font-bold text-sm"
          >
            Back to Menu
          </motion.button>
          <p className={`${isDisabled ? 'text-red-500/50' : 'text-[#FFD54F]/50'} text-[10px] uppercase font-bold tracking-widest`}>
            {isDisabled ? 'Contact Admin for Support' : 'Contact Admin to Register'}
          </p>
        </div>
      </div>
    );
  }

  const walletBalance = userProfile?.walletBalance || 0;
  const totalPrice = cart.reduce((sum: number, item: any) => sum + item.price * item.qty, 0);
  const balanceAfterOrder = walletBalance - totalPrice;

  const updateQuantity = (id: number, delta: number) => {
    setCart((prev: any[]) => {
      return prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.qty + delta;
            return newQty > 0 ? { ...item, qty: newQty } : null;
          }
          return item;
        })
        .filter(Boolean);
    });
  };

  const removeItem = (id: number) => {
    setCart((prev: any[]) => prev.filter((item) => item.id !== id));
  };

  const handleConfirmOrder = async () => {
    if (!user || !userProfile) {
      toast.error("You must be logged in to order.");
      return;
    }

    if (!userProfile.isRegistered || userProfile.status === 'disabled') {
      toast.error(userProfile.status === 'disabled' ? "Account restricted. Cannot place order." : "Only registered students can place orders.");
      return;
    }

    if (cart.length === 0) {
      toast.error("Your cart is empty.");
      return;
    }

    setIsSubmitting(true);

    const currentSlot = await getCurrentSlot();
    if (!currentSlot) {
      toast.error("Mess is currently closed for orders.");
      setIsSubmitting(false);
      return;
    }

    if (balanceAfterOrder < 0) {
      toast.error("Insufficient wallet balance.");
      setIsSubmitting(false);
      return;
    }

    // Rate-limit order placement: max 3 orders per ~100 seconds per session
    if (!tryConsume(ORDER_RATE.key, ORDER_RATE.max, ORDER_RATE.refillMs)) {
      const wait = secondsUntilNextToken(ORDER_RATE.key);
      toast.error(`You're placing orders too fast. Try again in ${wait}s.`);
      setIsSubmitting(false);
      return;
    }

    // Now we already set isSubmitting earlier
    try {
      const { id, orderNumber, estimatedServingWindow } = await orderService.placeOrder(
        user.uid,
        userProfile.rollNo,
        cart,
        totalPrice,
        currentSlot
      );
      
      // Eagerly update local wallet balance in memory Context so UI reflects
      // deduction instantly without requiring a full page refresh
      updateUserProfile({ ...userProfile, walletBalance: balanceAfterOrder });

      toast.success("Order placed successfully!");
      navigate("/order-success", { state: { orderId: id, orderNumber, estimatedServingWindow, cart, totalPrice }, replace: true });
    } catch (error: any) {
      console.error("Order submission failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to place order. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="min-h-screen bg-[#121212]"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-b from-[#1A1A1A] to-[#1A1A1A]/95 backdrop-blur-lg border-b border-white/5 px-4 py-4">
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-[#1E2A38] rounded-full flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </motion.button>
          <h1 className="text-white text-2xl">Your Cart</h1>
        </div>
      </div>

      {/* Cart Items */}
      <div className="p-4 space-y-3 pb-48">
        {cart.length === 0 ? (
          <div className="mt-12">
            <EmptyState
              icon={ShoppingCart}
              title="Your Cart is Empty"
              description="Looks like you haven't added anything yet. Hungry for something delicious?"
              actionLabel="Go to Menu"
              onAction={() => navigate("/home")}
            />
          </div>
        ) : (
          cart.map((item: any, index: number) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-[#1E2A38] rounded-xl p-4 border border-white/10 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-white mb-1">{item.name}</h3>
                  <p className="text-[#FFD54F]">₹{item.price} × {item.qty}</p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => removeItem(item.id)}
                  disabled={isSubmitting}
                  className="w-9 h-9 bg-red-500/20 rounded-full flex items-center justify-center disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </motion.button>
              </div>

              {/* Quantity Controls */}
              <div className="flex items-center gap-3 mt-2 border-t border-white/5 pt-3">
                <motion.button
                  whileTap={!isSubmitting ? { scale: 0.9 } : {}}
                  onClick={() => updateQuantity(item.id, -1)}
                  disabled={isSubmitting}
                  className="w-8 h-8 bg-[#121212] rounded-full flex items-center justify-center disabled:opacity-50"
                >
                  <Minus className="w-4 h-4 text-white" />
                </motion.button>
                <span className="text-white min-w-[2rem] text-center">{item.qty}</span>
                <motion.button
                  whileTap={!isSubmitting ? { scale: 0.9 } : {}}
                  onClick={() => updateQuantity(item.id, 1)}
                  disabled={isSubmitting}
                  className="w-8 h-8 bg-[#FFD54F] rounded-full flex items-center justify-center disabled:opacity-50"
                >
                  <Plus className="w-4 h-4 text-[#121212]" />
                </motion.button>
                <div className="ml-auto">
                  <span className="text-white font-medium">₹{item.price * item.qty}</span>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Bottom Summary - Fixed */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#1A1A1A] to-[#1A1A1A]/95 backdrop-blur-lg border-t border-white/10 p-4 space-y-4">
          {/* Wallet Preview */}
          <div className="bg-[#1E2A38] rounded-xl p-4 border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Total Price</span>
              <span className="text-white">₹{totalPrice}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#FFD54F]" />
                <span className="text-gray-400">Current Credits</span>
              </div>
              <span className="text-white">₹{walletBalance}</span>
            </div>
            <div className="h-px bg-white/10" />
            <div className="flex items-center justify-between">
              <span className="text-white">Remaining Credits</span>
              <motion.span
                animate={{
                  color: balanceAfterOrder < 0 ? "#EF4444" : "#10B981",
                }}
                className="text-lg font-medium"
              >
                ₹{balanceAfterOrder}
              </motion.span>
            </div>
          </div>

          {/* Confirm Button */}
          {!isAdminOnline && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2 mb-2">
               <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
               <p className="text-red-200 text-xs leading-relaxed">
                 The Counter Admin is currently offline. Orders are blocked temporarily to prevent verification gaps. Please wait.
               </p>
            </div>
          )}

          <motion.button
            whileTap={!isSubmitting && balanceAfterOrder >= 0 && isAdminOnline ? { scale: 0.98 } : {}}
            onClick={handleConfirmOrder}
            disabled={balanceAfterOrder < 0 || isSubmitting || !isAdminOnline}
            className={`w-full py-4 rounded-xl transition-all duration-200 flex justify-center items-center gap-2 ${
              balanceAfterOrder < 0 || isSubmitting || !isAdminOnline
                ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-[#FFD54F] to-[#FFE082] text-[#121212] shadow-lg shadow-[#FFD54F]/30"
            }`}
          >
            {isSubmitting ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
            ) : !isAdminOnline ? (
              "Admin Offline (Wait)"
            ) : balanceAfterOrder < 0 ? (
              "Insufficient Credits"
            ) : (
              "Confirm Order"
            )}
          </motion.button>
        </div>
      )}
    </motion.div>
  );
}
