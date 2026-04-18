import { useState, useEffect } from 'react';
import { useAuth } from '../../core/auth/AuthContext';
import { 
  createSubscription, 
  getSubscriptions, 
  toggleSubscription, 
  deleteSubscription, 
  ReportSubscription 
} from './subscriptionService';
import { 
  Bell, Mail, Clock, Calendar, CheckSquare, Square, Trash2, Play, Lock, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

const AVAILABLE_REPORTS = [
  { id: 'daily_revenue', label: 'Daily Revenue Summary', group: 'Sales & Finance' },
  { id: 'top_items', label: 'Top Selling Items', group: 'Sales & Finance' },
  { id: 'low_balance', label: 'Low Wallet Balances', group: 'Sales & Finance' },
  { id: 'stock_consumption', label: 'Stock Consumption', group: 'Inventory & Ops' },
  { id: 'low_stock_alerts', label: 'Low Stock Alerts', group: 'Inventory & Ops' },
  { id: 'food_utilization', label: 'Food Utilization (Waste)', group: 'Inventory & Ops' },
  { id: 'smart_insights', label: 'Smart Insights Recommendations', group: 'AI & Trends' },
];

export function ReportSubscriptionsPage() {
  const { user } = useAuth();
  const [subs, setSubs] = useState<ReportSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReports, setSelectedReports] = useState<string[]>(['daily_revenue', 'low_stock_alerts', 'smart_insights']);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [sendTime, setSendTime] = useState<string>('22:00');
  const [channel, setChannel] = useState<'email' | 'whatsapp'>('email');
  const [emailInput, setEmailInput] = useState<string>('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user && user.email) {
      if (recipients.length === 0) setRecipients([user.email]);
      fetchSubscriptions();
    }
  }, [user]);

  const fetchSubscriptions = async () => {
    if (!user) return;
    try {
      const data = await getSubscriptions(user.uid);
      setSubs(data);
    } finally {
      setLoading(false);
    }
  };

  const toggleReportSelection = (reportId: string) => {
    if (selectedReports.includes(reportId)) {
      setSelectedReports(selectedReports.filter(id => id !== reportId));
    } else {
      setSelectedReports([...selectedReports, reportId]);
    }
  };

  const handleCreate = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      await createSubscription({
        userId: user.uid,
        reportTypes: selectedReports,
        frequency,
        sendTime,
        channel,
        recipients,
        enabled: true
      });
      toast.success("Subscription created!");
      fetchSubscriptions();
    } finally {
       setIsSubmitting(false);
    }
  };

  const handleToggle = async (id: string, currentState: boolean) => {
    await toggleSubscription(id, !currentState);
    fetchSubscriptions();
  };

  const handleDelete = async (id: string) => {
    if(confirm("Delete this subscription?")) {
      await deleteSubscription(id);
      fetchSubscriptions();
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
        <h1 className="text-3xl font-black flex items-center gap-3"><Bell className="h-8 w-8 text-primary" /> Report Subscriptions</h1>
        <p className="text-muted-foreground">Automated business intelligence delivered to your inbox</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col gap-6">
           <h2 className="text-xl font-black border-b border-border pb-3">New Schedule</h2>
           <div className="space-y-4">
             {['Sales & Finance', 'Inventory & Ops', 'AI & Trends'].map(group => (
               <div key={group}>
                  <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">{group}</div>
                  <div className="grid grid-cols-1 gap-1">
                    {AVAILABLE_REPORTS.filter(r => r.group === group).map(report => (
                      <button key={report.id} onClick={() => toggleReportSelection(report.id)} className="flex items-center gap-3 w-full p-2 hover:bg-muted rounded-lg transition-colors text-left text-sm">
                        {selectedReports.includes(report.id) ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                        <span className="font-bold">{report.label}</span>
                      </button>
                    ))}
                  </div>
               </div>
             ))}
           </div>
           <div className="grid grid-cols-2 gap-4">
               <div>
                 <label className="text-[10px] font-black uppercase text-muted-foreground mb-1 block">Frequency</label>
                 <select className="w-full bg-input-background border border-border rounded-xl px-3 py-3 text-sm font-bold" value={frequency} onChange={e => setFrequency(e.target.value as any)}>
                   <option value="daily">Daily</option>
                   <option value="weekly">Weekly</option>
                   <option value="monthly">Monthly</option>
                 </select>
               </div>
               <div>
                  <label className="text-[10px] font-black uppercase text-muted-foreground mb-1 block">Time</label>
                  <input type="time" className="w-full bg-input-background border border-border rounded-xl px-3 py-3 text-sm font-bold" value={sendTime} onChange={e => setSendTime(e.target.value)} />
               </div>
           </div>
           <button onClick={handleCreate} disabled={isSubmitting} className="w-full bg-primary hover:bg-secondary text-primary-foreground font-black py-4 rounded-xl mt-auto transition-all shadow-sm">
             {isSubmitting ? "Saving..." : "Create Subscription"}
           </button>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col h-full">
           <h2 className="text-xl font-black border-b border-border pb-3 mb-4">Active Schedules</h2>
           {loading ? <RefreshCw className="h-8 w-8 animate-spin mx-auto my-12" /> : subs.length === 0 ? (
             <div className="flex-1 flex flex-col items-center justify-center text-center p-12 opacity-50"><Calendar className="h-12 w-12 mb-3" /><p className="font-bold">No active subscriptions</p></div>
           ) : (
             <div className="space-y-4 overflow-auto max-h-[600px] pr-2 custom-scrollbar">
               {subs.map(sub => (
                 <div key={sub.id} className={`border rounded-2xl p-5 transition-all ${sub.enabled ? 'border-primary/20 bg-primary/5' : 'bg-muted/30 border-border opacity-60'}`}>
                    <div className="flex justify-between mb-4">
                      <div>
                        <div className="font-black text-sm capitalize">{sub.frequency} at {sub.sendTime}</div>
                        <div className="text-[10px] font-bold opacity-50 flex items-center gap-1 mt-1"><Mail className="h-3 w-3" /> {sub.recipients[0]}...</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleToggle(sub.id, sub.enabled)} className="px-3 py-1 bg-card border border-border rounded-lg text-[10px] font-black uppercase">{sub.enabled ? 'Pause' : 'Resume'}</button>
                        <button onClick={() => handleDelete(sub.id)} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                    <div className="text-[10px] font-bold opacity-70 line-clamp-1">{sub.reportTypes.map(id => AVAILABLE_REPORTS.find(r => r.id === id)?.label || id).join(' • ')}</div>
                 </div>
               ))}
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
