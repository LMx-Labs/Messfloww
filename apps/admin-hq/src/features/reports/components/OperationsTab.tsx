import React, { useEffect, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line
} from 'recharts';
import { 
  generateOrdersPerHour,
  generateCounterLoadDistribution,
  ReportData 
} from '../reportEngine';
import { RefreshCw, Download, Activity, MonitorSmartphone } from 'lucide-react';

interface OperationsTabProps {
  date: string;
}

export function OperationsTab({ date }: OperationsTabProps) {
  const [loading, setLoading] = useState(true);
  
  const [hourlyData, setHourlyData] = useState<ReportData | null>(null);
  const [counterData, setCounterData] = useState<ReportData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const queryDate = new Date(date);
        
        const hData = await generateOrdersPerHour(queryDate);
        const cData = await generateCounterLoadDistribution(queryDate);

        setHourlyData(hData);
        setCounterData(cData);
      } catch (err) {
        console.error("Error fetching ops reports:", err);
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
        <p>Crunching ops data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 5. Orders Per Hour Card */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">Orders Per Hour</h2>
            <p className="text-sm text-muted-foreground">Traffic pattern over time</p>
          </div>
          <button className="p-2 bg-muted hover:bg-muted/80 rounded-lg text-foreground transition-colors" title="Export CSV">
            <Download className="h-4 w-4" />
          </button>
        </div>

        <div className="h-[300px]">
          {hourlyData?.data.hourlyData ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyData.data.hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="hour" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                />
                <Line type="monotone" dataKey="orders" stroke="var(--primary)" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
             <div className="h-full flex items-center justify-center text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl">No order data for this date</div>
          )}
        </div>
      </div>

      {/* 6. Counter Load Card */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">Counter Load Distribution</h2>
            <p className="text-sm text-muted-foreground">Orders by serving slot</p>
          </div>
          <button className="p-2 bg-muted hover:bg-muted/80 rounded-lg text-foreground transition-colors" title="Export CSV">
            <Download className="h-4 w-4" />
          </button>
        </div>

        <div className="h-[250px]">
          {counterData?.data.loadData ? (
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={counterData.data.loadData} layout="vertical" margin={{ top: 0, right: 0, left: 30, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                 <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                 <YAxis dataKey="name" type="category" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                 <Tooltip 
                   cursor={{ fill: 'var(--muted)' }} 
                   contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                 />
                 <Bar dataKey="orders" fill="var(--accent)" radius={[0, 4, 4, 0]} />
               </BarChart>
             </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl">No slot data available</div>
          )}
        </div>
      </div>
      
    </div>
  );
}
