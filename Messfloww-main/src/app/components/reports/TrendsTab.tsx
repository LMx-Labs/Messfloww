import React, { useEffect, useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
  generateWeeklyTrends,
  generateMonthlyTrends,
  ReportData 
} from '../../services/reportEngine';
import { RefreshCw, Download, ArrowUpRight } from 'lucide-react';

export function TrendsTab() {
  const [loading, setLoading] = useState(true);
  
  const [weeklyData, setWeeklyData] = useState<ReportData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const wData = await generateWeeklyTrends();
        setWeeklyData(wData);
      } catch (err) {
        console.error("Error fetching trend reports:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <RefreshCw className="h-10 w-10 animate-spin mb-4 text-primary" />
        <p>Analyzing trends...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 9. Daily Trend Line */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">Revenue Trend (Last 7 Days)</h2>
            <p className="text-sm text-muted-foreground">Rolling performance</p>
          </div>
          <button className="p-2 bg-muted hover:bg-muted/80 rounded-lg text-foreground transition-colors" title="Export CSV">
            <Download className="h-4 w-4" />
          </button>
        </div>

        <div className="h-[350px]">
          {weeklyData?.data.trend ? (
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={weeklyData.data.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                 <defs>
                   <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                     <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                   </linearGradient>
                 </defs>
                 <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                 <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                 <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                 <Tooltip 
                   contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                   formatter={(val: number) => [`₹${val}`, "Revenue"]}
                 />
                 <Area type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
               </AreaChart>
             </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl">Engine Stub</div>
          )}
        </div>
      </div>
      
    </div>
  );
}
