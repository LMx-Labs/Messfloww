import { useState, useEffect, useRef } from "react";
import { ChefHat, Printer, CheckCircle2, Loader2, AlertCircle, Play, Pause } from "lucide-react";
import { fetchSettings } from "../services/firestoreService";
import { rtdbService } from "../services/rtdbService";
import { Order } from "../context/OrderContext";
import { useMenu } from "../context/MenuContext";
import { printReceipt, mapOrderToBill, mapOrderToKOTs } from "../modules/ThermalPrinter";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { kotService, KOTCounter } from "../services/kotService";

export function KitchenDisplay() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [counters, setCounters] = useState<KOTCounter[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>(null);
  
  const { menu } = useMenu();
  const allMenuItems = Object.values(menu).flat();
  
  // Track routed order IDs in this session to avoid double-routing
  const routedOrders = useRef<Set<string>>(new Set());

  useEffect(() => {
    fetchSettings().then(setSettings);

    // Subscribe to counters for routing
    const countersUnsub = rtdbService.subscribeKOTCounters((data) => {
      setCounters(data);
    });
    
    const ordersUnsub = rtdbService.subscribeActiveOrders((allOrders) => {
      // Only care about newly placed orders for this display
      const newOrders = allOrders.filter(o => o.status === "ordered");
      
      // Auto-routing logic
      if (newOrders.length > 0 && counters.length > 0) {
        const toRoute = newOrders.filter(o => !routedOrders.current.has(o.id));
        
        toRoute.forEach(order => {
          routedOrders.current.add(order.id);
          kotService.routeOrderToCounters(order, counters, allMenuItems);
        });
      }
      
      setOrders(newOrders);
      setLoading(false);
    });

    return () => {
      countersUnsub();
      ordersUnsub();
    };
  }, [counters.length, allMenuItems.length]);

  const toggleAutoPrint = () => {
    toast.info("Auto-print is now managed in the KOT Control Center per counter.");
  };

  const markAsReady = async (orderId: string, orderNumber: number) => {
    try {
      await rtdbService.updateActiveOrderStatus(orderId, 'status', 'ready');
      toast.success(`Order #${orderNumber} is Ready!`);
    } catch (error) {
       toast.error("Failed to update status");
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-xl">
            <ChefHat className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Kitchen Display</h1>
            <p className="text-muted-foreground">Manage incoming orders and auto-print KOTs</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.open("/kot-control", "_self")}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold transition-all shadow-sm hover:scale-105 active:scale-95"
          >
            <Printer className="w-5 h-5" />
            KOT Control Center
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {orders.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-full py-20 text-center space-y-4 bg-card rounded-3xl border-2 border-dashed border-border"
            >
              <div className="flex justify-center">
                <div className="p-6 bg-muted rounded-full">
                  <CheckCircle2 className="w-12 h-12 text-muted-foreground opacity-20" />
                </div>
              </div>
              <h2 className="text-xl font-semibold text-muted-foreground">All caught up! No pending orders.</h2>
              <p className="text-sm text-muted-foreground/60 max-w-xs mx-auto">
                New orders from students will appear here automatically in real-time.
              </p>
            </motion.div>
          ) : (
            orders.map((order) => (
              <motion.div
                layout
                key={order.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-card border-2 border-border rounded-3xl overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Card Header */}
                <div className="p-5 border-b border-border bg-muted/30 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-black text-foreground">#{order.orderNumber}</span>
                    <div className="flex flex-col">
                      <span className="text-xs uppercase font-bold tracking-widest text-muted-foreground">{order.slotName}</span>
                      <span className="text-[10px] text-muted-foreground/60">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-full text-[10px] font-black uppercase tracking-widest">
                    Order Placed
                  </div>
                </div>

                {/* Items List */}
                <div className="p-5 flex-grow space-y-4">
                  <div className="space-y-3">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center font-black text-primary">
                          {item.qty}
                        </div>
                        <div className="flex-grow pt-0.5">
                          <p className="text-lg font-bold text-foreground leading-tight">{item.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 bg-muted/10 border-t border-border flex gap-3">
                  <button
                    onClick={async () => {
                      printReceipt(mapOrderToKOTs(order, allMenuItems), settings);
                      await rtdbService.updateActiveOrderStatus(order.id, 'status', 'preparing');
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 rounded-xl font-bold text-sm transition-colors border border-indigo-500/20"
                  >
                    <Printer className="w-4 h-4" />
                    Print & Prepare
                  </button>
                  <button
                    onClick={() => markAsReady(order.id, order.orderNumber)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-accent hover:bg-green-600 text-accent-foreground rounded-xl font-bold text-sm transition-colors shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Ready
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Silent Printer Disclaimer */}
      <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 flex items-start gap-4">
        <AlertCircle className="w-6 h-6 text-primary shrink-0 mt-1" />
        <div className="space-y-1">
          <h4 className="font-bold text-foreground">Auto-Printing Tip</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            To make KOTs print without showing a dialogue box, launch Chrome in <span className="font-bold text-primary">Kiosk Printing Mode</span> by adding <code className="bg-primary/10 px-1.5 py-0.5 rounded text-primary font-mono text-xs">--kiosk-printing</code> to your browser shortcut properties.
          </p>
        </div>
      </div>


    </div>
  );
}
