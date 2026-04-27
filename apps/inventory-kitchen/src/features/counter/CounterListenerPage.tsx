import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { 
  Printer, 
  Wifi, 
  WifiOff, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  History,
  Info,
  ExternalLink,
  AlertCircle
} from "lucide-react";
import { motion } from "motion/react";
import { 
  kotQueueService, 
  fetchSettings, 
  printReceiptSilent, 
  mapQueuedKOTToBill 
} from "@messflow/shared-core";
import { toast } from "sonner";

const playBeep = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.value = 880; // A5 note
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.15);
  } catch (e) {
    console.warn("Audio not supported or muted");
  }
};

export function CounterListenerPage() {
  const { counterId } = useParams<{ counterId: string }>();
  const navigate = useNavigate();
  
  const [counter, setCounter] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [kots, setKots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [flash, setFlash] = useState(false);
  
  const sessionId = useRef(Math.random().toString(36).substring(7));
  const processedKots = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!counterId) {
      toast.error("No counter ID provided");
      navigate("/kot-control");
      return;
    }

    fetchSettings().then(setSettings);

    const countersRef = kotQueueService.subscribeKOTCounters((allCounters) => {
      const currentCounter = allCounters.find(c => c.id === counterId);
      if (!currentCounter) {
        setSessionError("Counter not found");
        setStatus('error');
        setLoading(false);
        return;
      }

      setCounter(currentCounter);

      if (currentCounter.activeSessionId && currentCounter.activeSessionId !== sessionId.current) {
        const lastHeartbeat = new Date(currentCounter.lastHeartbeat || 0).getTime();
        if (Date.now() - lastHeartbeat < 30000) {
            setSessionError(`Another instance of this counter is already active.`);
            setStatus('error');
            setLoading(false);
            return;
        }
      }

      setStatus('connected');
      setLoading(false);
    });

    return () => countersRef();
  }, [counterId]);

  useEffect(() => {
    if (status !== 'connected' || !counterId) return;
    const interval = setInterval(() => {
      kotQueueService.updateCounterHeartbeat(counterId, sessionId.current);
      kotQueueService.updateCounterStatus(counterId, 'active');
    }, 15000);
    kotQueueService.updateCounterHeartbeat(counterId, sessionId.current);
    kotQueueService.updateCounterStatus(counterId, 'active');
    return () => {
      clearInterval(interval);
      if (counterId) kotQueueService.updateCounterStatus(counterId, 'idle');
    };
  }, [status, counterId]);

  useEffect(() => {
    if (status !== 'connected' || !counterId || !counter) return;
    const unsubscribe = kotQueueService.subscribeKOTQueue(counterId, (allKots) => {
      setKots(allKots);
      
      const pendingKots = allKots.filter(k => (k.status === 'pending' || (k.status === 'failed' && (k.retryCount || 0) < 3)) && !processedKots.current.has(k.id));
      
      if (pendingKots.length > 0) {
        // Trigger beep and flash
        playBeep();
        setFlash(true);
        setTimeout(() => setFlash(false), 1000);
        
        pendingKots.forEach((kot, index) => {
          // Check if the KOT itself has autoPrint flag (from Night Mess) or the counter has it enabled
          if (counter.autoPrint || kot.autoPrint) {
            setTimeout(async () => {
              processedKots.current.add(kot.id);
              try {
                printReceiptSilent(mapQueuedKOTToBill(kot, counter.name), settings);
                await kotQueueService.markKOTPrinted(counterId, kot.id);
                toast.success(`Printed KOT #${kot.orderNumber}`);
              } catch (e) {
                processedKots.current.delete(kot.id);
                await kotQueueService.markKOTFailed(counterId, kot.id);
              }
            }, index * 1500);
          }
        });
      }
    });
    return () => unsubscribe();
  }, [status, counterId, counter?.autoPrint, settings]);

  if (loading) return <div className="h-screen flex flex-col items-center justify-center bg-background space-y-4"><Loader2 className="w-12 h-12 animate-spin text-primary" /><p className="text-xs font-bold uppercase tracking-widest">Initializing Printer Listener...</p></div>;

  if (sessionError) {
    return (
      <div className="h-screen flex items-center justify-center bg-background p-6">
        <div className="bg-card w-full max-w-md p-8 rounded-3xl border border-destructive/20 text-center space-y-6">
          <XCircle className="w-16 h-16 text-destructive mx-auto" />
          <h2 className="text-2xl font-black">Session Error</h2>
          <p className="text-muted-foreground">{sessionError}</p>
          <div className="flex flex-col gap-3 pt-4">
            <button onClick={() => { setSessionError(null); setStatus('connecting'); setLoading(true); kotQueueService.updateCounterHeartbeat(counterId!, sessionId.current); setStatus('connected'); setLoading(false); }} className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-black">Override & Connect</button>
            <button onClick={() => navigate("/kot-control")} className="w-full py-4 bg-muted rounded-2xl font-black">Back to Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-background p-6 space-y-8 max-w-5xl mx-auto transition-colors duration-300 ${flash ? 'bg-primary/20' : ''}`}>
      <div className="bg-card border border-border rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className={`p-4 rounded-2xl ${status === 'connected' ? 'bg-green-500/10' : 'bg-destructive/10'}`}>{status === 'connected' ? <Wifi className="w-10 h-10 text-green-500" /> : <WifiOff className="w-10 h-10 text-destructive" />}</div>
          <div><h1 className="text-3xl font-black">{counter?.name.toUpperCase()}</h1><div className="flex items-center gap-2 text-xs font-bold">{status === 'connected' ? 'LISTENING' : 'OFFLINE'}</div></div>
        </div>
        <div className="text-[10px] font-black uppercase tracking-widest bg-muted px-4 py-2 rounded-xl">Session: {sessionId.current}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-3xl p-8 space-y-6">
            <h2 className="text-xl font-black flex items-center gap-3"><Printer className="w-6 h-6 text-primary" /> Pending KOTs</h2>
            <div className="space-y-3">
              {kots.filter(k => k.status === 'pending').map(kot => (
                <div key={kot.id} className="bg-muted/30 border border-border rounded-2xl p-5 flex items-center justify-between">
                  <div><span className="text-3xl font-black">#{kot.orderNumber}</span><p className="text-xs text-muted-foreground">{kot.items.map((i: any) => `${i.qty}x ${i.name}`).join(', ')}</p></div>
                  <button onClick={() => printReceiptSilent(mapQueuedKOTToBill(kot, counter.name), settings)} className="p-3 bg-primary text-primary-foreground rounded-xl"><Printer className="w-5 h-5" /></button>
                </div>
              ))}
              {kots.filter(k => k.status === 'pending').length === 0 && <div className="py-12 text-center opacity-50"><CheckCircle2 className="w-10 h-10 mx-auto" /><p className="text-xs font-bold uppercase mt-2">All Caught Up</p></div>}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border rounded-3xl p-8 space-y-6">
            <h2 className="text-xl font-black flex items-center gap-3"><History className="w-5 h-5 text-muted-foreground" /> Recent History</h2>
            <div className="space-y-3">
              {kots.filter(k => k.status === 'printed').slice(-5).reverse().map(kot => (
                <div key={kot.id} className="flex justify-between items-center opacity-60"><span className="font-bold text-sm">#{kot.orderNumber}</span><span className="text-[10px] text-green-500 font-black">PRINTED</span></div>
              ))}
            </div>
          </div>
          <div className="bg-destructive/5 border border-destructive/10 rounded-3xl p-8 space-y-6">
            <h2 className="text-xl font-black flex items-center gap-3"><AlertCircle className="w-5 h-5" /> Failed</h2>
            <div className="space-y-3">
              {kots.filter(k => k.status === 'failed').map(kot => (
                <div key={kot.id} className="flex justify-between items-center p-3 bg-card rounded-xl">
                  <span className="font-bold text-xs">#{kot.orderNumber}</span>
                  <button onClick={() => kotQueueService.pushKOTToQueue(counterId!, kot.id, kot)} className="text-[10px] font-black text-destructive underline">RETRY</button>
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => navigate("/kot-control")} className="w-full py-4 text-muted-foreground hover:text-foreground font-bold flex items-center justify-center gap-2"><ExternalLink className="w-4 h-4" /> Exit Listener</button>
        </div>
      </div>
    </div>
  );
}
