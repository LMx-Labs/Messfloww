import QRCode from "react-qr-code";
import { generateQRCodeValue } from "@messflow/shared-core";
import { useAuth } from "../../core/auth/AuthContext";
import { orderService, OrderDoc } from "../../features/orders/orderService";
import { useEffect, useState } from "react";
import { Loader2, ArrowLeft, Clock, MapPin, CheckCircle2, ChefHat, ScanBarcode, PackageCheck } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";

const STAGES = [
  { id: "pending", label: "Pending Scan", icon: ScanBarcode },
  { id: "processing", label: "In Kitchen", icon: ChefHat },
  { id: "ready", label: "Ready", icon: PackageCheck },
  { id: "collected", label: "Collected", icon: CheckCircle2 }
];

export function OrderTrackingScreen() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const { userProfile } = useAuth();
  
  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasFiredConfetti, setHasFiredConfetti] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    
    // Use real-time subscription
    const unsubscribe = orderService.subscribeToOrder(orderId, (activeOrder) => {
      setOrder(activeOrder);
      setLoading(false);
      
      if (activeOrder && (activeOrder.status === 'collected' || activeOrder.qrUsed) && !hasFiredConfetti) {
        setHasFiredConfetti(true);
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#FFD54F", "#FFE082", "#10B981"]
        });
      }
    });

    return () => unsubscribe();
  }, [orderId, hasFiredConfetti]);

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

  // Map order status to stepper stage
  let currentStageIdx = 0;
  if (order.status === "ordered" || order.status === "pending") currentStageIdx = 0;
  if (order.status === "processing" || order.status === "preparing") currentStageIdx = 1;
  if (order.status === "ready") currentStageIdx = 2;
  if (order.status === "collected" || order.status === "completed" || order.qrUsed) currentStageIdx = 3;

  const isCollected = currentStageIdx === 3;
  const qrCodeValue = generateQRCodeValue(order.id);

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
            <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest leading-none mb-1">Live Tracking</p>
            <h1 className="text-white text-lg font-bold leading-none">Order #{order.orderNumber}</h1>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Status Stepper */}
        <div className="bg-[#1E2A38] rounded-3xl p-6 border border-white/5">
          <h3 className="text-white font-bold mb-6 text-sm uppercase tracking-wider">Order Status</h3>
          <div className="relative">
            <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-white/5" />
            <div className="space-y-6 relative">
              {STAGES.map((stage, idx) => {
                const isActive = idx === currentStageIdx;
                const isPast = idx < currentStageIdx;
                const Icon = stage.icon;
                
                let iconColor = "text-gray-500";
                let bgColor = "bg-[#121212] border-white/10";
                
                if (isPast) {
                  iconColor = "text-[#10B981]";
                  bgColor = "bg-[#10B981]/10 border-[#10B981]/30";
                } else if (isActive) {
                  iconColor = "text-[#FFD54F]";
                  bgColor = "bg-[#FFD54F]/20 border-[#FFD54F]/50";
                }

                return (
                  <div key={stage.id} className="flex items-center gap-4 relative z-10">
                    <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center ${bgColor} ${isActive ? 'shadow-[0_0_15px_rgba(255,213,79,0.3)]' : ''}`}>
                      <Icon className={`w-5 h-5 ${iconColor}`} />
                    </div>
                    <div className="flex-1">
                      <h4 className={`font-bold ${isActive ? 'text-white' : isPast ? 'text-gray-300' : 'text-gray-600'}`}>
                        {stage.label}
                      </h4>
                      {isActive && (
                        <motion.p 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="text-[#FFD54F] text-[10px] uppercase font-bold tracking-widest mt-1 animate-pulse"
                        >
                          Current Phase
                        </motion.p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <AnimatePresence mode="popLayout">
          {isCollected ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-br from-[#10B981]/20 to-[#059669]/20 rounded-3xl p-8 border border-[#10B981]/30 text-center shadow-xl shadow-[#10B981]/10"
            >
              <div className="w-20 h-20 bg-[#10B981] rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#10B981]/30">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-white text-2xl font-black mb-2">Order Collected!</h2>
              <p className="text-[#10B981] font-medium text-sm">Enjoy your meal.</p>
              <button onClick={() => navigate("/home")} className="mt-6 w-full bg-white text-[#121212] py-4 rounded-xl font-bold">
                Back to Home
              </button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-gradient-to-br from-[#1E2A38] to-[#1A2530] rounded-3xl p-6 border border-[#FFD54F]/30 relative overflow-hidden shadow-2xl"
            >
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-[#FFD54F]/10 rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 text-[#FFD54F]" />
                  </div>
                  <span className="text-[#FFD54F] text-sm font-bold uppercase tracking-wider">Serving Time</span>
                </div>
                
                <h2 className="text-white text-3xl font-black mb-2">{order.estimatedServingWindow}</h2>
                <p className="text-gray-400 text-sm leading-relaxed mb-6">
                  Present your QR code at the counter during this window.
                </p>

                <div className="bg-white p-5 rounded-2xl mb-6 shadow-xl flex justify-center">
                  <QRCode value={qrCodeValue} size={200} level="H" />
                </div>
                
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-xs uppercase tracking-widest bg-[#10B981]/10 text-[#10B981]">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                    Active Code
                  </div>
                </div>

                <div className="flex justify-between mt-6 pt-6 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-300 text-xs font-medium">Counter {order.counterNumber || 1}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-300 text-xs font-medium">{order.slotName}</span>
                  </div>
                </div>
              </div>
              
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFD54F]/5 rounded-full blur-3xl -mr-10 -mt-10" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}