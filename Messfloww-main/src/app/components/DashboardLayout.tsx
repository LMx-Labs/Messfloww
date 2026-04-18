import { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  UtensilsCrossed,
  Clock,
  Menu,
  X,
  ScanBarcode,
  Store,
  User,
  UserCheck,
  BookUser,
  LogOut,
  Lock,
  BookOpen,
  ChefHat,
  Printer,
  Settings as SettingsIcon,
  BarChart3,
  Bell,
} from "lucide-react";
import { useTimeSlots } from "../context/TimeSlotContext";
import { useOrders } from "../context/OrderContext";
import { useAuth } from "../context/AuthContext";
import { MASTER_HASH, computeSHA256 } from "./AdminGate";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, roles: ["manager", "staff"] },
  { name: "Reports", href: "/reports", icon: BarChart3, roles: ["manager", "staff"] },
  { name: "Orders", href: "/orders", icon: ShoppingCart, roles: ["manager", "staff"] },
  { name: "Kitchen", href: "/kitchen", icon: ChefHat, roles: ["manager", "staff"] },
  { name: "Menu", href: "/menu", icon: UtensilsCrossed, roles: ["manager", "staff"] },
  { name: "Passbook", href: "/passbook", icon: BookUser, roles: ["manager", "staff"] },
];

const quickActions = [
  { name: "Scan Barcode", href: "/scan", icon: ScanBarcode, roles: ["manager", "staff"] },
  { name: "External Order", href: "/external-order", icon: Store, roles: ["manager", "staff"] },
  { name: "Counter Order", href: "/counter-order", icon: UserCheck, roles: ["manager", "staff"] },
];

