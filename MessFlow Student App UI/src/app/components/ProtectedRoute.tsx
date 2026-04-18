import { Navigate, useLocation } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { motion } from "motion/react";
import { Zap } from "lucide-react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FFD54F] to-[#FFE082] flex items-center justify-center"
        >
          <Zap className="w-8 h-8 text-[#121212]" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    // Redirect them to the /login page, but save the current location they were
    // trying to go to when they were redirected. This allows us to send them
    // along to that page after they login, which is a nicer user experience
    // than dropping them off on the home page.
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
