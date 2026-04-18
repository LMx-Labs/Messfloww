import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { 
  Printer, 
  Wifi, 
  WifiOff, 
  AlertCircle, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  History,
  Info,
  ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { rtdbService } from "../services/rtdbService";
import { fetchSettings } from "../services/firestoreService";
import { printReceipt, mapQueuedKOTToBill } from "../modules/ThermalPrinter";
import { toast } from "sonner";

export function CounterListener() {
  const { counterId } = useParams<{ counterId: string }>();
  const navigate = useNavigate();
  
  const [counter, setCounter] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [kots, setKots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  
  const sessionId = useRef(Math.random().toString(36).substring(7));
  const processedKots = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!counterId) {
      toast.error("No counter ID provided");
      navigate("/kot-control");
      return;
    }

    fetchSettings().then(setSettings);

    // 1. Fetch counter config and handle session locking
    const countersRef = rtdbService.subscribeKOTCounters((allCounters) => {
      const currentCounter = allCounters.find(c => c.id === counterId);
      
      if (!currentCounter) {
        setSessionError("Counter not found");
        setStatus('error');
        setLoading(false);
        return;
      }

      setCounter(currentCounter);

      // Check for active session
      if (currentCounter.activeSessionId && currentCounter.activeSessionId !== sessionId.current) {
        // Check if heartbeat is stale (> 30s)
        const lastHeartbeat = new Date(currentCounter.lastHeartbeat || 0).getTime();
        const now = Date.now();
        if (now - lastHeartbeat < 30000) {
            setSessionError(`Another instance of this counter is already active (Session: ${currentCounter.activeSessionId}). Only one printer listener per counter is allowed.`);
            setStatus('error');
            setLoading(false);
            return;
        }
      }

      // Claim session and start heartbeat
      setStatus('connected');
      setLoading(false);
    });

    return () => countersRef();
  }, [counterId]);

  // 2. Heartbeat logic
  useEffect(() => {
    if (status !== 'connected' || !counterId) return;

    const interval = setInterval(() => {
      rtdbService.updateCounterHeartbeat(counterId, sessionId.current);
      rtdbService.updateCounterStatus(counterId, 'active');
    }, 15000);

    // Initial heartbeat
    rtdbService.updateCounterHeartbeat(counterId, sessionId.current);
    rtdbService.updateCounterStatus(counterId, 'active');

    return () => {
      clearInterval(interval);
      if (counterId) {
        rtdbService.updateCounterStatus(counterId, 'idle');
      }
    };
  }, [status, counterId]);

  // 3. Queue Listener & Auto-Print
  useEffect(() => {
    if (status !== 'connected' || !counterId || !counter) return;

    const unsubscribe = rtdbService.subscribeKOTQueue(counterId, (allKots) => {
      setKots(allKots);

      if (counter.autoPrint) {
        const pendingKots = allKots.filter(k => 
          (k.status === 'pending' || (k.status === 'failed' && (k.retryCount || 0) < 3)) && 
          !processedKots.current.has(k.id)
        );
        
        pendingKots.forEach((kot, index) => {
          setTimeout(async () => {
            processedKots.current.add(kot.id);
            try {
              console.log(`Printing KOT #${kot.orderNumber} for counter ${counterId}`);
              printReceipt(mapQueuedKOTToBill(kot, counter.name), settings);
              await rtdbService.markKOTPrinted(counterId, kot.id);
              toast.success(`Printed KOT #${kot.orderNumber}`);
            } catch (e) {
              console.error("Print failed", e);
              processedKots.current.delete(kot.id); // Allow retry in next emission if not max reached
              await rtdbService.markKOTFailed(counterId, kot.id);
              toast.error(`Failed to print KOT #${kot.orderNumber}. Will retry...`);
            }
          }, index * 1500); // Slightly more delay for stability
        });
      }
    });

    return () => unsubscribe();
  }, [status, counterId, counter?.autoPrint, settings]);

  const handleOverrideSession = async () => {
    if (!counterId) return;
    setSessionError(null);
    setStatus('connecting');
    setLoading(true);
    await rtdbService.updateCounterHeartbeat(counterId, sessionId.current);
    setStatus('connected');
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-muted-foreground font-bold animate-pulse uppercase tracking-widest text-xs">Initializing Printer Listener...</p>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="h-screen flex items-center justify-center bg-background p-6">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-card max-w-md w-full p-8 rounded-3xl border border-destructive/20 shadow-2xl text-center space-y-6"
        >
          <div className="flex justify-center">
            <XCircle className="w-16 h-16 text-destructive" />
          </div>
          <h2 className="text-2xl font-black text-foreground">Session Error</h2>
          <p className="text-muted-foreground leading-relaxed">
            {sessionError}
          </p>
          <div className="flex flex-col gap-3 pt-4">
            <button 
              onClick={handleOverrideSession}
              className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-black text-lg shadow-lg shadow-primary/20 transition-transform active:scale-95"
            >
              Override & Connect
            </button>
            <button 
              onClick={() => navigate("/kot-control")}
              className="w-full py-4 bg-muted hover:bg-muted-accent text-foreground rounded-2xl font-black transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 lg:p-12 space-y-8 max-w-5xl mx-auto">
      {/* Status Header */}
      <div className="bg-card border border-border rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-soft">
        <div className="flex items-center gap-6">
          <div className={`p-4 rounded-2xl ${status === 'connected' ? 'bg-green-500/10' : 'bg-destructive/10'}`}>
            {status === 'connected' ? <Wifi className="w-10 h-10 text-green-500" /> : <WifiOff className="w-10 h-10 text-destructive" />}
          </div>
          <div>
            <h1 className="text-3xl font-black text-foreground tracking-tight">{counter?.name.toUpperCase()}</h1>
            <div className="flex items-center gap-2 text-muted-foreground font-bold">
               <span className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-destructive'}`} />
               {status === 'connected' ? 'LISTENING FOR ORDERS' : 'DISCONNECTED'}
            </div>
          </div>
        </div>
        
        <div className="flex flex-col items-end">
            <div className="px-4 py-2 bg-muted rounded-xl text-[10px] font-black tracking-widest uppercase border border-border mb-2">
                Session: {sessionId.current}
            </div>
            <div className={`text-xs font-bold ${counter?.autoPrint ? 'text-green-500' : 'text-amber-500'}`}>
                Auto-Print: {counter?.autoPrint ? 'ENABLED' : 'DISABLED'}
            </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Queue Status */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-3xl p-8 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-foreground flex items-center gap-3">
                    <Printer className="w-6 h-6 text-primary" /> Pending Prints
                </h2>
                <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-black">
                    {kots.filter(k => k.status === 'pending').length} TOTAL
                </span>
            </div>

            <div className="space-y-3">
                {kots.filter(k => k.status === 'pending').length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground flex flex-col items-center space-y-3 opacity-50 underline-offset-8">
                        <CheckCircle2 className="w-10 h-10" />
                        <p className="font-bold uppercase tracking-widest text-xs">All Caught Up</p>
                    </div>
                ) : (
                    kots.filter(k => k.status === 'pending').map(kot => (
                        <motion.div 
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            key={kot.id}
                            className="bg-muted/30 border border-border rounded-2xl p-5 flex items-center justify-between"
                        >
                            <div className="flex items-center gap-5">
                                <span className="text-3xl font-black text-foreground">#{kot.orderNumber}</span>
                                <div className="space-y-0.5">
                                    <p className="font-black text-foreground text-sm uppercase">{kot.slotName}</p>
                                    <p className="text-xs text-muted-foreground font-semibold">{kot.items.map((i: any) => `${i.qty}x ${i.name}`).join(', ')}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => printReceipt(mapQueuedKOTToBill(kot, counter.name), settings)}
                                className="p-3 bg-primary text-primary-foreground rounded-xl shadow-md active:scale-95 transition-transform"
                                title="Manual Print"
                            >
                                <Printer className="w-5 h-5" />
                            </button>
                        </motion.div>
                    ))
                )}
            </div>
          </div>

          {/* Tips Section */}
          <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-6 flex gap-4">
             <div className="p-2 bg-indigo-500/10 rounded-lg h-fit">
                <Info className="w-5 h-5 text-indigo-500" />
             </div>
             <div>
                <h4 className="font-black text-indigo-500 text-sm uppercase mb-1">Silent Printing Tip</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                    To skip the print dialog, launch Chrome in <span className="text-foreground font-bold italic">--kiosk-printing</span> mode. 
                    This allows for fully automated hands-free printing as soon as orders arrive.
                </p>
             </div>
          </div>
        </div>

        {/* Right: History & Actions */}
        <div className="space-y-6">
            <div className="bg-card border border-border rounded-3xl p-8 space-y-6">
                <h2 className="text-xl font-black text-foreground flex items-center gap-3">
                    <History className="w-5 h-5 text-muted-foreground" /> Recent History
                </h2>
                <div className="space-y-3">
                    {kots.filter(k => k.status === 'printed').slice(-5).reverse().map(kot => (
                        <div key={kot.id} className="flex items-center justify-between opacity-60 hover:opacity-100 transition-opacity">
                            <span className="font-bold text-sm">#{kot.orderNumber}</span>
                            <span className="text-[10px] font-black text-green-500 uppercase">PRINTED</span>
                        </div>
                    ))}
                    {kots.filter(k => k.status === 'printed').length === 0 && (
                        <p className="text-xs text-muted-foreground italic text-center py-4">No recent prints</p>
                    )}
                </div>
            </div>

            <div className="bg-destructive/5 border border-destructive/10 rounded-3xl p-8 space-y-6">
                <h2 className="text-xl font-black text-destructive flex items-center gap-3">
                    <AlertCircle className="w-5 h-5" /> Failed Prints
                </h2>
                <div className="space-y-3">
                    {kots.filter(k => k.status === 'failed').map(kot => (
                        <div key={kot.id} className="flex items-center justify-between p-3 bg-card border border-destructive/20 rounded-xl">
                            <span className="font-bold text-xs text-foreground">#{kot.orderNumber}</span>
                            <button 
                                onClick={() => rtdbService.pushKOTToQueue(counterId!, kot.id, kot)}
                                className="text-[10px] font-black text-destructive underline"
                            >
                                RETRY
                            </button>
                        </div>
                    ))}
                    {kots.filter(k => k.status === 'failed').length === 0 && (
                        <p className="text-xs text-muted-foreground italic text-center py-4">No failed prints</p>
                    )}
                </div>
            </div>

            <button 
                onClick={() => navigate("/kot-control")}
                className="w-full py-4 flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground font-bold transition-colors"
            >
                <ExternalLink className="w-4 h-4" /> Exit Listener
            </button>
        </div>
      </div>
    </div>
  );
}
