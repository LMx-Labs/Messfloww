import { createBrowserRouter, Navigate } from "react-router";
import { BarcodeScanPage } from "../../features/scan/BarcodeScanPage";
import { CounterOrderPage } from "../../features/counter/CounterOrderPage";
import { ExternalOrderPage } from "../../features/external/ExternalOrderPage";
import { KioskLayout } from "./KioskLayout";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <KioskLayout />
  },
  {
    path: "/scan",
    element: <Navigate to="/" replace />
  },
  {
    path: "/counter",
    element: <Navigate to="/" replace />
  },
  {
    path: "/external",
    element: <Navigate to="/" replace />
  }
]);
