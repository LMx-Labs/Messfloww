import { Navigate, Outlet } from "react-router";
import { useAuth } from "../../core/auth/AuthContext";

export function AdminGate() {
  const { role } = useAuth();

  // Non-managers should never see this or its contents
  if (role !== "manager") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
