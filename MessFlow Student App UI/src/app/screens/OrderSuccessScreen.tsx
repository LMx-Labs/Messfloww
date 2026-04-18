import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { motion } from "motion/react";
import { CheckCircle2, Clock, MapPin, ChevronRight } from "lucide-react";
import QRCode from "react-qr-code";
import { generateQRCodeValue } from "../utils/qrGenerator";
import { useAuth } from "../contexts/AuthContext";
import confetti from "canvas-confetti";

export function OrderSuccessScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { orderId, orderNumber, estimatedServingWindow } = location.state || { orderId: "", orderNumber: 0, estimatedServingWindow: "" };
  
  const { userProfile } = useAuth();
  
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const qrCodeValue = generateQRCodeValue(orderId, currentTime);

  useEffect(() => {
    // Fire confetti!
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#FFD54F", "#FFE082", "#10B981"]
    });

    // Auto navigate to tracking after 6 seconds
    const timer = setTimeout(() => {
      navigate(`/order-tracking/${orderId}`);
    }, 6000);

    return () => clearTimeout(timer);
  }, [orderId, navigate]);

  return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4 overflow-hidden relative">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#FFD54F]/5 rounded-full blur-[100px]" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-[#10B981]/5 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md text-center relative z-10"
      >
        {/* Success Icon */}
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 12 }}
          className="mb-8 flex justify-center"
        >
          <div className="w-24 h-24 bg-gradient-to-br from-[#10B981] to-[#059669] rounded-[2rem] flex items-center justify-center shadow-2xl shadow-[#10B981]/20">
            <CheckCircle2 className="w-12 h-12 text-white" />
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl text-white font-black mb-2"
        >
          Success!
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-gray-500 font-medium mb-10"
        >
          Your order <span className="text-[#FFD54F]">#{orderNumber}</span> is being prepared.
        </motion.p>

        {/* Estimated Time Card (Hero of this change) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-[#1E2A38] to-[#1A2530] rounded-[2.5rem] p-8 border border-[#FFD54F]/20 shadow-2xl mb-8 group"
        >
          <div className="flex flex-col items-center">
            <div className="px-4 py-1 bg-[#FFD54F]/10 rounded-full border border-[#FFD54F]/20 mb-4">
              <span className="text-[#FFD54F] text-[10px] font-black uppercase tracking-[0.2em]">Estimated Pickup</span>
            </div>
            <h2 className="text-white text-3xl font-black mb-3">{estimatedServingWindow}</h2>
            <div className="flex items-center gap-2 text-gray-500 text-[11px] font-medium">
              <Clock className="w-3.5 h-3.5" />
              <span>3-minute serving window</span>
            </div>
          </div>
        </motion.div>

        {/* QR & Info Row */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-[#1E2A38] p-4 rounded-3xl border border-white/5 flex flex-col items-center"
          >
            <div className="bg-white p-2 rounded-xl mb-3">
              <QRCode value={qrCodeValue} size={80} level="M" />
            </div>
            <span className="text-white text-[10px] font-bold uppercase tracking-wider">Your Code</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-[#1E2A38] p-4 rounded-3xl border border-white/5 flex flex-col items-center justify-center text-center"
          >
            <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center mb-2">
              <MapPin className="w-5 h-5 text-[#FFD54F]" />
            </div>
            <span className="text-white text-[10px] font-bold uppercase tracking-wider mb-1">Counter 1</span>
            <span className="text-gray-500 text-[9px]">T-Block Mess</span>
          </motion.div>
        </div>

        {/* Footer Link */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          onClick={() => navigate(`/order-tracking/${orderId}`)}
          className="flex items-center gap-2 text-[#FFD54F] text-xs font-bold uppercase tracking-widest mx-auto group"
        >
          View Tracking Details <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </motion.button>
      </motion.div>
    </div>
  );
}