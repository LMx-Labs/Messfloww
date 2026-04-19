import { useState, useEffect, useRef, useCallback } from "react";
import { ScanBarcode, Check, Printer, AlertCircle, Clock } from "lucide-react";
import { useTimeSlots } from "../../features/timeslots/TimeSlotContext";
import { useMenu } from "../../features/menu/MenuContext";
import { Link } from "react-router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../core/firebase";
import { fetchSettings } from "../settings/settingsService";
import { kitchenService } from "../kitchen/kitchenService";
import { parseQRCodeValue } from "../../app/utils/qrParser";
import { printReceipt, mapOrderToBill, mapOrderToKOTs } from "../../app/modules/ThermalPrinter";
import { toast } from "sonner";

export function BarcodeScanPage() {
  const { activeSlot } = useTimeSlots();
  const { menu } = useMenu();
  const [scannedOrder, setScannedOrder] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scanningRef = useRef(false);
  const [settings, setSettings] = useState<any>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    fetchSettings().then(setSettings);

    const checkQueueAndSync = async () => {
      const queue = JSON.parse(localStorage.getItem('offlineScanQueue') || '[]');
      if (queue.length > 0) {
        toast.info(`Syncing ${queue.length} offline scans...`);
        let syncedCount = 0;
        const newQueue = [];
        
        for (const scanStr of queue) {
          try {
            await kitchenService.atomicCollectOrder(scanStr);
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
    };
  }, []);

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

  const handleScan = useCallback(async (rawInput: string) => {
    const trimmed = rawInput.trim();
    if (!trimmed || scanningRef.current) return;
    
    scanningRef.current = true;
    setScanning(true);
    setError("");
    
    try {
      const parsedQR = parseQRCodeValue(trimmed);
      let orderId = parsedQR ? parsedQR.orderId : trimmed;

      let activeOrder = null;
      
      if (isOffline) {
        const cache = JSON.parse(localStorage.getItem('offline_orders_cache') || '[]');
        activeOrder = cache.find((o: any) => o.id === orderId || o.orderNumber?.toString() === orderId || o.userRollNo === orderId);
        if (activeOrder) orderId = activeOrder.id;
      } else {
        activeOrder = await kitchenService.getActiveOrderById(orderId);
        
        if (!activeOrder && !parsedQR) {
          activeOrder = await kitchenService.getActiveOrderSearchFallback(trimmed);
          if (activeOrder) {
            orderId = activeOrder.id;
          }
        }
      }
      
      if (activeOrder) {
        if (!parsedQR && trimmed.startsWith('MESSFLOWW|')) {
           setError("Invalid QR format. Please try scanning again.");
           return;
        }

        if (activeOrder.qrUsed || activeOrder.status === 'collected') {
          setError("Order already collected (QR Used)");
          return;
        }

        let collectedOrder;
        
        if (isOffline) {
          collectedOrder = { ...activeOrder, status: 'collected', qrUsed: true };
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
          collectedOrder = await kitchenService.atomicCollectOrder(orderId);
        }

        setScannedOrder({ id: collectedOrder.id, ...collectedOrder });
        
        setTimeout(() => {
          const allMenuItems = Object.values(menu).flat();
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
            return;
          }
        }
        setError("Invalid QR Code or Order not found");
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
  }, [settings]);

  // Physical barcode scanners type characters rapidly then fire Enter.
  // Reading from the DOM ref avoids React state batching lag.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const value = inputRef.current?.value || barcodeInput;
      if (value.trim()) handleScan(value);
    }
  };

  // Auto-focus the input on mount and when returning to scan mode
  useEffect(() => {
    if (!scannedOrder && inputRef.current) {
      inputRef.current.focus();
    }
  }, [scannedOrder]);

  const handlePrintReceipt = () => {
    if (scannedOrder) printReceipt(mapOrderToBill(scannedOrder), settings);
  };

  const handleNewScan = () => {
    setScannedOrder(null);
    setBarcodeInput("");
    setError("");
  };

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
        <p className="text-muted-foreground">Scan customer barcode to complete order pickup</p>
      </div>

      {!scannedOrder ? (
        <div className="bg-card rounded-2xl p-12 border-2 border-dashed border-border text-center">
          <div className="flex justify-center mb-6">
            <div className={`p-8 rounded-full ${scanning ? 'bg-secondary/20 animate-pulse' : 'bg-primary/20'}`}>
              <ScanBarcode className={`h-20 w-20 ${scanning ? 'text-secondary' : 'text-primary'}`} />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">{scanning ? "Scanning..." : "Enter Barcode Number"}</h2>
          <p className="text-muted-foreground mb-8">Type the barcode and press Enter to search</p>
          {error && <div className="mb-6 bg-destructive/10 text-destructive text-sm font-semibold p-3 rounded-lg border border-destructive/20 animate-in fade-in slide-in-from-top-2">{error}</div>}
          <input ref={inputRef} type="text" defaultValue="" onChange={(e) => setBarcodeInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Scan QR code or type barcode" disabled={scanning} autoFocus className="w-full max-w-md mx-auto bg-input-background text-foreground px-6 py-4 rounded-xl border-2 border-border focus:outline-none focus:ring-2 focus:ring-primary text-center text-lg font-semibold" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-accent/20 border-2 border-accent rounded-2xl p-8 text-center">
            <div className="flex justify-center mb-4"><div className="p-6 rounded-full bg-accent"><Check className="h-12 w-12 text-accent-foreground" /></div></div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Order Completed!</h2>
          </div>
          <div className="bg-card rounded-xl p-6 border border-border">
            <h3 className="text-lg font-bold text-foreground mb-4">Order Details</h3>
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
          <div className="flex gap-4">
            <button onClick={handlePrintReceipt} className="flex-1 bg-primary text-primary-foreground px-6 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"><Printer className="h-5 w-5" /> Print Receipt</button>
            <button onClick={handleNewScan} className="flex-1 bg-muted text-foreground px-6 py-4 rounded-xl font-semibold transition-colors">New Scan</button>
          </div>
        </div>
      )}
    </div>
  );
}
