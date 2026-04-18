import { RouterProvider } from "react-router";
import { router } from "../core/layout/routes";
import { AuthProvider } from "../core/auth/AuthContext";
import { TimeSlotProvider } from "../features/timeslots/TimeSlotContext";
import { OrderProvider } from "../features/kitchen/OrderContext";
import { StudentProvider } from "../features/students/StudentContext";
import { MenuProvider } from "../features/menu/MenuContext";

// MessFlow PWA - College Mess Ordering System
function App() {
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