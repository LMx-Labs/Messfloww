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
        // No user — try to sign in anonymously
        try {
          await signInAnonymously(auth);
        } catch (err) {
          console.error("[Kiosk] Anonymous auth failed:", err);
          // Don't set a fake user. Let it fail so we don't bypass security checks with a fake object.
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
