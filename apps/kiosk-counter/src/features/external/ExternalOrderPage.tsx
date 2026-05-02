import { useState, useEffect, useCallback } from "react";
import { Plus, Minus, Trash2, Printer, AlertCircle, Clock, ShoppingCart, Banknote, QrCode, CreditCard } from "lucide-react";
import { Link } from "react-router";
import { 
  orderService, 
  menuService, 
  timeSlotService, 
  fetchSettings, 
  printReceiptSilent, 
  mapOrderToBill,
  mapOrderToKOTs,
  kotQueueService,
  Order,
  MenuItem,
  TimeSlot
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

export function ExternalOrderPage() {
  const [activeSlot, setActiveSlot] = useState<TimeSlot | null>(null);
  const [menu, setMenu] = useState<Record<string, MenuItem[]>>({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("upi");
  const [counters, setCounters] = useState<any[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const handleOfflineSync = useCallback(async (order: Order) => {
    // Only try to sync if we're actually online to avoid unnecessary throws
    if (!navigator.onLine) throw new Error("Offline");
    
    // We already have the order id and order number generated locally
    await orderService.placeKioskOrderWithAtomicStock(
      'external',
      order.items,
      order.totalPrice,
      order.slotName,
      order.payment_mode || 'cash',
      undefined,
      order.id,
      order.orderNumber
    );

    const allMenuItems = Object.values(menu).flat();
    await kotQueueService.routeOrderToCounters(order, counters, allMenuItems);
  }, [counters, menu]);

  const { isOffline, enqueue, pendingCount } = useOfflineQueue<Order>('offline_external_orders', handleOfflineSync);

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
  const currentSlotMenu = activeSlot ? (menu[activeSlotKey] || []).filter((item: MenuItem) => item.available && item.stock > 0) : [];

  // Sort by popularity or just take the first few for "Favourites"
  const quickItems = currentSlotMenu.slice(0, 4);

  if (!activeSlot) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">External / Shop Order</h1>
          <p className="text-muted-foreground">Place orders for walk-in customers or shop sales</p>
        </div>
        <div className="bg-destructive/10 border-2 border-destructive rounded-2xl p-12 text-center">
          <div className="flex justify-center mb-6">
            <div className="p-8 rounded-full bg-destructive/20">
              <AlertCircle className="h-20 w-20 text-destructive" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">Mess is Closed</h2>
          <p className="text-muted-foreground mb-8">External ordering is only available when the mess is open.</p>
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
    if (counters.length === 0) {
      toast.warning('Counter config not loaded yet. Please wait a moment.');
      return;
    }

    const orderId = `EXT-${Date.now().toString().slice(-6)}`;
    const orderNumber = Date.now() % 1000;
    const newOrder: Order = {
      id: orderId,
      userId: "EXTERNAL",
      userRollNo: "SHOP",
      items: cart.map((i: CartItem) => ({ id: i.id, name: i.name, price: i.price, qty: i.quantity })),
      totalPrice: total,
      status: "processing", // External orders go straight to kitchen
      paymentStatus: 'PAID',
      payment_mode: paymentMode,
      slotName: activeSlotKey,
      slotTime: "N/A",
      orderNumber: orderNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isExternal: true,
      autoPrint: true
    } as any;

    try {
      const allMenuItems = Object.values(menu).flat();
      
      if (isOffline) {
        enqueue(newOrder);
        toast.success(`Offline Order Saved! ID: ${orderId}`);
      } else {
        const itemsToOrder = cart.map((i: CartItem) => ({ id: i.id, name: i.name, price: i.price, qty: i.quantity }));
        await orderService.placeKioskOrderWithAtomicStock(
          'external',
          itemsToOrder,
          total,
          activeSlotKey,
          paymentMode,
          undefined,
          orderId,
          orderNumber
        );
        await kotQueueService.routeOrderToCounters(newOrder, counters, allMenuItems);
        toast.success(`Order placed successfully! ID: ${orderId}`);
      }

      // Always print locally instantly
      const bill = mapOrderToBill(newOrder as any);
      const kots = mapOrderToKOTs(newOrder as any, allMenuItems);
      printReceiptSilent([bill, ...kots], settings);
      
      setCart([]);
      setPaymentMode("upi");
      setShowPaymentModal(false);
    } catch (e) {
      console.error("External order failed", e);
      toast.error("Failed to place order.");
    }
  };

  return (
    <div className="space-y-6 print:hidden">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-foreground">External / Shop Order</h1>
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
        <p className="text-muted-foreground">Place orders for walk-in customers or shop sales</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          
          {/* Quick Add Row */}
          {quickItems.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-muted-foreground mb-3 uppercase tracking-wider">Quick Add</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {quickItems.map((item: MenuItem) => (
                  <button 
                    key={`quick-${item.id}`} 
                    onClick={() => addToCart(item)} 
                    className="bg-primary/10 hover:bg-primary hover:text-primary-foreground border border-primary/20 rounded-xl p-4 transition-all text-center group active:scale-95"
                  >
                    <div className="font-bold text-sm mb-1 truncate">{item.name}</div>
                    <div className="font-bold text-primary group-hover:text-primary-foreground">₹{Math.round(item.price * (1 + (item.gst || 0) / 100))}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-xl font-bold text-foreground mb-4">All Items</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {currentSlotMenu.map((item: MenuItem) => {
                const finalPrice = Math.round(item.price * (1 + (item.gst || 0) / 100));
                return (
                  <button key={item.id} onClick={() => addToCart(item)} className="bg-card hover:bg-primary hover:text-primary-foreground group text-foreground rounded-xl p-4 border border-border transition-all text-left shadow-sm active:scale-95 h-full flex flex-col justify-between">
                    <div>
                      <div className="font-bold mb-1">
                        {item.name}
                        {item.servingSize && item.quantityUnit && (
                          <span className="ml-2 text-xs opacity-80 font-normal">({item.servingSize} {item.quantityUnit})</span>
                        )}
                      </div>
                      {item.description && <div className="text-[10px] opacity-70 mb-1 leading-tight line-clamp-2">{item.description}</div>}
                      <div className="text-xs font-semibold opacity-70 mb-2">{item.category}</div>
                    </div>
                    <div>
                      <div className="font-bold text-lg">{item.isMRP ? `MRP ₹${item.price}` : `₹${item.price}`}</div>
                      <div className="text-[10px] opacity-80 mt-1 font-semibold">Final: ₹{finalPrice}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-card rounded-xl p-6 border border-border sticky top-6">
            <h2 className="text-xl font-bold text-foreground mb-4">Cart</h2>
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
                          <div className="text-[10px] text-muted-foreground mt-1">₹{item.price} + GST</div>
                        </div>
                        <div className="font-bold text-foreground text-right w-16 text-sm">₹{Math.round(item.price * (1 + (item.gst || 0) / 100)) * item.quantity}</div>
                      </div>
                      <div className="flex items-center justify-between border-t border-border pt-2 mt-1">
                        <div className="text-[10px] text-muted-foreground">Qty: {item.quantity}</div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateQuantity(item.id, -1)} className="p-2 rounded-lg bg-background hover:bg-primary hover:text-primary-foreground"><Minus className="h-3 w-3" /></button>
                          <button onClick={() => updateQuantity(item.id, 1)} className="p-2 rounded-lg bg-background hover:bg-primary hover:text-primary-foreground"><Plus className="h-3 w-3" /></button>
                          <button onClick={() => removeFromCart(item.id)} className="p-2 rounded-lg bg-destructive/10 text-destructive ml-1"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="border-t border-border pt-4 mb-4">
                  <div className="flex justify-between items-center text-lg mb-4">
                    <span className="font-bold text-foreground">Total</span>
                    <span className="font-bold text-primary text-2xl">₹{total}</span>
                  </div>
                  
                  <div className="space-y-2 mb-6">
                    <p className="text-xs font-bold text-muted-foreground uppercase">Payment Mode</p>
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => setPaymentMode("upi")} className={`py-2 px-3 rounded-lg flex flex-col items-center gap-1 text-xs font-bold transition-all border-2 ${paymentMode === "upi" ? "bg-primary/20 border-primary text-primary" : "bg-muted border-transparent text-muted-foreground"}`}>
                        <QrCode className="w-5 h-5" /> UPI
                      </button>
                      <button onClick={() => setPaymentMode("cash")} className={`py-2 px-3 rounded-lg flex flex-col items-center gap-1 text-xs font-bold transition-all border-2 ${paymentMode === "cash" ? "bg-primary/20 border-primary text-primary" : "bg-muted border-transparent text-muted-foreground"}`}>
                        <Banknote className="w-5 h-5" /> Cash
                      </button>
                      <button onClick={() => setPaymentMode("card")} className={`py-2 px-3 rounded-lg flex flex-col items-center gap-1 text-xs font-bold transition-all border-2 ${paymentMode === "card" ? "bg-primary/20 border-primary text-primary" : "bg-muted border-transparent text-muted-foreground"}`}>
                        <CreditCard className="w-5 h-5" /> Card
                      </button>
                    </div>
                  </div>
                </div>

                <button onClick={() => setShowPaymentModal(true)} disabled={cart.length === 0 || !hasSufficientStock} className="w-full h-16 bg-primary hover:bg-secondary text-primary-foreground rounded-xl font-black text-lg flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-[0_4px_14px_0_rgba(255,213,79,0.39)] disabled:opacity-50 disabled:shadow-none disabled:active:scale-100">
                  <Printer className="h-6 w-6" /> {!hasSufficientStock ? "Out of Stock" : `Pay ₹${total} & Print`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Payment Confirmation Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md rounded-2xl p-8 shadow-2xl border border-border animate-in fade-in zoom-in-95">
            <div className="flex justify-center mb-6">
              <div className="p-6 rounded-full bg-primary/20">
                <Banknote className="h-16 w-16 text-primary" />
              </div>
            </div>
            
            <h2 className="text-2xl font-black text-foreground text-center mb-2">Confirm Payment</h2>
            <p className="text-muted-foreground text-center mb-6">Has the customer completed the payment?</p>
            
            <div className="bg-muted rounded-xl p-4 mb-8">
              <div className="flex justify-between items-center mb-2">
                <span className="text-muted-foreground font-semibold">Total Amount</span>
                <span className="text-xl font-bold text-primary">₹{total}</span>
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
                No, Cancel
              </button>
              <button 
                onClick={handlePlaceOrder}
                className="flex-1 py-4 bg-primary text-primary-foreground font-bold rounded-xl shadow-[0_4px_14px_0_rgba(255,213,79,0.39)] hover:bg-secondary transition-transform active:scale-95 flex justify-center items-center gap-2"
              >
                <Printer className="w-5 h-5" /> Yes, Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
