import { Navigate, Outlet, useLocation } from "react-router";
import { useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { TimeSlotProvider } from "../../features/timeslots/TimeSlotContext";
import { MenuProvider } from "../../features/menu/MenuContext";
import { StudentProvider } from "../../features/students/StudentContext";
import { startAdminHeartbeat } from "@messflow/shared-core";

export function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated) {
      const unsubscribe = startAdminHeartbeat();
      return () => unsubscribe();
    }
  }, [isAuthenticated]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <span className="text-sm text-muted-foreground font-medium">Verifying authorization...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <TimeSlotProvider>
      <MenuProvider>
        <StudentProvider>
          <Outlet />
        </StudentProvider>
      </MenuProvider>
    </TimeSlotProvider>
  );
}
