import React, { useEffect, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { 
  generateFoodUtilization,
  generateFastVsSlowItems,
  ReportData 
} from '../reportEngine';
import { RefreshCw, Download, Utensils, ThumbsUp, ThumbsDown } from 'lucide-react';

interface FoodTabProps {
  startDate: string;
  endDate: string;
}

export function FoodTab({ startDate, endDate }: FoodTabProps) {
  const [loading, setLoading] = useState(true);
  
  const [utilData, setUtilData] = useState<ReportData | null>(null);
  const [velocityData, setVelocityData] = useState<ReportData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        const uData = await generateFoodUtilization(end); // Taking end date as the "day" for util
        const vData = await generateFastVsSlowItems(start, end);

        setUtilData(uData);
        setVelocityData(vData);
      } catch (err) {
        console.error("Error fetching food reports:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [startDate, endDate]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <RefreshCw className="h-10 w-10 animate-spin mb-4 text-primary" />
        <p>Analyzing food trends...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 3. Food Utilization (Sell-through) */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Utensils className="h-5 w-5 text-primary" />
              Food Utilization (Sell-Through Rate)
            </h2>
            <p className="text-sm text-muted-foreground">Prepared vs Sold</p>
          </div>
          <button className="p-2 bg-muted hover:bg-muted/80 rounded-lg text-foreground transition-colors" title="Export CSV">
            <Download className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-auto border rounded-xl border-border">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
              <tr>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3 text-right">Prepared</th>
                <th className="px-4 py-3 text-right">Sold</th>
                <th className="px-4 py-3 text-right">Wasted</th>
                <th className="px-4 py-3">Sell-Through</th>
              </tr>
            </thead>
            <tbody>
              {utilData?.data.utilization ? (
                utilData.data.utilization.map((item: any) => (
                  <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-semibold text-foreground">{item.name}</td>
                    <td className="px-4 py-3 text-right">{item.prepared}</td>
                    <td className="px-4 py-3 text-right text-primary font-bold">{item.sold}</td>
                    <td className="px-4 py-3 text-right font-bold text-destructive">{item.prepared - item.sold}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${item.rate < 50 ? 'bg-destructive' : item.rate < 80 ? 'bg-orange-400' : 'bg-green-500'}`}
                            style={{ width: `${item.rate}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-semibold w-8 text-right">{item.rate}%</span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-muted-foreground">No food utilization data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Fast vs Slow Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Fast Movers */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col">
           <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <ThumbsUp className="h-5 w-5 text-green-500" />
                Fast Movers
              </h2>
              <p className="text-sm text-muted-foreground">High velocity items</p>
            </div>
            <button className="p-2 bg-muted hover:bg-muted/80 rounded-lg text-foreground transition-colors" title="Export CSV">
              <Download className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1">
             {velocityData?.data.fastMovers ? (
               <ul className="space-y-3">
                 {velocityData.data.fastMovers.map((item: any) => (
                   <li key={item.id} className="flex justify-between items-center bg-green-500/5 border border-green-500/10 p-3 rounded-lg">
                      <span className="font-semibold">{item.name}</span>
                      <span className="text-green-600 font-bold">{item.qty} sold</span>
                   </li>
                 ))}
               </ul>
             ) : (
               <div className="h-32 flex items-center justify-center text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl">No moving items data</div>
             )}
          </div>
        </div>

        {/* Slow Movers */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col">
           <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <ThumbsDown className="h-5 w-5 text-destructive" />
                Slow Movers
              </h2>
              <p className="text-sm text-muted-foreground">Low demand items</p>
            </div>
            <button className="p-2 bg-muted hover:bg-muted/80 rounded-lg text-foreground transition-colors" title="Export CSV">
              <Download className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1">
             {velocityData?.data.slowMovers ? (
               <ul className="space-y-3">
                 {velocityData.data.slowMovers.map((item: any) => (
                   <li key={item.id} className="flex justify-between items-center bg-destructive/5 border border-destructive/10 p-3 rounded-lg">
                      <span className="font-semibold">{item.name}</span>
                      <span className="text-destructive font-bold">{item.qty} sold</span>
                   </li>
                 ))}
               </ul>
             ) : (
               <div className="h-32 flex items-center justify-center text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl">No moving items data</div>
             )}
          </div>
        </div>

      </div>

    </div>
  );
}
