import { motion } from "motion/react";
import { Plus, AlertCircle, Info } from "lucide-react";

interface MenuItemProps {
  item: {
    id: number;
    name: string;
    price: number;
    available: boolean;
    stock: "high" | "low" | "out";
    description?: string;
    servingSize?: number;
    quantityUnit?: string;
  };
  onAdd: (item: { id: number; name: string; price: number }) => void;
  isRestricted?: boolean;
  isUnregistered?: boolean;
}

export function MenuItem({ item, onAdd, isRestricted, isUnregistered }: MenuItemProps) {
  const isUnavailable = !item.available || item.stock === "out";
  const finalDisabled = isUnavailable || isRestricted || isUnregistered;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={!finalDisabled ? { y: -2 } : {}}
      transition={{ duration: 0.2 }}
      className={`bg-[#1E2A38] rounded-xl p-4 border transition-all duration-200 ${
        isUnavailable
          ? "border-white/5 opacity-50"
          : isRestricted
          ? "border-red-500/20 opacity-75 bg-red-900/5"
          : isUnregistered
          ? "border-white/10 opacity-75 grayscale-[0.5]"
          : "border-white/10 hover:border-[#FFD54F]/30 hover:shadow-lg hover:shadow-[#FFD54F]/10"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-white mb-1">
            {item.name}
            {item.servingSize && item.quantityUnit && (
              <span className="ml-2 text-xs text-gray-400 font-normal">({item.servingSize} {item.quantityUnit})</span>
            )}
          </h3>
          {item.description && <p className="text-[10px] text-gray-400 mb-1.5 leading-tight line-clamp-2">{item.description}</p>}
          <div className="flex items-center gap-3">
            <span className={`${
              isUnavailable 
                ? 'text-gray-500' 
                : 'text-[#10B981]'
            }`}>₹{item.price}</span>
            {isUnavailable ? (
              <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">Sold Out</span>
            ) : (
              <span className="text-[#10B981] text-xs font-bold uppercase tracking-wider">Available</span>
            )}
            {isRestricted && !isUnavailable && (
              <span className="text-red-500/70 text-[10px] uppercase font-bold flex items-center gap-1 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                <Info className="w-3 h-3" />
                Account Restricted
              </span>
            )}
            {isUnregistered && !isUnavailable && !isRestricted && (
              <span className="text-amber-500/70 text-[10px] uppercase font-bold flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                <Info className="w-3 h-3" />
                Reg Needed
              </span>
            )}
          </div>
        </div>

        <motion.button
          whileTap={!finalDisabled ? { scale: 0.9 } : {}}
          onClick={() => !finalDisabled && onAdd(item)}
          disabled={finalDisabled}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
            finalDisabled
              ? "bg-gray-700 cursor-not-allowed opacity-50"
              : "bg-gradient-to-r from-[#FFD54F] to-[#FFE082] hover:shadow-lg hover:shadow-[#FFD54F]/30"
          }`}
        >
          <Plus className={`w-5 h-5 ${finalDisabled ? "text-gray-500" : "text-[#121212]"}`} />
        </motion.button>
      </div>
    </motion.div>
  );
}