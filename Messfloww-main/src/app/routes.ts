import { createBrowserRouter } from "react-router";
import { Login } from "./pages/Login";
import { DashboardLayout } from "./components/DashboardLayout";
import { Dashboard } from "./pages/Dashboard";
import { LiveOrders } from "./pages/LiveOrders";
import { Students } from "./pages/Students";
import { Menu } from "./pages/Menu";
import { TimeSlots } from "./pages/TimeSlots";
import { Ledger } from "./pages/Ledger";
import { Settings } from "./pages/Settings";
import { BarcodeScan } from "./pages/BarcodeScan";
import { ExternalOrder } from "./pages/ExternalOrder";
import { CounterOrder } from "./pages/CounterOrder";
import { Passbook } from "./pages/Passbook";
import { KitchenDisplay } from "./pages/KitchenDisplay";
import { Reports } from "./pages/Reports";
import { AdminGate } from "./components/AdminGate";
import { KOTControlCenter } from "./pages/KOTControlCenter";
import { CounterListener } from "./pages/CounterListener";
import { ReportSubscriptions } from "./pages/ReportSubscriptions";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/counter-listener/:counterId",
    Component: CounterListener,
  },
  {
    path: "/",
    Component: DashboardLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: "orders", Component: LiveOrders },
      { path: "kitchen", Component: KitchenDisplay },
      { path: "kot-control", Component: KOTControlCenter },
      { path: "passbook", Component: Passbook },
      { path: "menu", Component: Menu },
      { path: "scan", Component: BarcodeScan },
      { path: "external-order", Component: ExternalOrder },
      { path: "counter-order", Component: CounterOrder },
      {
        Component: AdminGate,
        children: [
          { path: "students", Component: Students },
          { path: "time-slots", Component: TimeSlots },
          { path: "ledger", Component: Ledger },
          { path: "reports", Component: Reports },
          { path: "subscriptions", Component: ReportSubscriptions },
          { path: "settings", Component: Settings },
        ]
      }
    ],
  },
]);