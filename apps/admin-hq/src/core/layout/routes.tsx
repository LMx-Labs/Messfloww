import { createBrowserRouter, Navigate } from "react-router";
import { LoginPage } from "../auth/LoginPage";
import { DashboardLayout } from "./DashboardLayout";
import { DashboardPage } from "../../features/dashboard/DashboardPage";
import { StudentsPage } from "../../features/students/StudentsPage";
import { MenuPage } from "../../features/menu/MenuPage";
import { TimeSlotsPage } from "../../features/timeslots/TimeSlotsPage";
import { LedgerPage } from "../../features/finance/LedgerPage";
import { SettingsPage } from "../../features/settings/SettingsPage";
import { ReportsPage } from "../../features/reports/ReportsPage";
import { ReportSubscriptionsPage } from "../../features/reports/ReportSubscriptionsPage";
import { AdminGate } from "./AdminGate";
import { ErrorBoundary } from "../ErrorBoundary";
import { PassbookPage } from "../../features/finance/PassbookPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: LoginPage,
  },

  {
    path: "/",
    Component: DashboardLayout,
    children: [
      { index: true, element: <ErrorBoundary featureName="Dashboard"><DashboardPage /></ErrorBoundary> },

      { path: "passbook", element: <ErrorBoundary featureName="Passbook"><PassbookPage /></ErrorBoundary> },
      { path: "menu", element: <ErrorBoundary featureName="Menu"><MenuPage /></ErrorBoundary> },
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
      },
      { path: "*", element: <Navigate to="/" replace /> }
    ],
  },
]);