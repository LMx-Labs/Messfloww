import { createContext, useContext } from "react";

const AuthContext = createContext({
  user: { uid: "kitchen_user", email: "kitchen@messflow.local" },
  loading: false,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider value={{ user: { uid: "kitchen_user", email: "kitchen@messflow.local" }, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
}
