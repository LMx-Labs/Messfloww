import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  createSubscription, 
  getSubscriptions, 
  toggleSubscription, 
  deleteSubscription, 
  ReportSubscription 
} from '../services/subscriptionService';
import { 
  Bell, Mail, Clock, Calendar, CheckSquare, Square, Trash2, Edit2, Play, Lock, RefreshCw
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

export function ReportSubscriptions() {
  const { user } = useAuth();
  
  const [subs, setSubs] = useState<ReportSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
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
    } catch (err) {
      console.error("Failed to load subscriptions", err);
      toast.error("Failed to load subscriptions");
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

  const addEmail = () => {
    if (emailInput && emailInput.includes('@') && !recipients.includes(emailInput)) {
      setRecipients([...recipients, emailInput]);
      setEmailInput('');
    }
  };

  const removeEmail = (email: string) => {
    setRecipients(recipients.filter(e => e !== email));
  };

  const handleCreate = async () => {
    if (!user) return;
    if (selectedReports.length === 0) {
      toast.error("Please select at least one report");
      return;
    }
    if (recipients.length === 0) {
      toast.error("Please add at least one recipient");
      return;
    }

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
      toast.success("Subscription created successfully!");
      fetchSubscriptions();
    } catch (err) {
       console.error(err);
       toast.error("Failed to create subscription");
    } finally {
       setIsSubmitting(false);
    }
  };

  const handleToggle = async (id: string, currentState: boolean) => {
    try {
      await toggleSubscription(id, !currentState);
      fetchSubscriptions();
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async (id: string) => {
    if(confirm("Are you sure you want to delete this subscription?")) {
      try {
        await deleteSubscription(id);
        toast.success("Deleted successfully");
        fetchSubscriptions();
      } catch (err) {
        toast.error("Failed to delete");
      }
    }
  };

  return (
    <div className="space-y-6 max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
          <Bell className="h-8 w-8 text-primary" />
          Report Subscriptions
        </h1>
        <p className="text-muted-foreground">Automate delivery of reports directly to your inbox</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Create New Subscription Form */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col gap-6">
           <h2 className="text-xl font-bold border-b border-border pb-3">Create New Schedule</h2>
           
           {/* Section 1: Select Reports */}
           <div>
             <h3 className="font-semibold text-sm mb-3 text-muted-foreground uppercase flex items-center gap-2">
               <CheckSquare className="h-4 w-4" /> 1. Select Reports
             </h3>
             <div className="grid grid-cols-1 gap-2 border border-border p-3 rounded-lg bg-background/50">
               {['Sales & Finance', 'Inventory & Ops', 'AI & Trends'].map(group => (
                 <div key={group} className="mb-2 last:mb-0">
                    <div className="text-xs font-bold text-muted-foreground mb-1 ml-1">{group}</div>
                    {AVAILABLE_REPORTS.filter(r => r.group === group).map(report => (
                      <button 
                        key={report.id}
                        onClick={() => toggleReportSelection(report.id)}
                        className="flex items-center gap-3 w-full p-2 hover:bg-muted rounded-md transition-colors text-left"
                      >
                        {selectedReports.includes(report.id) ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-sm font-medium">{report.label}</span>
                      </button>
                    ))}
                 </div>
               ))}
             </div>
           </div>

           {/* Section 2: Schedule */}
           <div>
             <h3 className="font-semibold text-sm mb-3 text-muted-foreground uppercase flex items-center gap-2">
               <Clock className="h-4 w-4" /> 2. Schedule
             </h3>
             <div className="grid grid-cols-2 gap-4">
               <div>
                 <label className="text-xs font-semibold text-muted-foreground mb-1 block">Frequency</label>
                 <select 
                   className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary"
                   value={frequency}
                   onChange={e => setFrequency(e.target.value as any)}
                 >
                   <option value="daily">Daily</option>
                   <option value="weekly">Weekly</option>
                   <option value="monthly">Monthly</option>
                 </select>
               </div>
               <div>
                 <label className="text-xs font-semibold text-muted-foreground mb-1 block">Time</label>
                 <input 
                   type="time" 
                   className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary"
                   value={sendTime}
                   onChange={e => setSendTime(e.target.value)}
                 />
               </div>
             </div>
           </div>

           {/* Section 3: Delivery */}
           <div>
             <h3 className="font-semibold text-sm mb-3 text-muted-foreground uppercase flex items-center gap-2">
               <Mail className="h-4 w-4" /> 3. Delivery
             </h3>
             
             <div className="flex gap-2 mb-4 p-1 bg-muted rounded-lg">
               <button 
                 className={`flex-1 py-1.5 text-sm font-semibold rounded-md ${channel === 'email' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                 onClick={() => setChannel('email')}
               >
                 Email Delivery
               </button>
               <button 
                 className="flex-1 py-1.5 text-sm font-semibold rounded-md text-muted-foreground opacity-50 cursor-not-allowed flex items-center justify-center gap-1"
                 title="Coming Soon"
               >
                 <Lock className="h-3 w-3" /> WhatsApp
               </button>
             </div>

             <div className="space-y-2">
               {recipients.map(email => (
                 <div key={email} className="flex justify-between items-center bg-card border border-border px-3 py-2 rounded-lg text-sm">
                   <span>{email}</span>
                   <button onClick={() => removeEmail(email)} className="text-destructive hover:bg-destructive/10 p-1 rounded"><Trash2 className="h-3 w-3" /></button>
                 </div>
               ))}
             </div>

             <div className="flex gap-2 mt-2">
               <input 
                 type="email"
                 placeholder="Add recipient email..."
                 className="flex-1 bg-input-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary"
                 value={emailInput}
                 onChange={e => setEmailInput(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && addEmail()}
               />
               <button 
                 onClick={addEmail}
                 className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm font-bold text-foreground transition-colors"
               >
                 Add
               </button>
             </div>
           </div>

           <button 
             onClick={handleCreate}
             disabled={isSubmitting}
             className="w-full bg-primary hover:bg-secondary text-primary-foreground font-bold py-3 rounded-xl mt-auto transition-colors disabled:opacity-50"
           >
             {isSubmitting ? "Saving..." : "Create Subscription"}
           </button>
        </div>

        {/* Existing Subscriptions List */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col h-full">
           <h2 className="text-xl font-bold border-b border-border pb-3 mb-4">Active Schedules</h2>
           
           {loading ? (
             <div className="flex-1 flex items-center justify-center">
               <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
             </div>
           ) : subs.length === 0 ? (
             <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-sm py-12">
               <Calendar className="h-12 w-12 opacity-30 mb-3" />
               <p>No active subscriptions.</p>
               <p className="opacity-70 mt-1 text-center max-w-[250px]">Create a schedule to automate your business intelligence.</p>
             </div>
           ) : (
             <div className="space-y-4 overflow-auto max-h-[600px] pr-2">
               {subs.map(sub => (
                 <div key={sub.id} className={`border rounded-xl p-4 transition-colors ${sub.enabled ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30'}`}>
                   <div className="flex justify-between items-start mb-3">
                     <div>
                       <div className="font-bold text-foreground capitalize flex items-center gap-2">
                         {sub.frequency} at {sub.sendTime}
                         {!sub.enabled && <span className="text-[10px] bg-muted-foreground/20 px-2 py-0.5 rounded text-muted-foreground uppercase">Paused</span>}
                       </div>
                       <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                         <Mail className="h-3 w-3" /> {sub.recipients.join(', ')}
                       </div>
                     </div>
                     <div className="flex gap-1">
                       <button 
                         onClick={() => handleToggle(sub.id, sub.enabled)}
                         className={`p-1.5 rounded-lg text-xs font-semibold ${sub.enabled ? 'bg-destructive/10 text-destructive hover:bg-destructive/20' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
                       >
                         {sub.enabled ? 'Pause' : 'Resume'}
                       </button>
                       <button onClick={() => handleDelete(sub.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                         <Trash2 className="h-4 w-4" />
                       </button>
                     </div>
                   </div>
                   
                   <div className="text-xs text-foreground/80 mt-2">
                     <span className="font-semibold">Reports Include:</span><br/>
                     <div className="line-clamp-2 opacity-80 mt-0.5">
                       {sub.reportTypes.map(id => AVAILABLE_REPORTS.find(r => r.id === id)?.label || id).join(' • ')}
                     </div>
                   </div>

                   <button 
                     className="mt-3 text-xs w-full py-1.5 border border-border rounded bg-card hover:bg-muted text-foreground flex justify-center items-center gap-1 transition-colors"
                     onClick={() => toast.info("Cloud Function integration required to send test emails.")}
                   >
                     <Play className="h-3 w-3" /> Send Test Now
                   </button>
                 </div>
               ))}
             </div>
           )}
        </div>
        
      </div>
    </div>
  );
}
