import { useState, useEffect, useCallback } from "react";
import { Plus, Minus, Trash2, Printer, AlertCircle, Clock, ShoppingCart, Banknote, QrCode, CreditCard, ShoppingBag } from "lucide-react";
import { Link } from "react-router";
import { 
  orderService, 
  menuService, 
  timeSlotService, 
  fetchSettings, 
  printReceipt, 
  mapOrderToBill,
  mapOrderToKOTs,
  kotQueueService,
  Order,
  MenuItem,
  TimeSlot,
  stockService
} from "@messflow/shared-core";
import { toast } from "sonner";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  category?: string;
  gst?: number;
  isMRP?: boolean;
}

type PaymentMode = "upi" | "cash" | "card";

export function ShopOrderPage() {
  const [activeSlot, setActiveSlot] = useState<TimeSlot | null>(null);
  const [menu, setMenu] = useState<Record<string, MenuItem[]>>({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("upi");
  const [counters, setCounters] = useState<any[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const handleOfflineSync = useCallback(async (order: Order) => {
    if (!navigator.onLine) throw new Error("Offline");
    await orderService.pushActiveOrder(order);
    const allMenuItems = Object.values(menu).flat();
    await kotQueueService.routeOrderToCounters(order, counters, allMenuItems);
  }, [counters, menu]);

  const { isOffline, enqueue, pendingCount } = useOfflineQueue<Order>('offline_shop_orders', handleOfflineSync);

  useEffect(() => {
    const unsubSlot = timeSlotService.subscribeToActiveSlot(setActiveSlot);
    const unsubMenu = menuService.subscribeToMenu(setMenu);
    const unsubCounters = kotQueueService.subscribeKOTCounters(setCounters);
    fetchSettings().then(setSettings);
    return () => {
      unsubSlot();
      unsubMenu();
      unsubCounters();
    };
  }, []);

  const activeSlotKey = activeSlot ? activeSlot.name.toLowerCase() : "";
  // FILTER: Only MRP items
  const currentSlotMenu = activeSlot 
    ? (menu[activeSlotKey] || []).filter((item: MenuItem) => item.available && item.stock > 0 && item.isMRP) 
    : [];

  const quickItems = currentSlotMenu.slice(0, 4);

  if (!activeSlot) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Shop (MRP) Order</h1>
          <p className="text-muted-foreground">Quick sales for packaged MRP items</p>
        </div>
        <div className="bg-destructive/10 border-2 border-destructive rounded-2xl p-12 text-center">
          <div className="flex justify-center mb-6">
            <div className="p-8 rounded-full bg-destructive/20">
              <AlertCircle className="h-20 w-20 text-destructive" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">Mess is Closed</h2>
          <p className="text-muted-foreground mb-8">Shop ordering is only available when the mess is open.</p>
          <Link to="/time-slots" className="inline-flex items-center gap-2 bg-primary hover:bg-secondary text-primary-foreground px-6 py-3 rounded-xl font-semibold transition-colors">
            <Clock className="h-5 w-5" /> Manage Time Slots
          </Link>
        </div>
      </div>
    );
  }

  const addToCart = (item: any) => {
    const existingItem = cart.find((cartItem: CartItem) => cartItem.id === item.id);
    if (existingItem) {
      setCart(cart.map((cartItem: CartItem) => cartItem.id === item.id ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(cart.map((item: CartItem) => item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item).filter((item: CartItem) => item.quantity > 0));
  };

  const removeFromCart = (id: number) => {
    setCart(cart.filter((item: CartItem) => item.id !== id));
  };

  const subtotal = cart.reduce((sum: number, item: CartItem) => sum + item.price * item.quantity, 0);
  const totalGst = cart.reduce((sum: number, item: CartItem) => {
    const itemGst = Math.round(item.price * ((item.gst || 0) / 100));
    return sum + itemGst * item.quantity;
  }, 0);
  const total = subtotal + totalGst;
  
  const cartWithStockWarnings = cart.map((item: CartItem) => {
    const menuItem = (menu[activeSlotKey] || []).find((i: MenuItem) => i.id === item.id);
    const availableStock = menuItem?.stock || 0;
    return { ...item, availableStock, isOverdraft: item.quantity > availableStock };
  });
  const hasSufficientStock = !cartWithStockWarnings.some((item: any) => item.isOverdraft);

  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      toast.error("Please add items to cart");
      return;
    }
    if (!hasSufficientStock) {
      toast.error("Some items are out of stock.");
      return;
    }

    const orderId = `SHOP-${Date.now().toString().slice(-6)}`;
    const newOrder: Order = {
      id: orderId,
      userId: "SHOP",
      userRollNo: "MRP",
      items: cart.map((i: CartItem) => ({ id: i.id, name: i.name, price: i.price, qty: i.quantity })),
      totalPrice: total,
      status: "processing",
      payment_mode: paymentMode,
      slotName: activeSlotKey,
      slotTime: "N/A",
      orderNumber: Date.now() % 1000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isExternal: true,
      autoPrint: true
    } as any;

    try {
      for (const item of cart) {
        await stockService.decrementStock(item.id, item.quantity);
      }
      
      const allMenuItems = Object.values(menu).flat();
      
      if (isOffline) {
        enqueue(newOrder);
        toast.success(`Offline Shop Order Saved! ID: ${orderId}`);
      } else {
        await orderService.pushActiveOrder(newOrder);
        await kotQueueService.routeOrderToCounters(newOrder, counters, allMenuItems);
        toast.success(`Shop order placed successfully! ID: ${orderId}`);
      }

      const bill = mapOrderToBill(newOrder as any);
      const kots = mapOrderToKOTs(newOrder as any, allMenuItems);
      printReceipt([bill, ...kots], settings);
      
      setCart([]);
      setPaymentMode("upi");
      setShowPaymentModal(false);
    } catch (e) {
      console.error("Shop order failed", e);
      toast.error("Failed to place shop order.");
    }
  };

  return (
    <div className="space-y-6 print:hidden">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-foreground">Shop (MRP) Order</h1>
          {isOffline && (
            <span className="bg-destructive/10 text-destructive text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider animate-pulse flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> Offline
            </span>
          )}
          {pendingCount > 0 && (
            <span className="bg-secondary/10 text-secondary text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              {pendingCount} Pending Sync
            </span>
          )}
        </div>
        <p className="text-muted-foreground">Quick sales for packaged MRP items only</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          
          {quickItems.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-muted-foreground mb-3 uppercase tracking-wider">Quick Add</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {quickItems.map((item: MenuItem) => (
                  <button 
                    key={`quick-${item.id}`} 
                    onClick={() => addToCart(item)} 
                    className="bg-accent/10 hover:bg-accent hover:text-accent-foreground border border-accent/20 rounded-xl p-4 transition-all text-center group active:scale-95"
                  >
                    <div className="font-bold text-sm mb-1 truncate">{item.name}</div>
                    <div className="font-bold text-accent group-hover:text-accent-foreground">₹{Math.round(item.price * (1 + (item.gst || 0) / 100))}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-xl font-bold text-foreground mb-4">Shop Items</h2>
            {currentSlotMenu.length === 0 ? (
              <div className="bg-muted/50 border-2 border-dashed border-border rounded-2xl p-12 text-center">
                <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-bold text-foreground mb-1">No MRP Items</h3>
                <p className="text-muted-foreground">There are no MRP items available in the current slot.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {currentSlotMenu.map((item: MenuItem) => {
                  const finalPrice = Math.round(item.price * (1 + (item.gst || 0) / 100));
                  return (
                    <button key={item.id} onClick={() => addToCart(item)} className="bg-card hover:bg-accent hover:text-accent-foreground group text-foreground rounded-xl p-4 border border-border transition-all text-left shadow-sm active:scale-95 h-full flex flex-col justify-between">
                      <div>
                        <div className="font-bold mb-1">{item.name}</div>
                        <div className="text-sm opacity-70 mb-2">{item.category}</div>
                      </div>
                      <div>
                        <div className="font-bold text-lg">₹{item.price}</div>
                        <div className="text-[10px] opacity-80 mt-1 font-semibold">MRP Sales</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-card rounded-xl p-6 border border-border sticky top-6">
            <h2 className="text-xl font-bold text-foreground mb-4 text-accent">Shop Cart</h2>
            {cart.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingCart className="h-10 w-10 mx-auto opacity-30 mb-3" />
                <p>No items in cart</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-6 max-h-96 overflow-y-auto pr-2">
                  {cart.map((item: CartItem) => (
                    <div key={item.id} className="bg-muted rounded-lg p-3 flex flex-col gap-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-foreground text-sm leading-tight">{item.name}</div>
                          <div className="text-[10px] text-muted-foreground mt-1">₹{item.price} (MRP)</div>
                        </div>
                        <div className="font-bold text-foreground text-right w-16 text-sm">₹{item.price * item.quantity}</div>
                      </div>
                      <div className="flex items-center justify-between border-t border-border pt-2 mt-1">
                        <div className="text-[10px] text-muted-foreground">Qty: {item.quantity}</div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateQuantity(item.id, -1)} className="p-2 rounded-lg bg-background hover:bg-accent hover:text-accent-foreground"><Minus className="h-3 w-3" /></button>
                          <button onClick={() => updateQuantity(item.id, 1)} className="p-2 rounded-lg bg-background hover:bg-accent hover:text-accent-foreground"><Plus className="h-3 w-3" /></button>
                          <button onClick={() => removeFromCart(item.id)} className="p-2 rounded-lg bg-destructive/10 text-destructive ml-1"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="border-t border-border pt-4 mb-4">
                  <div className="flex justify-between items-center text-lg mb-4">
                    <span className="font-bold text-foreground">Total</span>
                    <span className="font-bold text-accent text-2xl">₹{total}</span>
                  </div>
                  
                  <div className="space-y-2 mb-6">
                    <p className="text-xs font-bold text-muted-foreground uppercase">Payment Mode</p>
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => setPaymentMode("upi")} className={`py-2 px-3 rounded-lg flex flex-col items-center gap-1 text-xs font-bold transition-all border-2 ${paymentMode === "upi" ? "bg-accent/20 border-accent text-accent" : "bg-muted border-transparent text-muted-foreground"}`}>
                        <QrCode className="w-5 h-5" /> UPI
                      </button>
                      <button onClick={() => setPaymentMode("cash")} className={`py-2 px-3 rounded-lg flex flex-col items-center gap-1 text-xs font-bold transition-all border-2 ${paymentMode === "cash" ? "bg-accent/20 border-accent text-accent" : "bg-muted border-transparent text-muted-foreground"}`}>
                        <Banknote className="w-5 h-5" /> Cash
                      </button>
                      <button onClick={() => setPaymentMode("card")} className={`py-2 px-3 rounded-lg flex flex-col items-center gap-1 text-xs font-bold transition-all border-2 ${paymentMode === "card" ? "bg-accent/20 border-accent text-accent" : "bg-muted border-transparent text-muted-foreground"}`}>
                        <CreditCard className="w-5 h-5" /> Card
                      </button>
                    </div>
                  </div>
                </div>

                <button onClick={() => setShowPaymentModal(true)} disabled={cart.length === 0 || !hasSufficientStock} className="w-full h-16 bg-accent hover:bg-accent/80 text-accent-foreground rounded-xl font-black text-lg flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-[0_4px_14px_0_rgba(100,255,218,0.2)] disabled:opacity-50 disabled:shadow-none disabled:active:scale-100">
                  <Printer className="h-6 w-6" /> {!hasSufficientStock ? "Out of Stock" : `Pay ₹${total} & Print`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md rounded-2xl p-8 shadow-2xl border border-border animate-in fade-in zoom-in-95">
            <div className="flex justify-center mb-6">
              <div className="p-6 rounded-full bg-accent/20">
                <Banknote className="h-16 w-16 text-accent" />
              </div>
            </div>
            
            <h2 className="text-2xl font-black text-foreground text-center mb-2">Confirm Shop Sale</h2>
            <p className="text-muted-foreground text-center mb-6">Confirm payment of ₹{total} via {paymentMode.toUpperCase()}</p>
            
            <div className="bg-muted rounded-xl p-4 mb-8">
              <div className="flex justify-between items-center mb-2">
                <span className="text-muted-foreground font-semibold">Total Amount</span>
                <span className="text-xl font-bold text-accent">₹{total}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-semibold">Payment Mode</span>
                <span className="font-bold uppercase bg-background px-2 py-1 rounded text-sm">{paymentMode}</span>
              </div>
            </div>
            
            <div className="flex gap-4">
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 py-4 bg-muted text-foreground font-bold rounded-xl hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handlePlaceOrder}
                className="flex-1 py-4 bg-accent text-accent-foreground font-bold rounded-xl shadow-lg hover:bg-accent/80 transition-transform active:scale-95 flex justify-center items-center gap-2"
              >
                <Printer className="w-5 h-5" /> Confirm & Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
