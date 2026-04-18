import React, { useEffect, useState } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip 
} from 'recharts';
import { 
  generateMostOrderedItems,
  generateStudentPatterns,
  ReportData 
} from '../../services/reportEngine';
import { RefreshCw, Download, Users, TrendingUp } from 'lucide-react';

interface UsersTabProps {
  startDate: string;
  endDate: string;
}

export function UsersTab({ startDate, endDate }: UsersTabProps) {
  const [loading, setLoading] = useState(true);
  
  const [favoritesData, setFavoritesData] = useState<ReportData | null>(null);
  const [patternsData, setPatternsData] = useState<ReportData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        const fData = await generateMostOrderedItems(start, end);
        const pData = await generateStudentPatterns(start, end);

        setFavoritesData(fData);
        setPatternsData(pData);
      } catch (err) {
        console.error("Error fetching user behavior reports:", err);
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
        <p>Analyzing behavior...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* 7. Most Ordered Items */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Most Ordered Items</h2>
              <p className="text-sm text-muted-foreground">Student favorites</p>
            </div>
            <button className="p-2 bg-muted hover:bg-muted/80 rounded-lg text-foreground transition-colors" title="Export CSV">
              <Download className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-auto max-h-[400px]">
            {favoritesData?.data.topItems ? (
              <div className="space-y-4">
                {favoritesData.data.topItems.map((item: any, i: number) => (
                  <div key={item.name} className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          {i + 1}
                        </div>
                        <div className="font-semibold text-sm">{item.name}</div>
                     </div>
                     <div className="text-right">
                        <div className="font-bold text-foreground">{item.qty}</div>
                        <div className="text-xs text-muted-foreground">orders</div>
                     </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl">Engine Stub</div>
            )}
          </div>
        </div>

        {/* 8. Student Patterns (New vs Repeat) */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
           <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">Active Users</h2>
              <p className="text-sm text-muted-foreground">Repeat vs New</p>
            </div>
            <button className="p-2 bg-muted hover:bg-muted/80 rounded-lg text-foreground transition-colors" title="Export CSV">
              <Download className="h-4 w-4" />
            </button>
          </div>
          
          <div className="h-48 mb-4">
            {patternsData?.data.userMix ? (
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     data={patternsData.data.userMix}
                     cx="50%"
                     cy="50%"
                     innerRadius={40}
                     outerRadius={80}
                     paddingAngle={5}
                     dataKey="value"
                   >
                     {patternsData.data.userMix.map((entry: any, index: number) => (
                       <Cell key={`cell-${index}`} fill={entry.fill} />
                     ))}
                   </Pie>
                   <Tooltip />
                 </PieChart>
               </ResponsiveContainer>
            ) : (
               <div className="h-full flex items-center justify-center text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl">Engine Stub</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
