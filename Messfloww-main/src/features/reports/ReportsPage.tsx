import { useState } from "react";
import { Calendar, Download, RefreshCw } from "lucide-react";
import { SalesTab } from "./components/SalesTab";
import { WalletTab } from "./components/WalletTab";
import { InventoryTab } from "./components/InventoryTab";
import { FoodTab } from "./components/FoodTab";
import { OperationsTab } from "./components/OperationsTab";
import { UsersTab } from "./components/UsersTab";
import { TrendsTab } from "./components/TrendsTab";
import { InsightsTab } from "./components/InsightsTab";

export type ReportTab = 
  | "Sales" 
  | "Wallet" 
  | "Inventory" 
  | "Food" 
  | "Operations" 
  | "Users" 
  | "Trends" 
  | "Insights";

const TABS: ReportTab[] = [
  "Sales", "Wallet", "Inventory", "Food", "Operations", "Users", "Trends", "Insights"
];

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>("Sales");
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [loading] = useState(false);

  const handleExportAll = () => {
    alert("Exporting all metrics...");
  };

  const renderTabContent = () => {
    switch(activeTab) {
      case "Sales": return <SalesTab startDate={startDate} endDate={endDate} />;
      case "Wallet": return <WalletTab startDate={startDate} endDate={endDate} />;
      case "Inventory": return <InventoryTab date={endDate} />;
      case "Food": return <FoodTab startDate={startDate} endDate={endDate} />;
      case "Operations": return <OperationsTab date={endDate} />;
      case "Users": return <UsersTab startDate={startDate} endDate={endDate} />;
      case "Trends": return <TrendsTab />;
      case "Insights": return <InsightsTab />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Reports & Analytics</h1>
          <p className="text-muted-foreground">Actionable intelligence for MessFlow</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-card border border-border p-1.5 rounded-lg">
             <Calendar className="h-4 w-4 text-muted-foreground ml-2" />
             <input type="date" className="bg-transparent text-sm border-none focus:ring-0 text-foreground" value={startDate} onChange={e => setStartDate(e.target.value)} />
             <span className="text-muted-foreground">to</span>
             <input type="date" className="bg-transparent text-sm border-none focus:ring-0 text-foreground" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <button onClick={handleExportAll} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-secondary transition-colors">
            <Download className="h-4 w-4" /> Export Summary
          </button>
        </div>
      </div>

      <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide border-b border-border">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-2.5 rounded-t-xl font-semibold whitespace-nowrap transition-colors ${activeTab === tab ? "bg-card border-t border-l border-r border-border text-primary shadow-sm" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="min-h-[50vh]">
        {loading ? (
          <div className="flex items-center justify-center min-h-[40vh]">
             <RefreshCw className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : (
          renderTabContent()
        )}
      </div>
    </div>
  );
}
