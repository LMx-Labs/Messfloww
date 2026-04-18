import React, { useEffect, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';
import { 
  generateDailyRevenue, 
  generateItemWiseRevenue, 
  generatePeakHourSales, 
  generatePaymentTypeReport, 
  ReportData 
} from '../../services/reportEngine';
import { exportToCSV } from '../../services/reportExporter';
import { RefreshCw, Download, TrendingUp, AlertCircle, IndianRupee, Hash, Receipt } from 'lucide-react';

interface SalesTabProps {
  startDate: string;
  endDate: string;
}

export function SalesTab({ startDate, endDate }: SalesTabProps) {
  const [loading, setLoading] = useState(true);
  
  const [dailyData, setDailyData] = useState<ReportData | null>(null);
  const [itemData, setItemData] = useState<ReportData | null>(null);
  const [peakData, setPeakData] = useState<ReportData | null>(null);
  const [paymentData, setPaymentData] = useState<ReportData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // For daily revenue, we might just look at the 'endDate' if they want a specific day, 
        // or aggregate if it's a range. We'll pass the whole range for now and let the engine handle it.
        // Wait, daily revenue generator currently takes a single Date object. Let's adapt it or pass endDate.
        const dData = await generateDailyRevenue(end);
        const iData = await generateItemWiseRevenue(start, end);
        const pkData = await generatePeakHourSales(end);
        const payData = await generatePaymentTypeReport(start, end);

        setDailyData(dData);
        setItemData(iData);
        setPeakData(pkData);
        setPaymentData(payData);
      } catch (err) {
        console.error("Error fetching sales reports:", err);
      } finally {
        setLoading(false);
      }
    };
    
    if (startDate && endDate) {
      fetchData();
    }
  }, [startDate, endDate]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <RefreshCw className="h-10 w-10 animate-spin mb-4 text-primary" />
        <p>Crunching the numbers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 1. Daily Revenue Card */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">Revenue Summary</h2>
            <p className="text-sm text-muted-foreground">For {endDate}</p>
          </div>
          <button className="p-2 bg-muted hover:bg-muted/80 rounded-lg text-foreground transition-colors" title="Export CSV">
            <Download className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-primary/10 border border-primary/20 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-1">
              <IndianRupee className="h-4 w-4" /> Total Revenue
            </div>
            <div className="text-3xl font-black text-foreground">₹{dailyData?.data.totalRevenue.toLocaleString() || 0}</div>
          </div>
          <div className="bg-accent/10 border border-accent/20 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-accent font-semibold text-sm mb-1">
              <Receipt className="h-4 w-4" /> Orders Placed
            </div>
            <div className="text-3xl font-black text-foreground">{dailyData?.data.orderCount || 0}</div>
          </div>
          <div className="bg-muted border border-border p-4 rounded-xl">
            <div className="flex items-center gap-2 text-muted-foreground font-semibold text-sm mb-1">
              <Hash className="h-4 w-4" /> Avg Order Value
            </div>
            <div className="text-3xl font-black text-foreground">₹{dailyData?.data.avgOrderValue.toFixed(0) || 0}</div>
          </div>
        </div>

        {dailyData?.data.chartData && dailyData.data.chartData.length > 0 && (
          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData.data.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                <Tooltip 
                  cursor={{ fill: 'var(--muted)' }} 
                  contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                  itemStyle={{ color: 'var(--foreground)' }}
                  formatter={(value: number) => [`₹${value}`, "Revenue"]}
                />
                <Bar dataKey="revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 2. Top Items Revenue */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Top Items by Revenue</h2>
              <p className="text-sm text-muted-foreground">{startDate} to {endDate}</p>
            </div>
            <button 
              className="p-2 bg-muted hover:bg-muted/80 rounded-lg text-foreground transition-colors" 
              title="Export CSV"
              onClick={() => {
                if (itemData?.data.topItems) {
                  exportToCSV(itemData.data.topItems, 'top_items_revenue', {
                    name: 'Item Name', qty: 'Quantity Sold', revenue: 'Total Revenue', contribution: 'Revenue %'
                  });
                }
              }}
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
          
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Item</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right rounded-tr-lg">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {itemData?.data.topItems?.map((item: any, i: number) => (
                  <tr key={item.name} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-2">
                      <span className="text-muted-foreground w-4 text-xs">{i + 1}.</span> {item.name}
                    </td>
                    <td className="px-4 py-3 text-right">{item.qty}</td>
                    <td className="px-4 py-3 text-right font-bold text-primary">₹{item.revenue.toLocaleString()}</td>
                  </tr>
                ))}
                {(!itemData?.data.topItems || itemData.data.topItems.length === 0) && (
                  <tr>
                    <td colSpan={3} className="text-center py-6 text-muted-foreground">No data available</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Peak Hour & 4. Payment Types Grid */}
        <div className="flex flex-col gap-6">
          
          {/* Peak Hour */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">Peak Hour Sales</h2>
                <p className="text-sm text-muted-foreground">Hourly order volume</p>
              </div>
              <button className="p-2 bg-muted hover:bg-muted/80 rounded-lg text-foreground transition-colors" title="Export CSV">
                <Download className="h-4 w-4" />
              </button>
            </div>
            
            <div className="h-48">
              {peakData?.data.hourlyData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={peakData.data.hourlyData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="hour" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                      formatter={(val: number) => [val, "Orders"]}
                    />
                    <Area type="monotone" dataKey="orders" stroke="var(--accent)" strokeWidth={2} fillOpacity={1} fill="url(#colorOrders)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data</div>
              )}
            </div>
            {peakData?.insights[0] && (
              <div className="mt-4 bg-accent/10 border border-accent/20 p-3 rounded-lg flex items-start gap-2 text-sm text-foreground">
                <TrendingUp className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                <p>{peakData.insights[0]}</p>
              </div>
            )}
          </div>

          {/* Payment Type */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
             <div className="flex justify-between items-start mb-2">
              <div>
                <h2 className="text-xl font-bold text-foreground">Payment Origin</h2>
                <p className="text-sm text-muted-foreground">Wallet vs Counter vs External</p>
              </div>
            </div>
            
            <div className="flex items-center">
              <div className="h-32 w-32 shrink-0">
                {paymentData?.data.types ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentData.data.types.filter((d: any) => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={25}
                        outerRadius={50}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {paymentData.data.types.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: number) => `₹${val}`} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : null}
              </div>
              <div className="flex-1 pl-4 space-y-2">
                {paymentData?.data.types.map((type: any) => (
                  <div key={type.name} className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: type.fill }}></div>
                      <span className="text-muted-foreground">{type.name}</span>
                    </div>
                    <span className="font-semibold text-foreground">₹{type.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      </div>
      
    </div>
  );
}
