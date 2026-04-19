import { createBrowserRouter } from "react-router";
import { LoginScreen } from "../auth/LoginScreen";
import { HomeScreen } from "../../features/ordering/HomeScreen";
import { CartScreen } from "../../features/ordering/CartScreen";
import { OrderSuccessScreen } from "../../features/orders/OrderSuccessScreen";
import { OrderTrackingScreen } from "../../features/orders/OrderTrackingScreen";
import { ProfileScreen } from "../../features/profile/ProfileScreen";
import { OrderHistoryScreen } from "../../features/orders/OrderHistoryScreen";
import { StaffDashboardScreen } from "../../features/staff/StaffDashboardScreen";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import { ErrorBoundary } from "../ErrorBoundary";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <ErrorBoundary featureName="Login"><LoginScreen /></ErrorBoundary>,
  },
  {
    path: "/home",
    element: <ProtectedRoute><ErrorBoundary featureName="Home"><HomeScreen /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: "/cart",
    element: <ProtectedRoute><ErrorBoundary featureName="Cart"><CartScreen /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: "/order-success",
    element: <ProtectedRoute><ErrorBoundary featureName="Order Success"><OrderSuccessScreen /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: "/order-tracking/:orderId",
    element: <ProtectedRoute><ErrorBoundary featureName="Order Tracking"><OrderTrackingScreen /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: "/profile",
    element: <ProtectedRoute><ErrorBoundary featureName="Profile"><ProfileScreen /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: "/order-history",
    element: <ProtectedRoute><ErrorBoundary featureName="Order History"><OrderHistoryScreen /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: "/staff",
    element: <ProtectedRoute><ErrorBoundary featureName="Staff Dashboard"><StaffDashboardScreen /></ErrorBoundary></ProtectedRoute>,
  },
]);