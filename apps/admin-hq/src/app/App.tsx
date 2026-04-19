import { RouterProvider } from "react-router";
import { useEffect } from "react";
import { startAdminHeartbeat } from "@messflow/shared-core";
import { router } from "../core/layout/routes";
import { AuthProvider } from "../core/auth/AuthContext";
import { TimeSlotProvider } from "../features/timeslots/TimeSlotContext";
import { StudentProvider } from "../features/students/StudentContext";
import { MenuProvider } from "../features/menu/MenuContext";

// MessFlow PWA - College Mess Ordering System
function App() {
  useEffect(() => {
    // Admin Heartbeat (Kill-Switch) via shared-core
    const unsubscribe = startAdminHeartbeat();
    return () => unsubscribe();
  }, []);

  return (
    <AuthProvider>
      <TimeSlotProvider>
        <MenuProvider>
          <StudentProvider>
            <RouterProvider router={router} />
          </StudentProvider>
        </MenuProvider>
      </TimeSlotProvider>
    </AuthProvider>
  );
}

export default App;