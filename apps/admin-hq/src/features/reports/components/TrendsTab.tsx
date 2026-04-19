import React, { useEffect, useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
  generateWeeklyTrends,
  generateMonthlyTrends,
  ReportData 
} from '../reportEngine';
import { RefreshCw, Download, Calendar } from 'lucide-react';

export function TrendsTab() {
  const [loading, setLoading] = useState(true);
  const [activeRange, setActiveRange] = useState<'weekly' | 'monthly'>('weekly');
  
  const [weeklyData, setWeeklyData] = useState<ReportData | null>(null);
  const [monthlyData, setMonthlyData] = useState<ReportData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [wData, mData] = await Promise.all([
            generateWeeklyTrends(),
            generateMonthlyTrends()
        ]);
        setWeeklyData(wData);
        setMonthlyData(mData);
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

  const currentData = activeRange === 'weekly' ? weeklyData : monthlyData;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 9. Daily Trend Line */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <div>
                <h2 className="text-xl font-bold text-foreground">Revenue Trend</h2>
                <p className="text-sm text-muted-foreground">Rolling performance analysis</p>
            </div>
            <div className="flex bg-muted p-1 rounded-lg">
                <button 
                    onClick={() => setActiveRange('weekly')}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeRange === 'weekly' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'}`}
                >
                    Weekly
                </button>
                <button 
                    onClick={() => setActiveRange('monthly')}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeRange === 'monthly' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'}`}
                >
                    Monthly
                </button>
            </div>
          </div>
          <button className="p-2 bg-muted hover:bg-muted/80 rounded-lg text-foreground transition-colors" title="Export CSV">
            <Download className="h-4 w-4" />
          </button>
        </div>

        <div className="h-[400px]">
          {currentData?.data.trend ? (
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={currentData.data.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl">
                No trend data available for {activeRange} range
            </div>
          )}
        </div>
      </div>
      
    </div>
  );
}
