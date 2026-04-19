import { createContext, useContext } from "react";

// For the kiosk, we assume the device is physically secured and network-auth is handled at OS level or bypass it locally.
const AuthContext = createContext({
  user: { uid: "kiosk_user", email: "kiosk@messflow.local" },
  loading: false,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider value={{ user: { uid: "kiosk_user", email: "kiosk@messflow.local" }, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
}
