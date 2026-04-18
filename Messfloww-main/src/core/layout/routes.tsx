import { createBrowserRouter } from "react-router";
import { LoginPage } from "../auth/LoginPage";
import { DashboardLayout } from "./DashboardLayout";
import { DashboardPage } from "../../features/dashboard/DashboardPage";
import { LiveOrdersPage } from "../../features/kitchen/LiveOrdersPage";
import { StudentsPage } from "../../features/students/StudentsPage";
import { MenuPage } from "../../features/menu/MenuPage";
import { TimeSlotsPage } from "../../features/timeslots/TimeSlotsPage";
import { LedgerPage } from "../../features/finance/LedgerPage";
import { SettingsPage } from "../../features/settings/SettingsPage";
import { BarcodeScanPage } from "../../features/billing/BarcodeScanPage";
import { ExternalOrderPage } from "../../features/billing/ExternalOrderPage";
import { CounterOrderPage } from "../../features/billing/CounterOrderPage";
import { PassbookPage } from "../../features/finance/PassbookPage";
import { KitchenDisplayPage } from "../../features/kitchen/KitchenDisplayPage";
import { ReportsPage } from "../../features/reports/ReportsPage";
import { ReportSubscriptionsPage } from "../../features/reports/ReportSubscriptionsPage";
import { AdminGate } from "./AdminGate";
import { KOTControlCenterPage } from "../../features/kitchen/KOTControlCenterPage";
import { CounterListenerPage } from "../../features/kitchen/CounterListenerPage";
import { ErrorBoundary } from "../ErrorBoundary";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: LoginPage,
  },
  {
    path: "/counter-listener/:counterId",
    element: <ErrorBoundary featureName="Counter Listener"><CounterListenerPage /></ErrorBoundary>,
  },
  {
    path: "/",
    Component: DashboardLayout,
    children: [
      { index: true, element: <ErrorBoundary featureName="Dashboard"><DashboardPage /></ErrorBoundary> },
      { path: "orders", element: <ErrorBoundary featureName="Live Orders"><LiveOrdersPage /></ErrorBoundary> },
      { path: "kitchen", element: <ErrorBoundary featureName="Kitchen Display"><KitchenDisplayPage /></ErrorBoundary> },
      { path: "kot-control", element: <ErrorBoundary featureName="KOT Control"><KOTControlCenterPage /></ErrorBoundary> },
      { path: "passbook", element: <ErrorBoundary featureName="Passbook"><PassbookPage /></ErrorBoundary> },
      { path: "menu", element: <ErrorBoundary featureName="Menu"><MenuPage /></ErrorBoundary> },
      { path: "scan", element: <ErrorBoundary featureName="Barcode Scan"><BarcodeScanPage /></ErrorBoundary> },
      { path: "external-order", element: <ErrorBoundary featureName="External Order"><ExternalOrderPage /></ErrorBoundary> },
      { path: "counter-order", element: <ErrorBoundary featureName="Counter Order"><CounterOrderPage /></ErrorBoundary> },
      {
        Component: AdminGate,
        children: [
          { path: "students", element: <ErrorBoundary featureName="Students"><StudentsPage /></ErrorBoundary> },
          { path: "time-slots", element: <ErrorBoundary featureName="Time Slots"><TimeSlotsPage /></ErrorBoundary> },
          { path: "ledger", element: <ErrorBoundary featureName="Ledger"><LedgerPage /></ErrorBoundary> },
          { path: "reports", element: <ErrorBoundary featureName="Reports"><ReportsPage /></ErrorBoundary> },
          { path: "subscriptions", element: <ErrorBoundary featureName="Subscriptions"><ReportSubscriptionsPage /></ErrorBoundary> },
          { path: "settings", element: <ErrorBoundary featureName="Settings"><SettingsPage /></ErrorBoundary> },
        ]
      }
    ],
  },
]);