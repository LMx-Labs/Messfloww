import { useState, useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { Lock, AlertCircle, ShieldCheck } from "lucide-react";
import { useAuth } from "../../core/auth/AuthContext";
import { motion } from "motion/react";

// The SHA-256 hash of the master password (hardcoded)
export const MASTER_HASH = "48290cf691c41cbc99b2396d2e5313ccfba91987b384e6d8f08b951fa5045e83";

// Simple SHA-256 computation using Web Crypto API
export async function computeSHA256(text: string) {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export function AdminGate() {
  const { role, adminUnlocked, unlockAdmin, updateAdminActivity } = useAuth();
  const location = useLocation();

  const [passwordInput, setPasswordInput] = useState("");
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);

  // Interaction tracking for auto-lock timeout
  useEffect(() => {
    if (!adminUnlocked) return;

    const handleActivity = () => updateAdminActivity();
    
    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("click", handleActivity);
    window.addEventListener("scroll", handleActivity);

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("scroll", handleActivity);
    };
  }, [adminUnlocked, updateAdminActivity]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutTimer > 0) {
      const timer = setTimeout(() => setLockoutTimer((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (lockoutTimer === 0 && attempts >= 3) {
      // Reset attempts after lockout period
      setAttempts(0);
    }
  }, [lockoutTimer, attempts]);

  // Non-managers should never see this or its contents
  if (role !== "manager") {
    return <Navigate to="/" replace />;
  }

  // If unlocked, render the protected children
  if (adminUnlocked) {
    return <Outlet />;
  }

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutTimer > 0) return;

    if (!passwordInput) {
      setError("Please enter the master password");
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      const hash = await computeSHA256(passwordInput);
      
      if (hash === MASTER_HASH) {
        setAttempts(0);
        setPasswordInput("");
        unlockAdmin();
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setPasswordInput("");
        
        if (newAttempts >= 3) {
          setLockoutTimer(60); // 60 seconds lockout
          setError("Too many failed attempts. Locked out for 60 seconds.");
        } else {
          setError(`Incorrect password. ${3 - newAttempts} attempts remaining.`);
        }
      }
    } catch (err) {
      console.error("Hashing failed", err);
      setError("An error occurred during verification.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Numpad handler for easy digit entry
  const handleNumpad = (digit: string) => {
    if (lockoutTimer > 0) return;
    setPasswordInput((prev) => prev + digit);
  };

  const handleBackspace = () => {
    if (lockoutTimer > 0) return;
    setPasswordInput((prev) => prev.slice(0, -1));
  };

  // The Lock Screen UI
  return (
    <div className="flex-1 h-full w-full flex flex-col items-center justify-center -mt-10">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-md w-full bg-card border border-border rounded-3xl p-8 shadow-2xl"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Admin Access Locked</h2>
          <p className="text-muted-foreground text-center mt-2 text-sm leading-relaxed">
            This section contains sensitive management controls. Please enter the master PIN to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="relative mb-6">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              disabled={lockoutTimer > 0 || isVerifying}
              placeholder="Enter Master PIN"
              className="w-full pl-12 pr-4 py-4 bg-input-background border border-border rounded-xl text-center text-2xl tracking-[0.5em] text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              autoFocus
            />
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-lg mb-6 text-sm"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          <div className="grid grid-cols-3 gap-3 mb-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleNumpad(num.toString())}
                disabled={lockoutTimer > 0 || isVerifying}
                className="py-4 text-xl font-semibold bg-muted hover:bg-muted/80 rounded-xl transition-colors disabled:opacity-50"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              disabled={lockoutTimer > 0 || isVerifying}
              className="py-4 text-xl font-semibold bg-muted/50 rounded-xl transition-colors disabled:opacity-50"
            >
              {/* empty spot */}
            </button>
            <button
              type="button"
              onClick={() => handleNumpad("0")}
              disabled={lockoutTimer > 0 || isVerifying}
              className="py-4 text-xl font-semibold bg-muted hover:bg-muted/80 rounded-xl transition-colors disabled:opacity-50"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              disabled={lockoutTimer > 0 || isVerifying || passwordInput.length === 0}
              className="py-4 text-xl font-semibold bg-muted/50 hover:bg-muted hover:text-destructive rounded-xl transition-colors disabled:opacity-50 flex justify-center items-center"
            >
              ⌫
            </button>
          </div>

          <button
            type="submit"
            disabled={lockoutTimer > 0 || isVerifying || passwordInput.length === 0}
            className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-xl shadow hover:bg-primary/90 transition-colors disabled:opacity-50 flex justify-center items-center"
          >
            {isVerifying ? (
              <div className="h-6 w-6 border-2 border-primary-foreground border-t-transparent animate-spin rounded-full" />
            ) : lockoutTimer > 0 ? (
              `Locked (${lockoutTimer}s)`
            ) : (
              "Unlock"
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
