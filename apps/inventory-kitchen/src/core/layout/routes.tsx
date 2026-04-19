import { createBrowserRouter, Navigate } from "react-router";
import { LiveOrdersPage } from "../../features/orders/LiveOrdersPage";
import { KitchenDisplayPage } from "../../features/kds/KitchenDisplayPage";
import { KOTControlCenterPage } from "../../features/kot/KOTControlCenterPage";
import { CounterListenerPage } from "../../features/counter/CounterListenerPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/dashboard" replace />
  },
  {
    path: "/dashboard",
    element: <LiveOrdersPage />
  },
  {
    path: "/kds",
    element: <KitchenDisplayPage />
  },
  {
    path: "/kot",
    element: <KOTControlCenterPage />
  },
  {
    path: "/counter",
    element: <CounterListenerPage />
  }
]);
