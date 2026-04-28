import { useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { motion } from "motion/react";
import { Zap } from "lucide-react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@messflow/shared-core";
import { toast } from "sonner";

export function LoginScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  // Support redirecting back to intended page after login
  const from = location.state?.from?.pathname || "/home";

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      navigate(from, { replace: true });
    } catch (error: any) {
      console.error("Login Error:", error);
      // Don't show toast if user cancels the popup
      if (error.code !== 'auth/popup-closed-by-user') {
        toast.error("Failed to sign in with Google. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-[#121212] via-[#1A1A1A] to-[#1E2A38]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#FFD54F] to-[#FFE082] mb-4"
          >
            <Zap className="w-8 h-8 text-[#121212]" />
          </motion.div>
          <h1 className="text-4xl mb-2 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            Messfloww
          </h1>
          <p className="text-gray-400 font-medium">Fast. Reliable. Simple.</p>
        </div>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="bg-[#1E2A38]/80 backdrop-blur-sm rounded-3xl p-10 shadow-2xl border border-white/5 text-center"
        >
          <h2 className="text-white text-xl font-medium mb-6">Student Login</h2>
          <p className="text-gray-400 text-sm mb-6 leading-relaxed">
            Sign in with your account to access Messfloww and place orders.
          </p>


          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full h-14 bg-white text-[#121212] rounded-2xl shadow-xl hover:bg-gray-100 transition-all duration-200 disabled:opacity-50 font-bold flex items-center justify-center gap-4 border-2 border-white/10"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-[#121212] border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12.48 10.92v3.28h4.78c-.2 1.06-.9 1.96-1.9 2.56v2.12h3.08c1.8-1.66 2.84-4.1 2.84-7.04 0-.46-.04-.9-.12-1.32H12.48z"
                  />
                  <path
                    fill="#4285F4"
                    d="M12.48 10.92v3.28h4.78c-.2 1.06-.9 1.96-1.9 2.56v2.12h3.08c1.8-1.66 2.84-4.1 2.84-7.04 0-.46-.04-.9-.12-1.32H12.48z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#34A853"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  />
                </svg>
                <span className="text-lg">Continue with Google</span>
              </>
            )}
          </motion.button>

          <p className="mt-8 text-gray-500 text-[10px] uppercase tracking-widest font-bold opacity-50">
            Secure College Access
          </p>
        </motion.div>

        <p className="text-center text-gray-500 text-sm mt-8">
          Order in under 10 seconds
        </p>
      </motion.div>
    </div>
  );
}
