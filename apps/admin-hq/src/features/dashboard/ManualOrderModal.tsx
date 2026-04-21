import { useState, useEffect } from "react";
import { X, ShoppingCart, Loader2, Minus, Plus, Trash2, Printer } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { 
  MenuItem, 
  menuService, 
  kotQueueService, 
  orderService, 
  printReceipt, 
  mapOrderToBill, 
  mapOrderToKOTs,
  TimeSlot,
  timeSlotService,
  stockService
} from "@messflow/shared-core";

interface ManualOrderItem extends MenuItem {
  qty: number;
}
type CounterPaymentMode = 'cash' | 'upi';

interface ManualOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ManualOrderModal({ isOpen, onClose }: ManualOrderModalProps) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<ManualOrderItem[]>([]);
  const [counters, setCounters] = useState<any[]>([]);
  const [paymentMode, setPaymentMode] = useState<CounterPaymentMode>('cash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeSlot, setActiveSlot] = useState<TimeSlot | null>(null);

  useEffect(() => {
    if (isOpen) {
      const unsubMenu = menuService.subscribeToMenu((data) => {
        setMenuItems(Object.values(data).flat());
      });
      const unsubCounters = kotQueueService.subscribeKOTCounters(setCounters);
      const unsubSlot = timeSlotService.subscribeToActiveSlot(setActiveSlot);
      return () => {
        unsubMenu();
        unsubCounters();
        unsubSlot();
      };
    }
  }, [isOpen]);

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const updateQty = (id: number, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id === id) {
        const newQty = i.qty + delta;
        return newQty > 0 ? { ...i, qty: newQty } : null;
      }
      return i;
    }).filter(Boolean) as ManualOrderItem[]);
  };

  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const handleCompleteOrder = async () => {
    if (cart.length === 0) return;
    if (!activeSlot) {
      toast.error("No active meal slot.");
      return;
    }
    setIsProcessing(true);
    
    try {
      const { generateOrderID } = await import("@messflow/shared-core");
      const orderId = generateOrderID("EXTERNAL");
      const orderNumber = Date.now() % 1000;
      
      const newOrder = {
        id: orderId,
        userId: "EXTERNAL",
        userRollNo: "COUNTER-ORDER",
        items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
        totalPrice,
        status: "processing", // Skip pending since it's already paid at counter
        payment_mode: paymentMode,
        paymentStatus: "PAID",
        slotName: activeSlot.name,
        orderNumber,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        autoPrint: true,
        qrUsed: true,
        externalLabel: paymentMode.toUpperCase()
      };

      // Push order
      await orderService.pushActiveOrder(newOrder);

      // Decrement stock manually for counter orders
      for (const item of cart) {
        await stockService.decrementStock(item.id, item.qty);
      }

      // Route to KOT printers
      await kotQueueService.routeOrderToCounters(newOrder, counters, menuItems);
      
      // Local admin receipt
      setTimeout(() => {
        const bill = mapOrderToBill(newOrder);
        const kots = mapOrderToKOTs(newOrder, menuItems);
        printReceipt([bill, ...kots], null); // Default settings
      }, 500);

      toast.success("Order Placed & Printing");
      setCart([]);
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to place order");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-card w-full max-w-4xl max-h-[90vh] rounded-3xl border border-border shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-border flex items-center justify-between bg-card shrink-0">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Manual Counter Order</h2>
              <p className="text-muted-foreground text-sm">Create orders for walk-ins</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
              <X className="w-6 h-6 text-muted-foreground" />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden min-h-[400px]">
            {/* Menu Section */}
            <div className="w-2/3 border-r border-border p-6 overflow-y-auto">
              {!activeSlot ? (
                <div className="text-center text-muted-foreground mt-10">Mess is currently closed.</div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {menuItems.filter(i => i.isAvailable && i.category !== 'mrp').map(item => (
                    <button
                      key={item.id}
                      onClick={() => addToCart(item)}
                      className="p-4 rounded-2xl border border-border bg-muted/20 hover:bg-muted/40 transition-colors text-left flex flex-col"
                    >
                      <span className="font-bold text-foreground">{item.name}</span>
                      <span className="text-accent font-semibold mt-1">₹{item.price}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Cart Section */}
            <div className="w-1/3 flex flex-col bg-muted/10">
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <ShoppingCart className="w-12 h-12 mb-2 opacity-20" />
                    <p>Cart is empty</p>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="bg-card p-3 rounded-xl border border-border flex flex-col gap-2 shadow-sm">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-sm">{item.name}</span>
                        <span className="font-bold text-accent">₹{item.price * item.qty}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 bg-muted rounded-full flex items-center justify-center hover:bg-destructive/20 hover:text-destructive transition-colors"><Minus className="w-3 h-3" /></button>
                        <span className="text-sm font-bold min-w-[1rem] text-center">{item.qty}</span>
                        <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 bg-muted rounded-full flex items-center justify-center hover:bg-accent/20 hover:text-accent transition-colors"><Plus className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Checkout Footer */}
              <div className="p-4 bg-card border-t border-border space-y-4 shrink-0">
                <div className="flex justify-between items-center text-lg font-black">
                  <span>Total</span>
                  <span className="text-2xl text-accent">₹{totalPrice}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setPaymentMode('cash')} 
                    className={`py-2 px-3 rounded-xl text-sm font-bold transition-colors border-2 ${paymentMode === 'cash' ? 'border-accent bg-accent/10 text-accent' : 'border-transparent bg-muted text-muted-foreground'}`}
                  >
                    Cash
                  </button>
                  <button 
                    onClick={() => setPaymentMode('upi')} 
                    className={`py-2 px-3 rounded-xl text-sm font-bold transition-colors border-2 ${paymentMode === 'upi' ? 'border-accent bg-accent/10 text-accent' : 'border-transparent bg-muted text-muted-foreground'}`}
                  >
                    UPI QR
                  </button>
                </div>

                <button
                  onClick={handleCompleteOrder}
                  disabled={cart.length === 0 || isProcessing}
                  className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 transition-all hover:bg-primary/90 disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
                  Complete & Print
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
