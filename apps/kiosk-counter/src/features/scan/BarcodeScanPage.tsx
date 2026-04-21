import { useState, useEffect, useRef, useCallback } from "react";
import { ScanBarcode, Check, Printer, AlertCircle, Clock } from "lucide-react";
import { Link } from "react-router";
import { doc, getDoc } from "firebase/firestore";
import { 
  db, 
  orderService, 
  menuService, 
  timeSlotService, 
  fetchSettings,
  parseQRCodeValue,
  printReceipt,
  mapOrderToBill,
  mapOrderToKOTs,
  MenuItem,
  TimeSlot,
  kotQueueService
} from "@messflow/shared-core";
import { toast } from "sonner";

export function BarcodeScanPage() {
  const [activeSlot, setActiveSlot] = useState<TimeSlot | null>(null);
  const [menu, setMenu] = useState<Record<string, MenuItem[]>>({});
  const [scannedOrder, setScannedOrder] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [error, setError] = useState("");
  const [successFlash, setSuccessFlash] = useState(false);
  const [errorFlash, setErrorFlash] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scanningRef = useRef(false);
  const lastScanTimeRef = useRef(0);
  const [counters, setCounters] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const unsubSlot = timeSlotService.subscribeToActiveSlot(setActiveSlot);
    const unsubMenu = menuService.subscribeToMenu(setMenu);
    const unsubCounters = kotQueueService.subscribeKOTCounters(setCounters);
    
    fetchSettings().then(setSettings);

    const checkQueueAndSync = async () => {
      const queue = JSON.parse(localStorage.getItem('offlineScanQueue') || '[]');
      if (queue.length > 0) {
        toast.info(`Syncing ${queue.length} offline scans...`);
        let syncedCount = 0;
        const newQueue: string[] = [];
        
        for (const scanStr of queue) {
          try {
            await orderService.atomicCollectOrder(scanStr);
            syncedCount++;
          } catch (e) {
             // Maybe already processed or permanently failed, could keep or drop. Let's drop to prevent infinite loop.
          }
        }
        localStorage.setItem('offlineScanQueue', JSON.stringify(newQueue));
        if (syncedCount > 0) toast.success(`Synced ${syncedCount} offline scans!`);
      }
    };

    const handleOnline = () => {
      setIsOffline(false);
      checkQueueAndSync();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (navigator.onLine) checkQueueAndSync();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubSlot();
      unsubMenu();
      unsubCounters();
    };
  }, []);

  const handleScan = useCallback(async (rawInput: string) => {
    const now = Date.now();
    // Throttle scans to max 1 per 1000ms
    if (now - lastScanTimeRef.current < 1000) return;
    
    const trimmed = rawInput.trim();
    if (!trimmed || scanningRef.current) return;
    
    lastScanTimeRef.current = now;
    scanningRef.current = true;
    setScanning(true);
    setError("");
    setErrorFlash(false);
    
    try {
      const parsedQR = parseQRCodeValue(trimmed);
      let orderId = parsedQR ? parsedQR.orderId : trimmed;

      let activeOrder = null;
      
      if (isOffline) {
        const cache = JSON.parse(localStorage.getItem('offline_orders_cache') || '[]');
        activeOrder = cache.find((o: any) => o.id === orderId || o.orderNumber?.toString() === orderId || o.userRollNo === orderId);
        if (activeOrder) orderId = activeOrder.id;
      } else {
        activeOrder = await orderService.getActiveOrderById(orderId);
        
        if (!activeOrder && !parsedQR) {
          activeOrder = await orderService.getActiveOrderSearchFallback(trimmed);
          if (activeOrder) {
            orderId = activeOrder.id;
          }
        }
      }
      
      if (activeOrder) {
        if (!parsedQR && trimmed.startsWith('MESSFLOWW|')) {
           setError("Invalid QR format. Please try scanning again.");
           setErrorFlash(true);
           setTimeout(() => setErrorFlash(false), 1500);
           return;
        }

        if (activeOrder.qrUsed || activeOrder.status === 'collected') {
          setError("Order already collected (QR Used)");
          setErrorFlash(true);
          setTimeout(() => setErrorFlash(false), 1500);
          return;
        }

        if (activeOrder.paymentStatus === 'PENDING') {
          setScannedOrder({ ...activeOrder, needsPaymentConfirmation: true });
          return;
        }

        let collectedOrder;
        
        if (isOffline) {
          collectedOrder = { ...activeOrder, status: 'processing', qrUsed: true, autoPrint: true };
          // Mark locally in cache so we don't scan it twice offline
          const cache = JSON.parse(localStorage.getItem('offline_orders_cache') || '[]');
          const idx = cache.findIndex((o: any) => o.id === orderId);
          if (idx >= 0) {
            cache[idx] = collectedOrder;
            localStorage.setItem('offline_orders_cache', JSON.stringify(cache));
          }

          const queue = JSON.parse(localStorage.getItem('offlineScanQueue') || '[]');
          if (!queue.includes(orderId)) {
             queue.push(orderId);
             localStorage.setItem('offlineScanQueue', JSON.stringify(queue));
          }
          toast.success("Offline Scan Saved! Printing locally...");
        } else {
          collectedOrder = await orderService.atomicCollectOrder(orderId);
          collectedOrder.autoPrint = true; // Flag for KDS auto-print
        }

        setSuccessFlash(true);
        setTimeout(() => setSuccessFlash(false), 1500);
        setScannedOrder({ id: collectedOrder.id, ...collectedOrder });
        
        // Auto-Route KOTs
        const allMenuItems = Object.values(menu).flat();
        if (!isOffline) {
          await kotQueueService.routeOrderToCounters(collectedOrder, counters, allMenuItems);
        }
        
        setTimeout(() => {
          const bill = mapOrderToBill(collectedOrder);
          const kots = mapOrderToKOTs(collectedOrder, allMenuItems);
          printReceipt([bill, ...kots], settings);
        }, 500);

      } else {
        if (!isOffline) {
          const histRef = doc(db, "historical_orders", orderId);
          const histDoc = await getDoc(histRef);
          if (histDoc.exists()) {
            setError("Order already collected or cancelled");
            setErrorFlash(true);
            setTimeout(() => setErrorFlash(false), 1500);
            return;
          }
        }
        setError("Invalid QR Code or Order not found");
        setErrorFlash(true);
        setTimeout(() => setErrorFlash(false), 1500);
      }
    } catch (e: any) {
      console.error("Scan failed", e);
      if (isOffline || e.message?.includes('network')) {
         const queue = JSON.parse(localStorage.getItem('offlineScanQueue') || '[]');
         const parsedId = parseQRCodeValue(trimmed)?.orderId || trimmed;
         queue.push(parsedId);
         localStorage.setItem('offlineScanQueue', JSON.stringify(queue));
         toast.success("Saved scan offline! Will sync when reconnected.");
         setError(""); // Don't show error if we handled it via offline queue
      } else {
         setError(e.message || "Error finding order");
         setErrorFlash(true);
         setTimeout(() => setErrorFlash(false), 1500);
      }
    } finally {
      scanningRef.current = false;
      setScanning(false);
      // Clear the input and refocus for the next scan
      setBarcodeInput("");
      if (inputRef.current) {
        inputRef.current.value = "";
        inputRef.current.focus();
      }
    }
  }, [settings, menu, counters, isOffline]);

  // Physical barcode scanners type characters rapidly then fire Enter.
  // Reading from the DOM ref avoids React state batching lag.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const value = inputRef.current?.value || barcodeInput;
      if (value.trim()) handleScan(value);
    }
  };

  const bufferRef = useRef('');
  const bufferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Global HID scanner listener + auto-focus fallback
  useEffect(() => {
    if (scannedOrder) return;
    
    if (inputRef.current) {
      inputRef.current.focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const val = bufferRef.current.trim();
        bufferRef.current = '';
        if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);
        if (val) handleScan(val);
      } else if (e.key.length === 1) {
        bufferRef.current += e.key;
        if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);
        bufferTimerRef.current = setTimeout(() => { bufferRef.current = ''; }, 100);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [scannedOrder, handleScan]);

  const handlePrintReceipt = () => {
    if (scannedOrder) printReceipt(mapOrderToBill(scannedOrder), settings);
  };

  const handleConfirmPaymentAndPrint = async (orderId: string) => {
    try {
      await orderService.confirmUpiPayment(orderId);
      const collectedOrder = await orderService.atomicCollectOrder(orderId);
      collectedOrder.autoPrint = true;
      
      setSuccessFlash(true);
      setTimeout(() => setSuccessFlash(false), 1500);
      setScannedOrder({ id: collectedOrder.id, ...collectedOrder }); 

      const allMenuItems = Object.values(menu).flat();
      await kotQueueService.routeOrderToCounters(collectedOrder, counters, allMenuItems);
      
      setTimeout(() => {
        const bill = mapOrderToBill(collectedOrder);
        const kots = mapOrderToKOTs(collectedOrder, allMenuItems);
        printReceipt([bill, ...kots], settings);
      }, 500);
    } catch (e: any) {
      toast.error(e.message || "Failed to confirm payment");
    }
  };

  const handleNewScan = () => {
    setScannedOrder(null);
    setBarcodeInput("");
    setError("");
  };

  if (!activeSlot) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Barcode Scanner</h1>
          <p className="text-muted-foreground">Scan customer barcode to complete order pickup</p>
        </div>
        <div className="bg-destructive/10 border-2 border-destructive rounded-2xl p-12 text-center">
          <div className="flex justify-center mb-6"><div className="p-8 rounded-full bg-destructive/20"><AlertCircle className="h-20 w-20 text-destructive" /></div></div>
          <h2 className="text-2xl font-bold text-foreground mb-3">Mess is Closed</h2>
          <p className="text-muted-foreground mb-8">Barcode scanning is only available when the mess is open.</p>
          <Link to="/time-slots" className="inline-flex items-center gap-2 bg-primary hover:bg-secondary text-primary-foreground px-6 py-3 rounded-xl font-semibold transition-colors">
            <Clock className="h-5 w-5" /> Manage Time Slots
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-foreground">Barcode Scanner</h1>
          {isOffline && (
            <span className="bg-destructive/10 text-destructive text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider animate-pulse flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> Offline Mode
            </span>
          )}
        </div>
      <p className="text-muted-foreground text-center">Scan customer barcode to complete order pickup</p>
      </div>

      {!scannedOrder ? (
        <div className={`bg-card rounded-[3rem] p-16 border-4 border-dashed ${errorFlash ? 'border-destructive bg-destructive/10' : scanning ? 'border-secondary bg-secondary/5' : 'border-border'} text-center transition-colors duration-300 shadow-2xl`}>
          <div className="flex justify-center mb-10">
            <div className={`p-10 rounded-full ${errorFlash ? 'bg-destructive/20' : scanning ? 'bg-secondary/20 animate-pulse' : 'bg-primary/20'}`}>
              <ScanBarcode className={`h-24 w-24 ${errorFlash ? 'text-destructive' : scanning ? 'text-secondary' : 'text-primary'}`} />
            </div>
          </div>
          <h2 className="text-3xl font-black text-foreground mb-4">{errorFlash ? "Scan Failed!" : scanning ? "Scanning..." : "Ready to Scan"}</h2>
          <p className="text-muted-foreground mb-10 text-lg">Focus this window and scan a QR code.</p>
          {error && <div className="mb-8 bg-destructive text-destructive-foreground text-lg font-bold p-4 rounded-xl shadow-lg animate-in fade-in slide-in-from-top-2">{error}</div>}
          <input ref={inputRef} type="text" defaultValue="" onChange={(e) => setBarcodeInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Scanner input field..." disabled={scanning} autoFocus className="w-full max-w-md mx-auto bg-input-background text-foreground px-8 py-5 rounded-2xl border-2 border-border focus:outline-none focus:ring-4 focus:ring-primary/30 text-center text-xl font-bold opacity-50 focus:opacity-100 transition-opacity" />
        </div>
      ) : (
        <div className="space-y-6 max-w-3xl mx-auto">
          {/* Payment Verification Modal */}
          {scannedOrder.needsPaymentConfirmation && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
              <div className="bg-card w-full max-w-lg rounded-[2rem] p-8 border border-amber-500/30 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-center mb-6">
                  <div className="p-6 rounded-full bg-amber-500/20">
                    <Clock className="h-12 w-12 text-amber-500" />
                  </div>
                </div>
                <h2 className="text-3xl font-black text-center text-foreground mb-2">Verify UPI Payment</h2>
                <p className="text-muted-foreground text-center mb-8 text-lg">
                  Amount to collect: <span className="font-black text-amber-500 text-2xl">₹{scannedOrder.totalPrice}</span>
                </p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => handleConfirmPaymentAndPrint(scannedOrder.id)} 
                    className="flex-1 bg-amber-500 text-amber-950 px-6 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-amber-400 transition-colors"
                  >
                    <Check className="w-6 h-6" /> Payment Verified
                  </button>
                  <button 
                    onClick={handleNewScan} 
                    className="flex-1 bg-muted hover:bg-muted/80 text-foreground px-6 py-4 rounded-xl font-bold text-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {!scannedOrder.needsPaymentConfirmation && (
            <div className={`bg-accent/20 border-4 border-accent rounded-[3rem] p-12 text-center transition-colors duration-500 ${successFlash ? 'bg-accent/40 shadow-[0_0_50px_rgba(34,197,94,0.4)]' : ''}`}>
              <div className="flex justify-center mb-6"><div className="p-8 rounded-full bg-accent"><Check className="h-16 w-16 text-accent-foreground" /></div></div>
              <h2 className="text-4xl font-black text-foreground mb-3">Order Verified!</h2>
              <p className="text-accent font-bold text-xl">Sent to kitchen for processing</p>
            </div>
          )}
          <div className="bg-card rounded-3xl p-8 border border-border shadow-xl">
            <h3 className="text-xl font-black text-foreground mb-6 uppercase tracking-wider">Order Details</h3>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between py-2 border-b border-border"><span className="text-muted-foreground">Order ID</span><span className="font-semibold">{scannedOrder.id}</span></div>
              <div className="flex justify-between py-2 border-b border-border"><span className="text-muted-foreground">Student</span><span className="font-semibold">{scannedOrder.externalLabel || scannedOrder.userRollNo}</span></div>
            </div>
            <div className="mb-6">
              <p className="text-muted-foreground mb-2 font-semibold text-sm">ITEMS</p>
              <ul className="space-y-2">
                {scannedOrder.items.map((item: any, idx: number) => (
                  <li key={idx} className="flex items-center text-foreground"><span className="text-accent mr-2">•</span>{item.name} x{item.qty}</li>
                ))}
              </ul>
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-border">
              <span className="text-lg font-semibold">Total Amount</span>
              <span className="text-2xl font-bold">₹{scannedOrder.totalPrice}</span>
            </div>
          </div>
          {!scannedOrder.needsPaymentConfirmation && (
            <div className="flex gap-4">
              <button onClick={handlePrintReceipt} className="flex-1 bg-primary text-primary-foreground px-6 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"><Printer className="h-5 w-5" /> Print Receipt</button>
              <button onClick={handleNewScan} className="flex-1 bg-muted text-foreground px-6 py-4 rounded-xl font-semibold transition-colors">New Scan</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
