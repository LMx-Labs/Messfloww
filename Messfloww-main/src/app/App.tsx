import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "./context/AuthContext";
import { TimeSlotProvider } from "./context/TimeSlotContext";
import { OrderProvider } from "./context/OrderContext";
import { StudentProvider } from "./context/StudentContext";
import { MenuProvider } from "./context/MenuContext";

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