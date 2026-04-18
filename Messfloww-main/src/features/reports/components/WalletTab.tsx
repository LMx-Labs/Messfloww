import React, { useEffect, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line 
} from 'recharts';
import { 
  generateWalletBalanceSummary,
  generateWalletRechargeReport,
  generateTopSpenders,
  generateLowBalanceStudents,
  ReportData 
} from '../reportEngine';
import { RefreshCw, Download, IndianRupee, AlertCircle, Users, ArrowUpRight } from 'lucide-react';

interface WalletTabProps {
  startDate: string;
  endDate: string;
}

export function WalletTab({ startDate, endDate }: WalletTabProps) {
  const [loading, setLoading] = useState(true);
  
  const [summaryData, setSummaryData] = useState<ReportData | null>(null);
  const [rechargeData, setRechargeData] = useState<ReportData | null>(null);
  const [topSpendersData, setTopSpendersData] = useState<ReportData | null>(null);
  const [lowBalanceData, setLowBalanceData] = useState<ReportData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        
        const sumData = await generateWalletBalanceSummary();
        const recData = await generateWalletRechargeReport(start, end);
        const spData = await generateTopSpenders(start, end);
        const lowData = await generateLowBalanceStudents(100);

        setSummaryData(sumData);
        setRechargeData(recData);
        setTopSpendersData(spData);
        setLowBalanceData(lowData);
      } catch (err) {
        console.error("Error fetching wallet reports:", err);
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
        <p>Analyzing wallets...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 1. Wallet Summary Card */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">Wallet Balance Summary</h2>
            <p className="text-sm text-muted-foreground">Current snapshot of all students</p>
          </div>
          <button className="p-2 bg-muted hover:bg-muted/80 rounded-lg text-foreground transition-colors" title="Export CSV">
            <Download className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-primary/10 border border-primary/20 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-1">
              <IndianRupee className="h-4 w-4" /> Total Float (System Liability)
            </div>
            <div className="text-3xl font-black text-foreground">₹{summaryData?.data.totalFloat.toLocaleString() || 0}</div>
          </div>
          <div className="bg-muted border border-border p-4 rounded-xl">
            <div className="flex items-center gap-2 text-muted-foreground font-semibold text-sm mb-1">
              <Users className="h-4 w-4" /> Avg Wallet Balance
            </div>
            <div className="text-3xl font-black text-foreground">₹{summaryData?.data.avgBalance.toFixed(0) || 0}</div>
          </div>
          <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-destructive font-semibold text-sm mb-1">
              <AlertCircle className="h-4 w-4" /> Low Balances (&lt;₹100)
            </div>
            <div className="text-3xl font-black text-foreground">{summaryData?.data.lowBalanceCount || 0}</div>
          </div>
        </div>

        <div className="h-48 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={summaryData?.data.histogram || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="range" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                cursor={{ fill: 'var(--muted)' }} 
                contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                formatter={(value: number) => [value, "Students"]}
              />
              <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 2. Top Spenders */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Top Spenders</h2>
              <p className="text-sm text-muted-foreground">{startDate} to {endDate}</p>
            </div>
            <button className="p-2 bg-muted hover:bg-muted/80 rounded-lg text-foreground transition-colors" title="Export CSV">
              <Download className="h-4 w-4" />
            </button>
          </div>
          
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Student</th>
                  <th className="px-4 py-3 text-right rounded-tr-lg">Spend</th>
                </tr>
              </thead>
              <tbody>
                {topSpendersData?.data.spenders?.map((student: any, i: number) => (
                  <tr key={student.regNo} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        <span className="text-muted-foreground w-4 text-xs">{i + 1}.</span> {student.name}
                      </div>
                      <div className="text-xs text-muted-foreground ml-6">{student.regNo}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-primary">₹{student.spend.toLocaleString()}</td>
                  </tr>
                ))}
                {(!topSpendersData?.data.spenders || topSpendersData.data.spenders.length === 0) && (
                  <tr>
                    <td colSpan={2} className="text-center py-6 text-muted-foreground">Under construction in Engine</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          
          {/* 3. Recharge Volume */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">Recharge Volume</h2>
                <p className="text-sm text-muted-foreground">Daily top-ups</p>
              </div>
              <button className="p-2 bg-muted hover:bg-muted/80 rounded-lg text-foreground transition-colors" title="Export CSV">
                <Download className="h-4 w-4" />
              </button>
            </div>
            
            <div className="h-40">
              {rechargeData?.data.dailyRecharges ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rechargeData.data.dailyRecharges} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                      formatter={(val: number) => [`₹${val}`, "Recharged"]}
                    />
                    <Line type="monotone" dataKey="amount" stroke="var(--accent)" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl">Engine Stub</div>
              )}
            </div>
          </div>

          {/* 4. Low Balance Alerts */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex-1 flex flex-col">
             <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">Critical Low Balances</h2>
                <p className="text-sm text-muted-foreground">Students under ₹100</p>
              </div>
              <button className="p-2 bg-muted hover:bg-muted/80 rounded-lg text-foreground transition-colors" title="Export CSV">
                <Download className="h-4 w-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto max-h-48">
              {lowBalanceData?.data.students && lowBalanceData.data.students.length > 0 ? (
                <div className="space-y-2">
                  {lowBalanceData.data.students.map((s: any) => (
                    <div key={s.regNo} className="flex justify-between items-center p-2 rounded-lg bg-destructive/5 border border-destructive/10">
                      <div>
                        <div className="font-semibold text-sm">{s.name}</div>
                        <div className="text-xs text-muted-foreground">{s.regNo}</div>
                      </div>
                      <div className={`font-bold ${s.balance < 0 ? 'text-destructive' : 'text-orange-500'}`}>
                        ₹{s.balance}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                 <div className="h-full flex items-center justify-center text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl">Engine Stub</div>
              )}
            </div>
          </div>

        </div>
      </div>
      
    </div>
  );
}
