import { useState } from "react";
import { ScanBarcode, UserCheck, ShoppingBag } from "lucide-react";
import { BarcodeScanPage } from "../../features/scan/BarcodeScanPage";
import { CounterOrderPage } from "../../features/counter/CounterOrderPage";
import { ExternalOrderPage } from "../../features/external/ExternalOrderPage";

type TabKey = "scan" | "counter" | "external";

const tabs: { key: TabKey; label: string; icon: typeof ScanBarcode }[] = [
  { key: "scan", label: "QR Scan", icon: ScanBarcode },
  { key: "counter", label: "Internal", icon: UserCheck },
  { key: "external", label: "External", icon: ShoppingBag },
];

export function KioskLayout() {
  const [activeTab, setActiveTab] = useState<TabKey>("scan");

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Top Tab Bar */}
      <header className="flex-shrink-0 bg-card border-b border-border">
        <div className="flex items-center h-16 px-4 gap-2">
          <h1 className="text-xl font-black text-primary tracking-tight mr-6 hidden sm:block">
            MessFlow Kiosk
          </h1>
          <div className="flex flex-1 gap-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all
                    ${
                      isActive
                        ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-md shadow-black/20"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }
                  `}
                >
                  <tab.icon className="h-5 w-5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1 overflow-auto p-6">
        {activeTab === "scan" && <BarcodeScanPage />}
        {activeTab === "counter" && <CounterOrderPage />}
        {activeTab === "external" && <ExternalOrderPage />}
      </main>
    </div>
  );
}
