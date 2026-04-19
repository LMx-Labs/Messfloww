import QRCode from "react-qr-code";
import { generateQRCodeValue } from "../../shared/utils/qrGenerator";
import { useAuth } from "../../core/auth/AuthContext";
import { orderService, OrderDoc } from "../../features/orders/orderService";
import { useEffect, useState } from "react";
import { Loader2, ArrowLeft, Clock, MapPin, CheckCircle2 } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { motion } from "motion/react";

export function OrderTrackingScreen() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const { userProfile } = useAuth();
  
  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [loading, setLoading] = useState(true);
  // We no longer use a live changing timestamp interval.
  // The QR code is a static single-use representation of this exact order.

  // Fetch Order once on mount (No more live status subscription per user request)
  useEffect(() => {
    if (!orderId) return;
    async function loadOrder() {
      try {
        // We fetch the document once. If user wants an update, they can refresh.
        // This fulfills the "remove live order tracking" requirement.
        const activeOrder = await orderService.getActiveOrderById(orderId as string);
        setOrder(activeOrder);
      } catch (err) {
        console.error("Failed to load order", err);
      } finally {
        setLoading(false);
      }
    }
    loadOrder();
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#FFD54F] animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#121212] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
          <Clock className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-white text-2xl font-bold mb-2">Order Not Found</h2>
        <p className="text-gray-400 mb-8">This order may have expired or was completed.</p>
        <button onClick={() => navigate("/home")} className="bg-[#FFD54F] text-[#121212] px-8 py-3 rounded-full font-bold">
          Go Home
        </button>
      </div>
    );
  }

  // Generate a static, one-time use QR code representing the order
  const qrCodeValue = generateQRCodeValue(order.id, new Date(order.createdAt).getTime());

  return (
    <div className="min-h-screen bg-[#121212] flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#1A1A1A]/95 backdrop-blur-lg border-b border-white/5 px-4 py-4">
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate("/home")}
            className="w-10 h-10 bg-[#1E2A38] rounded-full flex items-center justify-center border border-white/5"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </motion.button>
          <div>
            <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest leading-none mb-1">Receipt</p>
            <h1 className="text-white text-lg font-bold leading-none">Order #{order.orderNumber}</h1>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Estimated Serving Window Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-[#1E2A38] to-[#1A2530] rounded-3xl p-6 border border-[#FFD54F]/30 relative overflow-hidden shadow-2xl"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-[#FFD54F]/10 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4 text-[#FFD54F]" />
              </div>
              <span className="text-[#FFD54F] text-sm font-bold uppercase tracking-wider">Estimated Serving Time</span>
            </div>
            
            <h2 className="text-white text-3xl font-black mb-2">{order.estimatedServingWindow}</h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Please present your QR code at the counter during this 3-minute window to collect your meal.
            </p>

            <div className="flex items-center gap-4 mt-6 pt-6 border-t border-white/5">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-500" />
                <span className="text-gray-300 text-xs font-medium">Counter {order.counterNumber}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-gray-500" />
                <span className="text-gray-300 text-xs font-medium">{order.slotName}</span>
              </div>
            </div>
          </div>
          
          {/* Subtle Background Glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFD54F]/5 rounded-full blur-3xl -mr-10 -mt-10" />
        </motion.div>

        {/* QR Code Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#1E2A38] rounded-3xl p-8 border border-white/5 flex flex-col items-center"
        >
          <div className={`bg-white p-5 rounded-2xl mb-6 shadow-xl ${order.qrUsed ? 'opacity-30 grayscale' : 'opacity-100'}`}>
            <QRCode value={qrCodeValue} size={200} level="H" />
          </div>
          
          <div className="text-center">
            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-xs uppercase tracking-widest ${
              order.qrUsed 
                ? "bg-gray-500/10 text-gray-500" 
                : "bg-[#10B981]/10 text-[#10B981]"
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${order.qrUsed ? "bg-gray-500" : "bg-[#10B981] animate-pulse"}`} />
              {order.qrUsed ? "Order Redeemed" : "Ready for Collection"}
            </div>
            <p className="text-gray-500 text-[10px] mt-4 max-w-[200px] mx-auto">
              Scan this code at the counter to confirm your pickup.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}