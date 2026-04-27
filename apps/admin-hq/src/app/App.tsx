import { RouterProvider } from "react-router";
import { useEffect } from "react";
import { startAdminHeartbeat } from "@messflow/shared-core";
import { router } from "../core/layout/routes";
import { AuthProvider, useAuth } from "../core/auth/AuthContext";
import { TimeSlotProvider } from "../features/timeslots/TimeSlotContext";
import { StudentProvider } from "../features/students/StudentContext";
import { MenuProvider } from "../features/menu/MenuContext";

function AuthenticatedProviders({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  
  useEffect(() => {
    if (isAuthenticated) {
      const unsubscribe = startAdminHeartbeat();
      return () => unsubscribe();
    }
  }, [isAuthenticated]);

  return (
    <>
      {isAuthenticated ? (
        <TimeSlotProvider>
          <MenuProvider>
            <StudentProvider>
              {children}
            </StudentProvider>
          </MenuProvider>
        </TimeSlotProvider>
      ) : (
        children
      )}
    </>
  );
}

// MessFlow PWA - College Mess Ordering System
function App() {
  return (
    <AuthProvider>
      <AuthenticatedProviders>
        <RouterProvider router={router} />
      </AuthenticatedProviders>
    </AuthProvider>
  );
}

export default App;