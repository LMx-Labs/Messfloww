import { WifiOff, AlertCircle } from "lucide-react";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { motion, AnimatePresence } from "motion/react";

export function OfflineIndicator() {
  const isOnline = useNetworkStatus();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 flex items-center justify-center gap-2 sticky top-0 z-[60] backdrop-blur-md"
        >
          <WifiOff className="w-4 h-4 text-red-500" />
          <span className="text-red-500 text-[11px] font-bold uppercase tracking-widest">
            Offline Mode: You are viewing cached data
          </span>
          <AlertCircle className="w-3 h-3 text-red-500/50" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
