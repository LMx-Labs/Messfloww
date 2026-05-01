import { createContext, useContext, useEffect, useState } from "react";
import { signInAnonymously, onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@messflow/shared-core";

interface KioskAuthContext {
  user: { uid: string; email: string } | null;
  loading: boolean;
}

const AuthContext = createContext<KioskAuthContext>({
  user: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ uid: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        setUser({ uid: firebaseUser.uid, email: firebaseUser.email || "kiosk@messflow.local" });
        setLoading(false);
      } else {
        // No user — sign in anonymously to get a valid auth token for RTDB/Firestore access
        try {
          await signInAnonymously(auth);
          // onAuthStateChanged will fire again with the new user
        } catch (err) {
          console.error("[Kiosk] Anonymous sign-in failed:", err);
          // Fallback to a fake user so the UI doesn't break, but RTDB calls will fail
          setUser({ uid: "kiosk_user", email: "kiosk@messflow.local" });
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
