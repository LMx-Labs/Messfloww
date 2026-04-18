import { motion } from "motion/react";
import { ShoppingCart, ArrowRight } from "lucide-react";

interface CartPreviewProps {
  totalItems: number;
  totalPrice: number;
  onViewCart: () => void;
}

export function CartPreview({ totalItems, totalPrice, onViewCart }: CartPreviewProps) {
  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className="fixed bottom-4 left-4 right-4 z-20"
    >
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onViewCart}
        className="w-full bg-gradient-to-r from-[#FFD54F] to-[#FFE082] rounded-2xl p-5 shadow-2xl shadow-[#FFD54F]/30 flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#121212]/20 rounded-full flex items-center justify-center relative">
            <ShoppingCart className="w-6 h-6 text-[#121212]" />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 w-6 h-6 bg-[#121212] rounded-full flex items-center justify-center text-[#FFD54F] text-xs"
            >
              {totalItems}
            </motion.div>
          </div>
          <div className="text-left">
            <p className="text-[#121212] text-sm">View Cart</p>
            <p className="text-[#121212]">₹{totalPrice}</p>
          </div>
        </div>
        <ArrowRight className="w-6 h-6 text-[#121212]" />
      </motion.button>
    </motion.div>
  );
}
