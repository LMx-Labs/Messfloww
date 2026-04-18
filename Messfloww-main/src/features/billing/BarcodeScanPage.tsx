import { useState, useEffect } from "react";
import { ScanBarcode, Check, Printer, AlertCircle, Clock } from "lucide-react";
import { useTimeSlots } from "../../features/timeslots/TimeSlotContext";
import { Link } from "react-router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../core/firebase";
import { fetchSettings } from "../settings/settingsService";
import { kitchenService } from "../kitchen/kitchenService";
import { parseQRCodeValue } from "../../app/utils/qrParser";
import { printReceipt, mapOrderToBill } from "../../app/modules/ThermalPrinter";
import { toast } from "sonner";

export function BarcodeScanPage() {
  const { activeSlot } = useTimeSlots();
  const [scannedOrder, setScannedOrder] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [error, setError] = useState("");
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    fetchSettings().then(setSettings);
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

  const handleScan = async (barcode?: string) => {
    const rawInput = barcode || barcodeInput;
    if (!rawInput) return;
    
    setScanning(true);
    setError("");
    
    try {
      const parsedQR = parseQRCodeValue(rawInput);
      const orderId = parsedQR ? parsedQR.orderId : rawInput;

      const activeOrder = await kitchenService.getActiveOrderById(orderId);
      
      if (activeOrder) {
        if (parsedQR && parsedQR.ts) {
          const timeDiff = Date.now() - parsedQR.ts;
          if (timeDiff > 60000 || timeDiff < -10000) {
            setError("QR Code expired! Please show the live and scanning QR code from the app.");
            setScanning(false);
            return;
          }
        } else if (rawInput.startsWith('MESSFLOWW|')) {
           setError("Invalid QR format. Please use the live QR code.");
           setScanning(false);
           return;
        }

        if (activeOrder.qrUsed) {
          setError("Order already collected (QR Used)");
          setScanning(false);
          return;
        }

        activeOrder.qrUsed = true;
        await kitchenService.updateActiveOrderStatus(orderId, 'qrUsed', true as any); 
        await kitchenService.updateActiveOrderStatus(orderId, 'status', 'completed');
        
        setScannedOrder({ id: activeOrder.id, ...activeOrder });
        setBarcodeInput("");
        
        setTimeout(() => {
          printReceipt(mapOrderToBill(activeOrder), settings);
        }, 500);

      } else {
        const histRef = doc(db, "historical_orders", orderId);
        const histDoc = await getDoc(histRef);
        if (histDoc.exists()) {
          setError("Order already collected or cancelled");
        } else {
          setError("Invalid QR Code or Order not found");
        }
      }
    } catch (e) {
      console.error("Scan failed", e);
      setError("Error finding order");
    } finally {
      setScanning(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && barcodeInput.trim()) handleScan(barcodeInput);
  };

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
        <h1 className="text-3xl font-bold text-foreground mb-2">Barcode Scanner</h1>
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
          <input type="text" value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} onKeyPress={handleKeyPress} placeholder="Enter barcode number" disabled={scanning} autoFocus className="w-full max-w-md mx-auto bg-input-background text-foreground px-6 py-4 rounded-xl border-2 border-border focus:outline-none focus:ring-2 focus:ring-primary text-center text-lg font-semibold" />
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
