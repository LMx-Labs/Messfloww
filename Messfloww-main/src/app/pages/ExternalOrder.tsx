import { useState, useEffect } from "react";
import { Plus, Minus, Trash2, Printer, AlertCircle, Clock } from "lucide-react";
import { useTimeSlots } from "../context/TimeSlotContext";
import { useMenu } from "../context/MenuContext";
import { Link } from "react-router";
import { fetchSettings } from "../services/firestoreService";
import { rtdbService } from "../services/rtdbService";
import { printReceipt, mapOrderToBill } from "../modules/ThermalPrinter";

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  category?: string;
  gst?: number;
  isMRP?: boolean;
}

export function ExternalOrder() {
  const { activeSlot } = useTimeSlots();
  const { menu, decreaseStock } = useMenu();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    fetchSettings().then(setSettings);
  }, []);

  // Get active menu items for the current slot
  const activeSlotKey = activeSlot ? activeSlot.name.toLowerCase() : "";
  const currentSlotMenu = activeSlot ? (menu[activeSlotKey] || []).filter(item => item.available && item.stock > 0) : [];

  // If mess is closed, show blocking message
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

          <h2 className="text-2xl font-bold text-foreground mb-3">
            Mess is Closed
          </h2>
          <p className="text-muted-foreground mb-8">
            External ordering is only available when the mess is open. Please activate a time slot to enable this feature.
          </p>

          <Link
            to="/time-slots"
            className="inline-flex items-center gap-2 bg-primary hover:bg-secondary text-primary-foreground px-6 py-3 rounded-xl font-semibold transition-colors"
          >
            <Clock className="h-5 w-5" />
            Manage Time Slots
          </Link>
        </div>
      </div>
    );
  }

  const addToCart = (item: any) => {
    const existingItem = cart.find((cartItem) => cartItem.id === item.id);
    if (existingItem) {
      setCart(
        cart.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        )
      );
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(
      cart
        .map((item) =>
          item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
        )
        .filter((item) => item.quantity > 0)
    );
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
  
  // Calculate if all cart items have sufficient stock
  const cartWithStockWarnings = cart.map(item => {
    const menuItem = (menu[activeSlotKey] || []).find(i => i.id === item.id);
    const availableStock = menuItem?.stock || 0;
    return { ...item, availableStock, isOverdraft: item.quantity > availableStock };
  });
  const hasSufficientStock = !cartWithStockWarnings.some(item => item.isOverdraft);

  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      alert("Please add items to cart");
      return;
    }

    if (!hasSufficientStock) {
      alert("Some items are out of stock. Please adjust your cart.");
      return;
    }

    const orderId = `EXT-${Date.now().toString().slice(-6)}`;
    const newOrder = {
      id: orderId,
      userId: "EXTERNAL",
      userRollNo: "SHOP",
      externalLabel: "Walk-in Customer",
      isExternal: true,
      items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.quantity })),
      totalPrice: total,
      status: "preparing",
      slotName: activeSlotKey,
      slotTime: "N/A",
      orderNumber: Date.now() % 1000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await rtdbService.pushActiveOrder(newOrder);
      
      // Decrement stock in RTDB via MenuContext
      for (const item of cart) {
        decreaseStock(activeSlotKey, item.id, item.quantity);
      }
      
      // Use the new ThermalPrinter module for consistent printing
      printReceipt(mapOrderToBill(newOrder as any), settings);
      
      alert(`Order placed successfully!\nOrder ID: ${orderId}\nTotal: ₹${total}`);
      setCart([]);
    } catch (e) {
      console.error("Order failed", e);
      alert("Failed to place order. Check console.");
    }
  };

  return (
    <div className="space-y-6 print:hidden">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">External / Shop Order</h1>
        <p className="text-muted-foreground">Place orders for walk-in customers or shop sales</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Menu Items Grid */}
        <div className="lg:col-span-2">
          <h2 className="text-xl font-bold text-foreground mb-4">Menu Items</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {currentSlotMenu.map((item) => {
              const finalPrice = Math.round(item.price * (1 + (item.gst || 0) / 100));
              return (
              <button
                key={item.id}
                onClick={() => addToCart(item)}
                className="bg-card hover:bg-primary hover:text-primary-foreground group text-foreground rounded-xl p-4 border border-border transition-all text-left shadow-sm hover:shadow-md h-full flex flex-col justify-between"
              >
                <div>
                  <div className="font-bold mb-1">{item.name}</div>
                  <div className="text-sm opacity-70 mb-2">{item.category}</div>
                </div>
                <div>
                  <div className="font-bold text-lg">
                    {item.isMRP ? `MRP ₹${item.price}` : `₹${item.price}`}
                  </div>
                  <div className="text-[10px] opacity-80 mt-1 font-semibold">
                    Final: ₹{finalPrice} (Incl. {item.gst}% GST)
                  </div>
                </div>
              </button>
            )})}
          </div>
        </div>

        {/* Cart Section */}
        <div className="lg:col-span-1">
          <div className="bg-card rounded-xl p-6 border border-border sticky top-6">
            <h2 className="text-xl font-bold text-foreground mb-4">Cart</h2>

            {cart.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No items in cart</p>
                <p className="text-sm mt-2">Select items from the menu</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-6 max-h-96 overflow-y-auto pr-2">
                  {cart.map((item) => {
                    const itemGst = Math.round(item.price * ((item.gst || 0) / 100));
                    const finalPrice = item.price + itemGst;
                    return (
                    <div
                      key={item.id}
                      className="bg-muted rounded-lg p-3 flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-foreground leading-tight">{item.name}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            ₹{item.price} + ₹{itemGst} GST = <span className="font-bold text-foreground">₹{finalPrice}</span>
                          </div>
                        </div>
                        <div className="font-bold text-foreground text-right w-16">
                          ₹{finalPrice * item.quantity}
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-border pt-2 mt-1">
                        <div className="text-xs text-muted-foreground">Qty:</div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="p-1 rounded bg-background hover:bg-primary hover:text-primary-foreground transition-colors"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-6 text-center text-sm font-semibold text-foreground">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="p-1 rounded bg-background hover:bg-primary hover:text-primary-foreground transition-colors"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="p-1 rounded bg-destructive/20 hover:bg-destructive text-destructive hover:text-destructive-foreground transition-colors ml-1"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {/* Stock Warning */}
                      {cartWithStockWarnings.find(c => c.id === item.id)?.isOverdraft && (
                        <div className="mt-2 text-[10px] font-bold text-destructive flex items-center gap-1 bg-destructive/10 p-1.5 rounded-lg border border-destructive/20 animate-pulse">
                          <AlertCircle className="h-3 w-3" />
                          Only {cartWithStockWarnings.find(c => c.id === item.id)?.availableStock} units available
                        </div>
                      )}
                    </div>
                  )})}
                </div>

                <div className="border-t border-border pt-4 mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-semibold text-foreground">₹{subtotal}</span>
                  </div>
                  <div className="flex justify-between items-center mb-4 pb-4 border-b border-border border-dashed">
                    <span className="text-muted-foreground">Total GST</span>
                    <span className="font-semibold text-foreground">₹{totalGst}</span>
                  </div>
                  <div className="flex justify-between items-center text-lg">
                    <span className="font-bold text-foreground">Total</span>
                    <span className="font-bold text-primary text-2xl">₹{total}</span>
                  </div>
                </div>

                <button
                  onClick={handlePlaceOrder}
                  disabled={cart.length === 0 || !hasSufficientStock}
                  className="w-full bg-primary hover:bg-secondary text-primary-foreground px-6 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Printer className="h-5 w-5" />
                  {!hasSufficientStock ? "Insufficient Stock" : "Place Order & Print KOT"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}