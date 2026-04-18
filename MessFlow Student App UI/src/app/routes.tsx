import { createBrowserRouter } from "react-router";
import { LoginScreen } from "./screens/LoginScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { CartScreen } from "./screens/CartScreen";
import { OrderSuccessScreen } from "./screens/OrderSuccessScreen";
import { OrderTrackingScreen } from "./screens/OrderTrackingScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { OrderHistoryScreen } from "./screens/OrderHistoryScreen";
import { StaffDashboardScreen } from "./screens/StaffDashboardScreen";
import { ProtectedRoute } from "./components/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: LoginScreen,
  },
  {
    path: "/home",
    element: <ProtectedRoute><HomeScreen /></ProtectedRoute>,
  },
  {
    path: "/cart",
    element: <ProtectedRoute><CartScreen /></ProtectedRoute>,
  },
  {
    path: "/order-success",
    element: <ProtectedRoute><OrderSuccessScreen /></ProtectedRoute>,
  },
  {
    path: "/order-tracking/:orderId",
    element: <ProtectedRoute><OrderTrackingScreen /></ProtectedRoute>,
  },
  {
    path: "/profile",
    element: <ProtectedRoute><ProfileScreen /></ProtectedRoute>,
  },
  {
    path: "/order-history",
    element: <ProtectedRoute><OrderHistoryScreen /></ProtectedRoute>,
  },
  {
    path: "/staff",
    element: <ProtectedRoute><StaffDashboardScreen /></ProtectedRoute>,
  },
]);