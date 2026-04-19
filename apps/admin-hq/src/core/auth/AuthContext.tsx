import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser 
} from "firebase/auth";
import { auth } from "@messflow/shared-core";
import { fetchRoles } from "../../features/settings/settingsService";
import { checkLoginRateLimit, recordFailedLoginAttempt, resetLoginRateLimit } from "../../app/utils/rateLimiter";

interface AuthContextType {
  isAuthenticated: boolean;
  user: FirebaseUser | null;
  role: "manager" | "staff" | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  adminUnlocked: boolean;
  unlockAdmin: () => void;
  lockAdmin: () => void;
  updateAdminActivity: () => void;
  setRoleOverride: (role: "manager" | "staff") => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [role, setRole] = useState<"manager" | "staff" | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Admin Gate State
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const ADMIN_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser?.email) {
        try {
          const rolesConfig = await fetchRoles();
          const email = firebaseUser.email.toLowerCase();
          
          if (rolesConfig) {
            const authorizedAdmins = (rolesConfig.authorized_admins || []).map((e: string) => e.toLowerCase());
            
            // Critical Authorization Check:
            // 1. Hardcoded Super Admins (Lakshya + Me/Support)
            // 2. Whitelisted Admins (authorized_admins array)
            // 3. Current Manager/Staff emails from config
            const isAuthorized = 
              email === "lakshya.pms@gmail.com" || 
              email === "samnagar@gmail.com" ||
              authorizedAdmins.includes(email) ||
              email === (rolesConfig.manager_email?.toLowerCase() || "") ||
              email === (rolesConfig.staff_email?.toLowerCase() || "");

            if (!isAuthorized) {
              console.warn("Blocking unauthorized access attempt to Admin Portal:", email);
              await signOut(auth);
              setUser(null);
              setRole(null);
              setLoading(false);
              return;
            }

            // Assign role based on config
            if (email === "lakshya.pms@gmail.com" || email === (rolesConfig.manager_email?.toLowerCase() || "")) {
              setRole("manager");
            } else {
              setRole("staff");
            }
          } else {
            // First time setup fallback
            if (email === "lakshya.pms@gmail.com") {
              setRole("manager");
            } else {
              await signOut(auth);
              setUser(null);
              setRole(null);
              setLoading(false);
              return;
            }
          }
          
          setUser(firebaseUser);
        } catch (e) {
          console.error("Auth check failed:", e);
          await signOut(auth);
          setUser(null);
          setRole(null);
        }
      } else {
        setUser(null);
        setRole(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const rateLimit = checkLoginRateLimit();
    if (!rateLimit.allowed) {
      return { success: false, error: `Too many attempts. Try again in ${rateLimit.remainingSeconds}s` };
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      resetLoginRateLimit();
      return { success: true };
    } catch (e: any) {
      console.error("Login failed", e);
      recordFailedLoginAttempt();
      
      const newRateLimit = checkLoginRateLimit();
      if (!newRateLimit.allowed) {
         return { success: false, error: `Account locked. Try again in ${newRateLimit.remainingSeconds}s` };
      }

      let errorMsg = "Invalid email or password";
      if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password') {
        errorMsg = "Incorrect email or password";
      } else if (e.code === 'auth/too-many-requests') {
        errorMsg = "Too many failed attempts. Please try again later.";
      } else if (e.code === 'auth/invalid-email') {
        errorMsg = "Please enter a valid email address";
      }
      return { success: false, error: errorMsg };
    }
  };

  const logout = async () => {
    setAdminUnlocked(false);
    await signOut(auth);
  };

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      resetLoginRateLimit();
      return { success: true };
    } catch (e: any) {
      console.error("Google login failed", e);
      return { success: false, error: e.message || "Google login failed" };
    }
  };

  const unlockAdmin = () => {
    setAdminUnlocked(true);
    setLastActivity(Date.now());
  };

  const lockAdmin = () => {
    setAdminUnlocked(false);
  };

  const updateAdminActivity = () => {
    if (adminUnlocked) {
      setLastActivity(Date.now());
    }
  };

  const setRoleOverride = (newRole: "manager" | "staff") => {
    setRole(newRole);
  };

  // Inactivity checker
  useEffect(() => {
    if (!adminUnlocked) return;

    const interval = setInterval(() => {
      if (Date.now() - lastActivity > ADMIN_TIMEOUT_MS) {
        lockAdmin();
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [adminUnlocked, lastActivity]);

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated: !!user, 
      user, 
      role, 
      loading, 
      login, 
      loginWithGoogle,
      logout,
      adminUnlocked,
      unlockAdmin,
      lockAdmin,
      updateAdminActivity,
      setRoleOverride
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
