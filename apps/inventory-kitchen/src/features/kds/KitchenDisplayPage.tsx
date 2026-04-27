import { useState, useEffect, useRef } from "react";
import { ChefHat, Printer, CheckCircle2, Loader2, AlertCircle, Moon } from "lucide-react";
import { 
  orderService, 
  menuService, 
  kotQueueService, 
  fetchSettings, 
  printReceiptSilent, 
  mapOrderToKOTs,
  Order,
  MenuItem
} from "@messflow/shared-core";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

export function KitchenDisplayPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [counters, setCounters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>(null);
  
  const [menu, setMenu] = useState<Record<string, MenuItem[]>>({});
  const allMenuItems = Object.values(menu).flat();
  
  const routedOrders = useRef<Set<string>>(new Set());
  const autoPrintedOrders = useRef<Set<string>>(new Set());

  const [autoPrint, setAutoPrint] = useState<boolean>(() => {
    return localStorage.getItem('kds_autoPrint') !== 'false'; // default: ON
  });

  const toggleAutoPrint = () => {
    setAutoPrint(prev => {
      const next = !prev;
      localStorage.setItem('kds_autoPrint', String(next));
      return next;
    });
  };

  useEffect(() => {
    fetchSettings().then(setSettings);
    const unsubMenu = menuService.subscribeToMenu(setMenu);

    const countersUnsub = kotQueueService.subscribeKOTCounters((data) => {
      setCounters(data);
    });
    
    const ordersUnsub = orderService.subscribeActiveOrders((allOrders) => {
      const newOrders = allOrders.filter(o => o.status === "ordered" || o.status === "processing" || o.status === "preparing");
      
      if (newOrders.length > 0 && counters.length > 0) {
        const toRoute = newOrders.filter(o => !routedOrders.current.has(o.id));
        toRoute.forEach(order => {
          routedOrders.current.add(order.id);
          // Only route if it hasn't been routed (like Student app 'ordered' ones)
          // External/Scan orders might already be routed, but kotQueueService handles idempotency.
          kotQueueService.routeOrderToCounters(order, counters, allMenuItems);
        });
      }
      if (autoPrint) {
        newOrders
          .filter(o => o.autoPrint && !autoPrintedOrders.current.has(o.id))
          .forEach(order => {
            autoPrintedOrders.current.add(order.id);
            printReceiptSilent(mapOrderToKOTs(order as any, allMenuItems), settings);
          });
      }
      
      setOrders(newOrders);
      setLoading(false);
    });

    return () => {
      countersUnsub();
      ordersUnsub();
      unsubMenu();
    };
  }, [counters.length, allMenuItems.length, autoPrint, settings]);

  const markAsReady = async (orderId: string, orderNumber: number) => {
    try {
      await orderService.markOrderReady(orderId);
      toast.success(`Order #${orderNumber} is Ready!`);
    } catch (error) {
       toast.error("Failed to update status");
    }
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-xl"><ChefHat className="w-8 h-8 text-primary" /></div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Kitchen Display</h1>
            <p className="text-muted-foreground">Manage incoming orders and auto-print KOTs</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            id="kds-auto-print-toggle"
            onClick={toggleAutoPrint}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all border-2 ${
              autoPrint
                ? 'bg-accent/20 border-accent text-accent'
                : 'bg-muted border-border text-muted-foreground'
            }`}
          >
            <Printer className="w-4 h-4" />
            Auto-Print: {autoPrint ? 'ON' : 'OFF'}
          </button>
          <button onClick={() => window.open("/kot-control", "_self")} className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold transition-all shadow-sm">
            <Printer className="w-5 h-5" /> KOT Control Center
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {orders.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full py-20 text-center space-y-4 bg-card rounded-3xl border-2 border-dashed border-border">
              <h2 className="text-xl font-semibold text-muted-foreground">All caught up! No pending orders.</h2>
            </motion.div>
          ) : (
            orders.map((order) => (
              <motion.div layout key={order.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-card border-2 border-border rounded-3xl overflow-hidden flex flex-col shadow-sm">
                <div className="p-5 border-b border-border bg-muted/30 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-black">#{order.orderNumber}</span>
                    {(order.isExternal || order.isCounterOrder) && (
                      <div className="w-8 h-8 bg-indigo-500/10 rounded-full flex items-center justify-center" title="Night Mess / External Order">
                        <Moon className="w-4 h-4 text-indigo-500" />
                      </div>
                    )}
                  </div>
                  <div className="px-3 py-1 bg-amber-500/10 text-amber-500 rounded-full text-[10px] font-black uppercase tracking-widest">{order.status}</div>
                </div>
                <div className="p-5 flex-grow space-y-4">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center font-black text-primary">{item.qty}</div>
                      <p className="text-lg font-bold truncate">{item.name}</p>
                    </div>
                  ))}
                </div>
                <div className="p-4 bg-muted/10 border-t border-border flex gap-3">
                  <button onClick={async () => {
                    printReceiptSilent(mapOrderToKOTs(order as any, allMenuItems), settings);
                    await orderService.updateOrderStatus(order.id, 'status', 'preparing');
                  }} className="flex-1 py-3 bg-indigo-500/10 text-indigo-500 rounded-xl font-bold text-sm">Print</button>
                  <button onClick={() => markAsReady(order.id, order.orderNumber!)} className="flex-1 py-3 bg-accent text-accent-foreground rounded-xl font-bold text-sm">Ready</button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