const managementItems = [
  { name: "Students", href: "/students", icon: Users, roles: ["manager"] },
  { name: "KOT Control", href: "/kot-control", icon: Printer, roles: ["manager"] },
  { name: "Time Slots", href: "/time-slots", icon: Clock, roles: ["manager"] },
  { name: "Ledger", href: "/ledger", icon: BookOpen, roles: ["manager"] },
  { name: "Subscriptions", href: "/subscriptions", icon: Bell, roles: ["manager"] },
  { name: "Settings", href: "/settings", icon: SettingsIcon, roles: ["manager"] },
];

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  );
  const location = useLocation();
  const navigate = useNavigate();

  const { activeSlot } = useTimeSlots();
  const { uncompletedOrdersCount } = useOrders();
  const { isAuthenticated, logout, role, loading, user, adminUnlocked, setRoleOverride, unlockAdmin, lockAdmin } = useAuth();

  const [showElevateModal, setShowElevateModal] = useState(false);
  const [elevatePin, setElevatePin] = useState("");
  const [elevateError, setElevateError] = useState("");
  const [isElevating, setIsElevating] = useState(false);

  const handleElevateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsElevating(true);
    setElevateError("");
    try {
      const hash = await computeSHA256(elevatePin);
      if (hash === MASTER_HASH) {
        setRoleOverride("manager");
        unlockAdmin();
        setShowElevateModal(false);
        setElevatePin("");
      } else {
        setElevateError("Incorrect Master PIN");
      }
    } catch (err) {
      setElevateError("Error verifying PIN");
    } finally {
      setIsElevating(false);
    }
  };

  const handleDemote = () => {
    setRoleOverride("staff");
    lockAdmin();
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, loading, navigate]);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden print:hidden">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col print:hidden`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
          {sidebarOpen && (
            <h1 className="text-xl font-bold text-sidebar-foreground">MessFlow</h1>
          )}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground transition-colors"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </motion.button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <div className="space-y-1">
            {navigation
              .filter(item => item.roles.includes(role || ""))
              .map((item) => {
              const isActive =
                location.pathname === item.href ||
                (item.href !== "/" && location.pathname.startsWith(item.href));
              return (
                <motion.div key={item.name} whileTap={{ scale: 0.98 }}>
                  <Link
                    to={item.href}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                      isActive
                        ? "bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium shadow-md shadow-black/20"
                        : "text-sidebar-foreground hover:bg-sidebar-accent"
                    }`}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {sidebarOpen && <span>{item.name}</span>}
                  </Link>
                </motion.div>
              );
            })}
          </div>

          {/* Quick Actions */}
          {sidebarOpen && (
            <div className="mt-8">
              <p className="px-3 text-xs font-semibold text-muted-foreground mb-2">
                QUICK ACTIONS
              </p>
              <div className="space-y-1">
                {quickActions
                  .filter(item => item.roles.includes(role || ""))
                  .map((item) => {
                  const isActive = location.pathname === item.href;
                  const isDisabled = !activeSlot;
                  
                  if (isDisabled) {
                    return (
                      <div
                        key={item.name}
                        className="flex items-center gap-3 px-3 py-3 rounded-lg opacity-50 cursor-not-allowed"
                        title="Mess is closed"
                      >
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        <span>{item.name}</span>
                      </div>
                    );
                  }
                  
                  return (
                    <motion.div key={item.name} whileTap={{ scale: 0.98 }}>
                      <Link
                        to={item.href}
                        className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                          isActive
                            ? "bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium shadow-md shadow-black/20"
                            : "text-sidebar-foreground hover:bg-sidebar-accent"
                        }`}
                      >
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        <span>{item.name}</span>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Management Items */}
          <div className="mt-8">
            <p className={`px-3 text-xs font-semibold text-muted-foreground mb-2 ${!sidebarOpen && "text-center"}`}>
              {sidebarOpen ? "MANAGEMENT" : "MGMT"}
            </p>
            <div className="space-y-1">
              {managementItems
                .filter(item => item.roles.includes(role || ""))
                .map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <motion.div key={item.name} whileTap={{ scale: 0.98 }}>
                    <Link
                      to={item.href}
                      className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                        isActive
                          ? "bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium shadow-md shadow-black/20"
                          : "text-sidebar-foreground hover:bg-sidebar-accent"
                      } ${!sidebarOpen && "justify-center"}`}
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {sidebarOpen && <span className="flex-1">{item.name}</span>}
                      {sidebarOpen && !adminUnlocked && (
                        <Lock className="h-4 w-4 opacity-50" />
                      )}
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 print:hidden">
          <div className="flex items-center gap-6">
            <div
              className={`px-4 py-2 rounded-lg font-semibold ${
                activeSlot ? "bg-accent text-accent-foreground" : "bg-destructive text-destructive-foreground"
              }`}
            >
              {activeSlot ? activeSlot.name : "Mess Closed"}
            </div>
            
          </div>

          <div className="flex items-center gap-4">
            <div className="text-muted-foreground">{currentTime}</div>
            <div className="flex items-center gap-2 bg-muted px-4 py-2 rounded-lg">
              <User className="h-5 w-5" />
              <div className="flex flex-col items-start leading-tight">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground uppercase font-bold">{role}</span>
                  {role === "staff" ? (
                    <button onClick={() => setShowElevateModal(true)} title="Elevate to Manager" className="text-[10px] bg-primary/20 hover:bg-primary/30 text-primary px-1.5 py-0.5 rounded font-bold transition-colors">↑ ELEVATE</button>
                  ) : (
                    <button onClick={handleDemote} title="Drop to Staff" className="text-[10px] bg-destructive/20 hover:bg-destructive/30 text-destructive px-1.5 py-0.5 rounded font-bold transition-colors">↓ DROP</button>
                  )}
                </div>
                <span className="text-sm font-semibold">{user?.email?.split('@')[0]}</span>
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleLogout}
              className="flex items-center gap-2 bg-destructive/10 hover:bg-destructive/20 text-destructive px-4 py-2 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
              <span className="font-semibold text-sm">Logout</span>
            </motion.button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>

      {/* Elevation Modal */}
      {showElevateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-border"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-foreground">Elevate to Manager</h3>
              <button 
                onClick={() => { setShowElevateModal(false); setElevatePin(""); setElevateError(""); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleElevateSubmit}>
              <div className="mb-4 relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  value={elevatePin}
                  onChange={(e) => setElevatePin(e.target.value)}
                  placeholder="Master PIN"
                  className="w-full pl-10 pr-4 py-3 bg-input-background border border-border rounded-xl text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
              </div>
              
              {elevateError && (
                <div className="text-xs text-destructive text-center mb-4 font-semibold">{elevateError}</div>
              )}
              
              <button
                type="submit"
                disabled={!elevatePin || isElevating}
                className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl disabled:opacity-50 flex justify-center items-center"
              >
                {isElevating ? <div className="h-5 w-5 border-2 border-primary-foreground border-t-transparent animate-spin rounded-full" /> : "Verify & Elevate"}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}