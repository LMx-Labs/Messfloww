import { useState, useEffect, useMemo } from "react";
import { 
  Printer, 
  Plus, 
  X, 
  Settings as SettingsIcon, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
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
import { rtdbService } from "../services/rtdbService";
import { useMenu } from "../context/MenuContext";
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
}

export function KOTControlCenter() {
  const [counters, setCounters] = useState<KOTCounter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCounter, setEditingCounter] = useState<KOTCounter | null>(null);
  const [expandedQueues, setExpandedQueues] = useState<Record<string, boolean>>({});
  const [queues, setQueues] = useState<Record<string, any[]>>({});

  const { menu } = useMenu();

  // Get all unique categories from the menu
  const allCategories = useMemo(() => {
    const categories = new Set<string>();
    Object.values(menu).flat().forEach((item: any) => {
      if (item.category) categories.add(item.category);
    });
    return Array.from(categories).sort();
  }, [menu]);

  // Form states
  const [counterName, setCounterName] = useState("");
  const [printerId, setPrinterId] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [counterMode, setCounterMode] = useState<'browser' | 'device'>('browser');
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(true);

  useEffect(() => {
    const unsubscribe = rtdbService.subscribeKOTCounters((data) => {
      setCounters(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sync queues for all counters
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    counters.forEach(counter => {
      const unsub = rtdbService.subscribeKOTQueue(counter.id, (kots) => {
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
    if (selectedCategories.length === 0) {
      toast.error("Please select at least one category");
      return;
    }

    const counterId = counterName.toLowerCase().replace(/\s+/g, '_');
    const existing = counters.find(c => c.id === counterId);
    if (existing && !editingCounter) {
        toast.error("Counter with this name already exists");
        return;
    }

    const data = {
      name: counterName.trim(),
      printerId: printerId.trim() || counterId,
      categories: selectedCategories,
      mode: counterMode,
      autoPrint: autoPrintEnabled,
      status: 'disconnected'
    };

    try {
      await rtdbService.setKOTCounter(editingCounter?.id || counterId, data);
      toast.success(editingCounter ? "Counter updated" : "Counter added");
      setShowAddModal(false);
      resetForm();
    } catch (e) {
      toast.error("Failed to save counter");
    }
  };

  const handleDeleteCounter = async (id: string) => {
    if (confirm("Are you sure you want to delete this counter and its print queue?")) {
      try {
        await rtdbService.deleteKOTCounter(id);
        toast.success("Counter deleted");
      } catch (e) {
        toast.error("Failed to delete counter");
      }
    }
  };

  const handleEditCounter = (counter: KOTCounter | any) => {
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

  const toggleAutoPrint = async (counterId: string, current: boolean) => {
    try {
      const counter = counters.find(c => c.id === counterId);
      if (counter) {
        await rtdbService.setKOTCounter(counterId, { ...counter, autoPrint: !current });
      }
    } catch (e) {
      toast.error("Failed to toggle auto-print");
    }
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category) 
        : [...prev, category]
    );
  };

  const getStatusColor = (counter: KOTCounter) => {
    // If heartbeat is older than 45s, mark as disconnected
    const lastHeart = new Date(counter.lastHeartbeat || 0).getTime();
    const isStale = Date.now() - lastHeart > 45000;
    
    if (isStale) return 'text-muted-foreground bg-muted/50 border-border';
    
    switch (counter.status) {
      case 'active': return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'idle': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      default: return 'text-muted-foreground bg-muted/50 border-border';
    }
  };

  const getStatusText = (counter: KOTCounter) => {
    const lastHeart = new Date(counter.lastHeartbeat || 0).getTime();
    const isStale = Date.now() - lastHeart > 45000;
    return isStale ? 'disconnected' : counter.status;
  };

  const getPendingCount = (counterId: string) => {
    return queues[counterId]?.filter(k => k.status === 'pending').length || 0;
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <RefreshCw className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card p-8 rounded-3xl border border-border shadow-soft">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-primary/10 rounded-2xl">
            <Printer className="w-10 h-10 text-primary" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-foreground tracking-tight">KOT Control Center</h1>
            <p className="text-muted-foreground text-lg">Manage real-time printing across kitchen counters</p>
          </div>
        </div>

        <button
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="flex items-center justify-center gap-3 px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-black text-lg transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-primary/20"
        >
          <Plus className="w-6 h-6 stroke-[3]" />
          Add Counter
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card p-6 rounded-2xl border border-border flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-xl">
             <Activity className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Total Counters</p>
            <p className="text-3xl font-black text-foreground">{counters.length}</p>
          </div>
        </div>
        <div className="bg-card p-6 rounded-2xl border border-border flex items-center gap-4">
          <div className="p-3 bg-green-500/10 rounded-xl">
             <CheckCircle2 className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Active Printers</p>
            <p className="text-3xl font-black text-foreground">{counters.filter(c => c.status === 'active').length}</p>
          </div>
        </div>
        <div className="bg-card p-6 rounded-2xl border border-border flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 rounded-xl">
             <Clock className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Pending Prints</p>
            <p className="text-3xl font-black text-foreground">
                {Object.values(queues).reduce((acc, q) => acc + q.filter(k => k.status === 'pending').length, 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Counters Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <AnimatePresence mode="popLayout">
          {counters.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-full py-20 text-center space-y-6 bg-card/50 rounded-3xl border-2 border-dashed border-border"
            >
              <div className="flex justify-center">
                <Printer className="w-16 h-16 text-muted-foreground/20" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-muted-foreground">No Counters Configured</h2>
                <p className="text-muted-foreground/60 max-w-sm mx-auto mt-2">
                  Create your first kitchen counter to start routing KOTs for automated printing.
                </p>
              </div>
            </motion.div>
          ) : (
            counters.map((counter) => (
              <motion.div
                layout
                key={counter.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all group"
              >
                {/* Status Bar */}
                <div className="px-6 py-4 bg-muted/30 border-b border-border flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(counter)}`}>
                      {getStatusText(counter)}
                    </div>
                    {getStatusText(counter) === 'active' && (
                        <div className="flex gap-1">
                            <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 2 }} className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 2, delay: 0.5 }} className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        {counter.mode === 'browser' ? (
                            <div className="flex items-center gap-1.5"><Monitor className="w-3 h-3" /> Browser Mode</div>
                        ) : (
                            <div className="flex items-center gap-1.5 text-primary"><Smartphone className="w-3 h-3" /> Device Mode</div>
                        )}
                    </div>
                  </div>
                </div>

                <div className="p-8 space-y-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-2xl font-black text-foreground">{counter.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Layers className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Printer ID: {counter.id}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {counter.categories.map(cat => (
                          <span key={cat} className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-[10px] font-bold uppercase tracking-wider">
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleEditCounter(counter)}
                        className="p-3 bg-muted hover:bg-muted-accent text-muted-foreground hover:text-foreground rounded-xl transition-colors"
                      >
                        <SettingsIcon className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteCounter(counter.id)}
                        className="p-3 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-xl transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-5 bg-muted/20 rounded-2xl border border-border">
                    <div>
                      <p className="font-black text-foreground">Auto-Print</p>
                      <p className="text-xs text-muted-foreground">Automatically trigger thermal printer</p>
                    </div>
                    <Switch.Root
                      checked={counter.autoPrint}
                      onCheckedChange={() => toggleAutoPrint(counter.id, counter.autoPrint)}
                      className="w-14 h-8 bg-muted rounded-full relative data-[state=checked]:bg-accent transition-colors shadow-inner"
                    >
                      <Switch.Thumb className="block w-6 h-6 bg-foreground rounded-full transition-transform duration-100 translate-x-1 will-change-transform data-[state=checked]:translate-x-[26px]" />
                    </Switch.Root>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => window.open(`/counter-listener/${counter.id}`, '_blank')}
                      className="flex items-center justify-center gap-2 py-4 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 rounded-2xl font-black text-sm transition-all border border-indigo-500/20"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open Listener
                    </button>
                    <div className="flex items-center justify-center gap-2 py-4 bg-muted/50 text-foreground rounded-2xl font-black text-sm border border-border">
                      <div className="flex flex-col items-center">
                        <span className="text-xs opacity-50 font-bold uppercase tracking-widest text-[8px]">Pending</span>
                        <span className={getPendingCount(counter.id) > 0 ? "text-amber-500" : ""}>{getPendingCount(counter.id)} KOTs</span>
                      </div>
                    </div>
                  </div>

                  {/* Queue Monitor Toggle */}
                  <button 
                    onClick={() => setExpandedQueues(prev => ({ ...prev, [counter.id]: !prev[counter.id] }))}
                    className="w-full flex items-center justify-between text-xs font-bold text-muted-foreground hover:text-foreground transition-colors pt-2"
                  >
                    <span>{expandedQueues[counter.id] ? "HIDE" : "VIEW"} PRINT QUEUE</span>
                    {expandedQueues[counter.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {/* Expanded Queue */}
                  {expandedQueues[counter.id] && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="overflow-hidden pt-2 space-y-2"
                    >
                      {(!queues[counter.id] || queues[counter.id].length === 0) ? (
                        <p className="text-center py-4 text-xs text-muted-foreground italic bg-muted/10 rounded-xl">Queue is empty</p>
                      ) : (
                        queues[counter.id].map(kot => (
                          <div key={kot.id} className="flex items-center justify-between p-3 bg-muted/5 rounded-xl border border-border/50 text-[10px]">
                            <div className="flex items-center gap-3">
                              <span className="font-black text-foreground">#{kot.orderNumber}</span>
                              <span className="text-muted-foreground truncate max-w-[100px]">{kot.items.map((i: any) => `${i.qty}x ${i.name}`).join(', ')}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`font-black uppercase tracking-tighter ${kot.status === 'printed' ? 'text-green-500' : kot.status === 'failed' ? 'text-destructive' : 'text-amber-500'}`}>
                                    {kot.status}
                                </span>
                                {kot.status === 'failed' && (
                                    <button 
                                        onClick={() => rtdbService.pushKOTToQueue(counter.id, kot.id, kot)}
                                        className="p-1 px-2 bg-destructive/10 text-destructive rounded font-bold"
                                    >
                                        RETRY
                                    </button>
                                )}
                            </div>
                          </div>
                        )).reverse().slice(0, 10)
                      )}
                      {queues[counter.id] && queues[counter.id].some(k => k.status === 'printed') && (
                        <button 
                          onClick={() => rtdbService.clearPrintedKOTs(counter.id)}
                          className="w-full py-2 text-[10px] font-bold text-muted-foreground hover:text-destructive transition-colors text-center"
                        >
                            CLEAR PRINTED KOTS
                        </button>
                      )}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card w-full max-w-lg rounded-3xl p-8 shadow-2xl border border-border overflow-y-auto max-h-[90vh]"
          >
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-foreground">{editingCounter ? "Edit Counter" : "Add New Counter"}</h3>
              <button onClick={() => { setShowAddModal(false); resetForm(); }} className="p-2 text-muted-foreground hover:text-foreground">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-black text-muted-foreground uppercase tracking-widest mb-3">Counter Name</label>
                <input
                  type="text"
                  value={counterName}
                  onChange={(e) => setCounterName(e.target.value)}
                  placeholder="e.g. North Indian"
                  className="w-full bg-input-background text-foreground px-5 py-4 rounded-2xl border border-border focus:outline-none focus:ring-2 focus:ring-primary font-bold text-lg"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-black text-muted-foreground uppercase tracking-widest mb-3">Shared Printer ID (Optional)</label>
                <input
                  type="text"
                  value={printerId}
                  onChange={(e) => setPrinterId(e.target.value)}
                  placeholder="e.g. main_kitchen"
                  className="w-full bg-input-background text-foreground px-5 py-4 rounded-2xl border border-border focus:outline-none focus:ring-2 focus:ring-primary font-bold text-lg"
                />
                <p className="text-[10px] text-muted-foreground mt-2 font-bold px-1">Use same ID to group multiple counters to one printer.</p>
              </div>

              <div>
                <label className="block text-sm font-black text-muted-foreground uppercase tracking-widest mb-3">Assigned Categories</label>
                {allCategories.length === 0 ? (
                  <p className="text-sm text-destructive font-bold bg-destructive/5 p-4 rounded-xl border border-destructive/10">
                    No categories found in menu. Please add items to menu first.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {allCategories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => toggleCategory(cat)}
                        className={`px-4 py-3 rounded-xl border text-sm font-bold transition-all ${
                          selectedCategories.includes(cat)
                            ? "bg-primary text-primary-foreground border-primary shadow-md"
                            : "bg-muted text-muted-foreground border-border hover:border-muted-foreground"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-black text-muted-foreground uppercase tracking-widest mb-3">Printing Mode</label>
                    <div className="flex p-1 bg-muted rounded-xl gap-1">
                        <button 
                            onClick={() => setCounterMode('browser')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold transition-all ${counterMode === 'browser' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <Monitor className="w-4 h-4" /> Browser
                        </button>
                        <button 
                            onClick={() => setCounterMode('device')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold transition-all ${counterMode === 'device' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <Smartphone className="w-4 h-4" /> Device
                        </button>
                    </div>
                 </div>
                 <div>
                    <label className="block text-sm font-black text-muted-foreground uppercase tracking-widest mb-3">Initial State</label>
                    <div className="flex items-center gap-3 pt-2">
                        <span className="text-xs font-bold text-muted-foreground">Auto-Print</span>
                        <Switch.Root
                            checked={autoPrintEnabled}
                            onCheckedChange={setAutoPrintEnabled}
                            className="w-12 h-6 bg-muted rounded-full relative data-[state=checked]:bg-accent transition-colors shadow-inner"
                        >
                            <Switch.Thumb className="block w-5 h-5 bg-foreground rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[26px]" />
                        </Switch.Root>
                    </div>
                 </div>
              </div>

              <div className="pt-6 flex gap-3">
                <button
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="flex-1 py-4 bg-muted hover:bg-muted-accent text-foreground font-black rounded-2xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCounter}
                  className="flex-1 py-4 bg-primary text-primary-foreground font-black rounded-2xl transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-primary/20"
                >
                  {editingCounter ? "Save Changes" : "Create Counter"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
