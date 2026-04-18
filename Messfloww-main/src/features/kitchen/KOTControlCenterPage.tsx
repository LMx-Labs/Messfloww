import { useState, useEffect, useMemo } from "react";
import { 
  Printer, 
  Plus, 
  X, 
  Settings as SettingsIcon, 
  Trash2, 
  CheckCircle2, 
  Activity, 
  Monitor, 
  Smartphone,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Clock,
  Layers
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as Switch from "@radix-ui/react-switch";
import { kitchenService } from "./kitchenService";
import { kotQueueService } from "./kotQueueService";
import { useMenu } from "../../features/menu/MenuContext";
import { toast } from "sonner";

interface KOTCounter {
  id: string;
  name: string;
  categories: string[];
  autoPrint: boolean;
  mode: 'browser' | 'device';
  status: 'active' | 'idle' | 'disconnected';
  lastHeartbeat?: string;
  activeSessionId?: string;
  printerId?: string;
}

export function KOTControlCenterPage() {
  const [counters, setCounters] = useState<KOTCounter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCounter, setEditingCounter] = useState<KOTCounter | null>(null);
  const [expandedQueues, setExpandedQueues] = useState<Record<string, boolean>>({});
  const [queues, setQueues] = useState<Record<string, any[]>>({});

  const { menu } = useMenu();

  const allCategories = useMemo(() => {
    const categories = new Set<string>();
    Object.values(menu).flat().forEach((item: any) => {
      if (item.category) categories.add(item.category);
    });
    return Array.from(categories).sort();
  }, [menu]);

  const [counterName, setCounterName] = useState("");
  const [printerId, setPrinterId] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [counterMode, setCounterMode] = useState<'browser' | 'device'>('browser');
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(true);

  useEffect(() => {
    const unsubscribe = kotQueueService.subscribeKOTCounters((data) => {
      setCounters(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];
    counters.forEach(counter => {
      const unsub = kotQueueService.subscribeKOTQueue(counter.id, (kots) => {
        setQueues(prev => ({ ...prev, [counter.id]: kots }));
      });
      unsubscribers.push(unsub);
    });
    return () => unsubscribers.forEach(unsub => unsub());
  }, [counters.map(c => c.id).join(',')]);

  const handleAddCounter = async () => {
    if (!counterName.trim()) {
      toast.error("Please enter a counter name");
      return;
    }
    const counterId = counterName.toLowerCase().replace(/\s+/g, '_');
    const data = {
      name: counterName.trim(),
      printerId: printerId.trim() || counterId,
      categories: selectedCategories,
      mode: counterMode,
      autoPrint: autoPrintEnabled,
      status: 'disconnected'
    };
    try {
      await kotQueueService.setKOTCounter(editingCounter?.id || counterId, data);
      toast.success(editingCounter ? "Counter updated" : "Counter added");
      setShowAddModal(false);
      resetForm();
    } catch (e) {
      toast.error("Failed to save counter");
    }
  };

  const handleDeleteCounter = async (id: string) => {
    if (confirm("Delete this counter?")) {
      await kotQueueService.deleteKOTCounter(id);
      toast.success("Deleted");
    }
  };

  const handleEditCounter = (counter: KOTCounter) => {
    setEditingCounter(counter);
    setCounterName(counter.name);
    setPrinterId(counter.printerId || "");
    setSelectedCategories(counter.categories);
    setCounterMode(counter.mode);
    setAutoPrintEnabled(counter.autoPrint);
    setShowAddModal(true);
  };

  const resetForm = () => {
    setCounterName("");
    setPrinterId("");
    setSelectedCategories([]);
    setCounterMode('browser');
    setAutoPrintEnabled(true);
    setEditingCounter(null);
  };

  if (loading) return <div className="h-full flex items-center justify-center"><RefreshCw className="w-10 h-10 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card p-8 rounded-3xl border border-border shadow-sm">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-primary/10 rounded-2xl"><Printer className="w-10 h-10 text-primary" /></div>
          <div>
            <h1 className="text-4xl font-black">KOT Control Center</h1>
            <p className="text-muted-foreground">Manage real-time printing across kitchen counters</p>
          </div>
        </div>
        <button onClick={() => { resetForm(); setShowAddModal(true); }} className="flex items-center justify-center gap-3 px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-black text-lg">
          <Plus className="w-6 h-6 stroke-[3]" /> Add Counter
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {counters.map((counter) => (
          <div key={counter.id} className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all">
            <div className="px-6 py-4 bg-muted/30 border-b border-border flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest">{counter.status}</span>
              <div className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5"><Monitor className="w-3 h-3" /> {counter.mode}</div>
            </div>
            <div className="p-8 space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-black">{counter.name}</h3>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {counter.categories.map(cat => <span key={cat} className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-[10px] font-bold uppercase tracking-wider">{cat}</span>)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEditCounter(counter)} className="p-3 bg-muted rounded-xl"><SettingsIcon className="w-5 h-5" /></button>
                  <button onClick={() => handleDeleteCounter(counter.id)} className="p-3 bg-destructive/10 text-destructive rounded-xl"><Trash2 className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="flex items-center justify-between p-5 bg-muted/20 rounded-2xl border border-border">
                <span className="font-black">Auto-Print</span>
                <Switch.Root checked={counter.autoPrint} onCheckedChange={() => kotQueueService.setKOTCounter(counter.id, { ...counter, autoPrint: !counter.autoPrint })} className="w-14 h-8 bg-muted rounded-full relative data-[state=checked]:bg-accent">
                  <Switch.Thumb className="block w-6 h-6 bg-foreground rounded-full transition-transform translate-x-1 data-[state=checked]:translate-x-[26px]" />
                </Switch.Root>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => window.open(`/counter-listener/${counter.id}`, '_blank')} className="flex-1 py-4 bg-indigo-500/10 text-indigo-500 rounded-2xl font-black text-sm border border-indigo-500/20">Open Listener</button>
                <div className="py-4 bg-muted/50 rounded-2xl text-center font-black text-sm border border-border">
                  <span className="block text-[8px] opacity-50 uppercase">Pending</span>
                  {queues[counter.id]?.filter(k => k.status === 'pending').length || 0} KOTs
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-lg rounded-3xl p-8 shadow-2xl border border-border">
            <h3 className="text-2xl font-black mb-8">{editingCounter ? "Edit Counter" : "Add New Counter"}</h3>
            <div className="space-y-6">
              <input type="text" value={counterName} onChange={(e) => setCounterName(e.target.value)} placeholder="Counter Name" className="w-full bg-input-background px-5 py-4 rounded-2xl border border-border font-bold" />
              <div className="grid grid-cols-2 gap-2">
                {allCategories.map(cat => (
                  <button key={cat} onClick={() => setSelectedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])} className={`px-4 py-3 rounded-xl border text-sm font-bold ${selectedCategories.includes(cat) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{cat}</button>
                ))}
              </div>
              <div className="flex gap-3 pt-6">
                <button onClick={() => setShowAddModal(false)} className="flex-1 py-4 bg-muted font-black rounded-2xl">Cancel</button>
                <button onClick={handleAddCounter} className="flex-1 py-4 bg-primary text-primary-foreground font-black rounded-2xl shadow-lg shadow-primary/20">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
