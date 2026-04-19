import { LucideIcon } from "lucide-react";
import { motion } from "motion/react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center p-12 text-center bg-card rounded-2xl border-2 border-dashed border-border"
    >
      <div className="p-6 rounded-full bg-muted mb-6">
        <Icon className="h-12 w-12 text-muted-foreground opacity-50" />
      </div>
      
      <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-sm mb-8">
        {description}
      </p>

      {action && (
        <button
          onClick={action.onClick}
          className="bg-primary hover:bg-secondary text-primary-foreground px-6 py-3 rounded-xl font-bold transition-all shadow-md active:scale-95"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}
