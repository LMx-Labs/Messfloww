import { useState, useEffect } from "react";
import { Plus, Minus, Trash2, Printer, AlertCircle, Clock, ShoppingCart } from "lucide-react";
import { useTimeSlots } from "../../features/timeslots/TimeSlotContext";
import { useMenu } from "../../features/menu/MenuContext";
import { Link } from "react-router";
import { fetchSettings } from "../settings/settingsService";
import { kitchenService } from "../kitchen/kitchenService";
import { printReceipt, mapOrderToBill } from "../../app/modules/ThermalPrinter";
import { Order } from "../../shared/types";
import { toast } from "sonner";

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  category?: string;
  gst?: number;
  isMRP?: boolean;
}

export function ExternalOrderPage() {
  const { activeSlot } = useTimeSlots();
  const { menu, decreaseStock } = useMenu();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    fetchSettings().then(setSettings);
  }, []);

  const activeSlotKey = activeSlot ? activeSlot.name.toLowerCase() : "";
  const currentSlotMenu = activeSlot ? (menu[activeSlotKey] || []).filter(item => item.available && item.stock > 0) : [];

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
    const existingItem = cart.find((cartItem) => cartItem.id === item.id);
    if (existingItem) {
      setCart(cart.map((cartItem) => cartItem.id === item.id ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(cart.map((item) => item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item).filter((item) => item.quantity > 0));
  };

  const removeFromCart = (id: number) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalGst = cart.reduce((sum, item) => {
    const itemGst = Math.round(item.price * ((item.gst || 0) / 100));
    return sum + itemGst * item.quantity;
  }, 0);
  const total = subtotal + totalGst;
  
  const cartWithStockWarnings = cart.map(item => {
    const menuItem = (menu[activeSlotKey] || []).find(i => i.id === item.id);
    const availableStock = menuItem?.stock || 0;
    return { ...item, availableStock, isOverdraft: item.quantity > availableStock };
  });
  const hasSufficientStock = !cartWithStockWarnings.some(item => item.isOverdraft);

  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      toast.error("Please add items to cart");
      return;
    }
    if (!hasSufficientStock) {
      toast.error("Some items are out of stock.");
      return;
    }

    const orderId = `EXT-${Date.now().toString().slice(-6)}`;
    const newOrder: Order = {
      id: orderId,
      userId: "EXTERNAL",
      userRollNo: "SHOP",
      items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.quantity })),
      totalPrice: total,
      status: "pending",
      payment_mode: "upi",
      slotName: activeSlotKey,
      slotTime: "N/A",
      orderNumber: Date.now() % 1000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isExternal: true
    } as any;

    try {
      for (const item of cart) {
        await kitchenService.decrementStock(item.id, item.quantity);
      }
      await kitchenService.pushActiveOrder(newOrder);
      printReceipt(mapOrderToBill(newOrder as any), settings);
      toast.success(`Order placed successfully! ID: ${orderId}`);
      setCart([]);
    } catch (e) {
      console.error("External order failed", e);
      toast.error("Failed to place order.");
    }
  };

  return (
    <div className="space-y-6 print:hidden">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">External / Shop Order</h1>
        <p className="text-muted-foreground">Place orders for walk-in customers or shop sales</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="text-xl font-bold text-foreground mb-4">Menu Items</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {currentSlotMenu.map((item) => {
              const finalPrice = Math.round(item.price * (1 + (item.gst || 0) / 100));
              return (
                <button key={item.id} onClick={() => addToCart(item)} className="bg-card hover:bg-primary hover:text-primary-foreground group text-foreground rounded-xl p-4 border border-border transition-all text-left shadow-sm h-full flex flex-col justify-between">
                  <div>
                    <div className="font-bold mb-1">{item.name}</div>
                    <div className="text-sm opacity-70 mb-2">{item.category}</div>
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
                  {cart.map((item) => (
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
                          <button onClick={() => updateQuantity(item.id, -1)} className="p-1 rounded bg-background hover:bg-primary hover:text-primary-foreground"><Minus className="h-3 w-3" /></button>
                          <button onClick={() => updateQuantity(item.id, 1)} className="p-1 rounded bg-background hover:bg-primary hover:text-primary-foreground"><Plus className="h-3 w-3" /></button>
                          <button onClick={() => removeFromCart(item.id)} className="p-1 rounded bg-destructive/10 text-destructive ml-1"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border pt-4 mb-6">
                  <div className="flex justify-between items-center text-lg">
                    <span className="font-bold text-foreground">Total</span>
                    <span className="font-bold text-primary text-2xl">₹{total}</span>
                  </div>
                </div>
                <button onClick={handlePlaceOrder} disabled={cart.length === 0 || !hasSufficientStock} className="w-full bg-primary hover:bg-secondary text-primary-foreground px-6 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors shadow-md disabled:opacity-50">
                  <Printer className="h-5 w-5" /> {!hasSufficientStock ? "Insufficient Stock" : "Place Order & Print KOT"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
