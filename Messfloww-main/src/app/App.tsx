import { RouterProvider } from "react-router";
import { useEffect } from "react";
import { ref, onValue, set, onDisconnect } from "firebase/database";
import { rtdb } from "../core/firebase";
import { router } from "../core/layout/routes";
import { AuthProvider } from "../core/auth/AuthContext";
import { TimeSlotProvider } from "../features/timeslots/TimeSlotContext";
import { OrderProvider } from "../features/kitchen/OrderContext";
import { StudentProvider } from "../features/students/StudentContext";
import { MenuProvider } from "../features/menu/MenuContext";

// MessFlow PWA - College Mess Ordering System
function App() {
  useEffect(() => {
    // Admin Heartbeat (Kill-Switch)
    const connectedRef = ref(rtdb, ".info/connected");
    const adminOnlineRef = ref(rtdb, "system_status/admin_online");

    const unsubscribe = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        // We're connected (or reconnected)! Set presence to true.
        set(adminOnlineRef, true);

        // When I disconnect, update the last time I was seen online
        // and mark myself as offline.
        onDisconnect(adminOnlineRef).set(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthProvider>
      <TimeSlotProvider>
        <MenuProvider>
          <OrderProvider>
            <StudentProvider>
              <RouterProvider router={router} />
            </StudentProvider>
          </OrderProvider>
        </MenuProvider>
      </TimeSlotProvider>
    </AuthProvider>
  );
}

export default App;