import { RouterProvider } from "react-router";
import { router } from "../core/layout/routes";
import { AuthProvider } from "../core/auth/AuthContext";

// MessFlow PWA - College Mess Ordering System
function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

export default App;