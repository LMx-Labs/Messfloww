import { motion } from "motion/react";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  illustration?: React.ReactNode;
}

export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  actionLabel, 
  onAction,
  illustration 
}: EmptyStateProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, type: "spring" }}
      className="flex flex-col items-center justify-center p-8 bg-[#1A1A1A] rounded-3xl border border-white/5 relative overflow-hidden"
    >
      {/* Dynamic Background Glow */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#FFD54F]/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl" />
      
      {/* Icon/Illustration Area */}
      <motion.div 
        animate={{ 
          y: [0, -8, 0],
          rotate: [0, -2, 2, 0]
        }}
        transition={{ 
          duration: 5, 
          repeat: Infinity, 
          ease: "easeInOut" 
        }}
        className="relative mb-6"
      >
        <div className="w-24 h-24 bg-gradient-to-br from-[#2A2A2A] to-[#1E1E1E] rounded-full flex items-center justify-center border border-white/10 shadow-2xl relative z-10">
          <Icon className="w-12 h-12 text-[#FFD54F]" />
        </div>
        
        {/* Soft Shadow/Glow underneath */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-3 bg-[#FFD54F]/20 rounded-full blur-md" />
        
        {illustration}
      </motion.div>

      <h3 className="text-xl font-semibold text-white mb-2 text-center">{title}</h3>
      <p className="text-gray-400 text-center text-sm mb-8 leading-relaxed max-w-[240px]">
        {description}
      </p>

      {actionLabel && onAction && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onAction}
          className="px-8 py-3.5 bg-gradient-to-r from-[#FFD54F] to-[#FFE082] rounded-2xl text-[#121212] font-semibold shadow-lg shadow-[#FFD54F]/20 transition-all"
        >
          {actionLabel}
        </motion.button>
      )}
    </motion.div>
  );
}
