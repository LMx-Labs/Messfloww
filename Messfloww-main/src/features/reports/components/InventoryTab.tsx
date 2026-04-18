import React, { useEffect, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { 
  generateStockConsumption,
  generateLowStockAlerts,
  ReportData 
} from '../reportEngine';
import { RefreshCw, Download, Package, AlertTriangle, ArrowRight } from 'lucide-react';

interface InventoryTabProps {
  date: string;
}

export function InventoryTab({ date }: InventoryTabProps) {
  const [loading, setLoading] = useState(true);
  
  const [stockData, setStockData] = useState<ReportData | null>(null);
  const [alertsData, setAlertsData] = useState<ReportData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const queryDate = new Date(date);
        
        const sData = await generateStockConsumption(queryDate);
        const aData = await generateLowStockAlerts();

        setStockData(sData);
        setAlertsData(aData);
      } catch (err) {
        console.error("Error fetching inventory reports:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [date]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <RefreshCw className="h-10 w-10 animate-spin mb-4 text-primary" />
        <p>Checking inventory...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 1. Low Stock Alerts Panel */}
      {alertsData?.data.alerts && alertsData.data.alerts.length > 0 && (
        <div className="bg-destructive/10 border-l-4 border-destructive rounded-r-xl p-4 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-white/50 rounded-full shrink-0">
             <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div className="flex-1">
             <h3 className="font-bold text-destructive text-lg">Critical Low Stock</h3>
             <div className="flex flex-wrap gap-2 mt-2">
               {alertsData.data.alerts.map((alert: any) => (
                 <div key={alert.id} className="bg-background border border-destructive/20 px-3 py-1.5 rounded-lg text-sm flex items-center gap-2">
                   <span className="font-semibold">{alert.name}</span>
                   <span className="text-muted-foreground text-xs">{alert.stock} left</span>
                 </div>
               ))}
             </div>
          </div>
        </div>
      )}

      {/* 2. Stock Consumption Card */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">Daily Stock Consumption</h2>
            <p className="text-sm text-muted-foreground">Initial vs Consumed vs Remaining</p>
          </div>
          <button className="p-2 bg-muted hover:bg-muted/80 rounded-lg text-foreground transition-colors" title="Export CSV">
            <Download className="h-4 w-4" />
          </button>
        </div>

        <div className="h-[400px]">
          {stockData?.data.consumption ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stockData.data.consumption} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{ fill: 'var(--muted)' }} 
                  contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                />
                <Legend iconType="circle" />
                <Bar dataKey="consumed" name="Consumed" stackId="a" fill="var(--primary)" />
                <Bar dataKey="remaining" name="Remaining" stackId="a" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl">
               Engine Stub: Missing initial stock data tracking
            </div>
          )}
        </div>
      </div>
      
    </div>
  );
}
