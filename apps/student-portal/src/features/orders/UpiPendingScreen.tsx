import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { motion } from "motion/react";
import { Clock, MapPin, ChevronRight, Ban, Loader2 } from "lucide-react";
import QRCode from "react-qr-code";
import { generateQRCodeValue } from "../../shared/utils/qrGenerator";
import { orderService, OrderDoc } from "../../features/orders/orderService";
import { rtdb } from "@messflow/shared-core";
import { ref, remove, runTransaction } from "firebase/database";
import { toast } from "sonner";

export function UpiPendingScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { orderId, orderNumber, cart, totalPrice } = location.state || { orderId: "", orderNumber: 0, cart: [], totalPrice: 0 };
  
  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // The QR is static for the session, capturing the moment of order placement.
  const [fixedTime] = useState(Date.now());
  const qrCodeValue = generateQRCodeValue(orderId, fixedTime);

  useEffect(() => {
    if (!orderId) return;
    const unsubscribe = orderService.subscribeToOrder(orderId, (updatedOrder) => {
      setOrder(updatedOrder);
      if (updatedOrder && updatedOrder.paymentStatus === 'PAID') {
        toast.success("Payment Confirmed!");
        navigate("/order-success", { state: { orderId, orderNumber, cart, totalPrice }, replace: true });
      }
    });
    return () => unsubscribe();
  }, [orderId, navigate, orderNumber, cart, totalPrice]);

  const handleCancelOrder = async () => {
    if (!orderId || isCancelling) return;
    setIsCancelling(true);
    
    try {
      // Restore stock by running reverse transaction
      for (const item of cart) {
        const stockRef = ref(rtdb, `menu_stock/${item.id}`);
        await runTransaction(stockRef, (data: any) => {
          if (data) {
            data.stock = (data.stock || 0) + item.qty;
            if (data.stock > (data.minStock || 0)) data.available = true;
          }
          return data;
        });
      }
      // Remove order
      await remove(ref(rtdb, `active_orders/${orderId}`));
      toast.success("Order cancelled successfully.");
      navigate("/home", { replace: true });
    } catch (error) {
      console.error("Failed to cancel order:", error);
      toast.error("Failed to cancel order.");
      setIsCancelling(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4 overflow-hidden relative">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#FFD54F]/5 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md text-center relative z-10"
      >
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 12 }}
          className="mb-8 flex justify-center"
        >
          <div className="w-24 h-24 bg-gradient-to-br from-[#1E2A38] to-[#1A2530] border-2 border-[#FFD54F]/30 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-[#FFD54F]/10">
            <Clock className="w-12 h-12 text-[#FFD54F] animate-pulse" />
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl text-white font-black mb-2"
        >
          Awaiting Payment
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-gray-400 font-medium mb-6 text-sm px-4"
        >
          Show this QR code at the counter to confirm your UPI payment for Order <span className="text-[#FFD54F] font-bold">#{orderNumber}</span>.
        </motion.p>

        {/* QR & Info Row */}
        <div className="grid grid-cols-1 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-[#1E2A38] p-8 rounded-3xl border border-white/10 flex flex-col items-center"
          >
            <div className="bg-white p-3 rounded-2xl mb-4">
              <QRCode value={qrCodeValue} size={180} level="H" />
            </div>
            <span className="text-white text-xs font-bold uppercase tracking-wider">Pickup Code</span>
            <div className="mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-[#FFD54F]/10 border border-[#FFD54F]/20 rounded-full">
              <Loader2 className="w-4 h-4 text-[#FFD54F] animate-spin" />
              <span className="text-[#FFD54F] text-[10px] font-bold uppercase tracking-widest">Waiting for staff</span>
            </div>
          </motion.div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col items-center gap-4">
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            onClick={handleCancelOrder}
            disabled={isCancelling}
            className="flex items-center gap-2 px-6 py-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            {isCancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
            Cancel Order
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
