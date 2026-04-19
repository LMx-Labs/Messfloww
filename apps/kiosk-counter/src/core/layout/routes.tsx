import { createBrowserRouter, Navigate } from "react-router";
import { BarcodeScanPage } from "../../features/scan/BarcodeScanPage";
import { CounterOrderPage } from "../../features/counter/CounterOrderPage";
import { ExternalOrderPage } from "../../features/external/ExternalOrderPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/scan" replace />
  },
  {
    path: "/scan",
    element: <BarcodeScanPage />
  },
  {
    path: "/counter",
    element: <CounterOrderPage />
  },
  {
    path: "/external",
    element: <ExternalOrderPage />
  }
]);
