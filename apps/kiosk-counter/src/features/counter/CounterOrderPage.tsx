import { useState, useEffect } from "react";
import { Plus, Minus, Trash2, Printer, AlertCircle, Clock, ShoppingCart, UserCheck, Wallet, XCircle } from "lucide-react";
import { Link } from "react-router";
import { 
  orderService, 
  menuService, 
  timeSlotService, 
  fetchSettings, 
  getStudentByRegNo, 
  deductStudentBalance,
  printReceiptSilent, 
  mapOrderToBill,
  mapOrderToKOTs,
  kotQueueService,
  Student, 
  Order,
  MenuItem,
  TimeSlot,
  stockService
} from "@messflow/shared-core";
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

export function CounterOrderPage() {
  const [activeSlot, setActiveSlot] = useState<TimeSlot | null>(null);
  const [menu, setMenu] = useState<Record<string, MenuItem[]>>({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [step, setStep] = useState<"cart" | "lookup">("cart");
  const [settings, setSettings] = useState<any>(null);
  const [regNoInput, setRegNoInput] = useState("");
  const [student, setStudent] = useState<Student | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [isPlacing, setIsPlacing] = useState(false);
  const [counters, setCounters] = useState<any[]>([]);

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
  
  const quickItems = currentSlotMenu.slice(0, 4);

  const handleLookup = async () => {
    const trimmed = regNoInput.trim().toUpperCase();
    if (!trimmed) {
      setLookupError("Please enter a registration number");
      return;
    }
    setLookupLoading(true);
    setLookupError("");
    setStudent(null);

    try {
      const found = await getStudentByRegNo(trimmed);
      if (!found) {
        setLookupError("Student not found. Check the registration number.");
      } else if (found.status === "disabled") {
        setLookupError("This student's account is disabled.");
        setStudent(found);
      } else {
        setStudent(found);
        toast.success(`Found: ${found.name}`);
      }
    } catch (e: any) {
      setLookupError(e.message || "Lookup failed");
    } finally {
      setLookupLoading(false);
    }
  };

  const clearStudent = () => {
    setRegNoInput("");
    setLookupError("");
    setStudent(null);
  };

  const resetFlow = () => {
    setStudent(null);
    setRegNoInput("");
    setLookupError("");
    setCart([]);
    setStep("cart");
  };

  if (!activeSlot) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Counter Order</h1>
          <p className="text-muted-foreground">Place orders for registered students at the counter</p>
        </div>
        <div className="bg-destructive/10 border-2 border-destructive rounded-2xl p-12 text-center">
          <div className="flex justify-center mb-6">
            <div className="p-8 rounded-full bg-destructive/20">
              <AlertCircle className="h-20 w-20 text-destructive" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">Mess is Closed</h2>
          <p className="text-muted-foreground mb-8">Counter ordering is only available when the mess is open.</p>
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
  const studentBalance = student?.balance || 0;
  const remainingBalance = studentBalance - total;
  
  const cartWithStockWarnings = cart.map((item: CartItem) => {
    const menuItem = (menu[activeSlotKey] || []).find((i: MenuItem) => i.id === item.id);
    const availableStock = menuItem?.stock || 0;
    return { ...item, availableStock, isOverdraft: item.quantity > availableStock };
  });
  const hasSufficientStock = !cartWithStockWarnings.some((item: any) => item.isOverdraft);
  
  const canPlaceOrder = student && student.status === "active" && cart.length > 0 && remainingBalance >= 0 && hasSufficientStock;

  const handlePlaceOrder = async () => {
    if (!canPlaceOrder || !student) return;
    if (!hasSufficientStock) {
      toast.error("Some items are out of stock. Please adjust your cart.");
      return;
    }

    setIsPlacing(true);
    const orderId = `CNT-${Date.now().toString().slice(-6)}`;
    const newOrder: Order = {
      id: orderId,
      userId: student.uid || student.regNo,
      userRollNo: student.regNo,
      items: cart.map((i: CartItem) => ({ id: i.id, name: i.name, price: i.price, qty: i.quantity })),
      totalPrice: total,
      status: "pending",
      payment_mode: "credit",
      slotName: activeSlotKey,
      slotTime: "N/A",
      orderNumber: Date.now() % 1000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isCounterOrder: true,
      autoPrint: true
    } as any;

    try {
      const { newBalance } = await deductStudentBalance(student.regNo, total);
      for (const item of cart) {
        await stockService.decrementStock(item.id, item.quantity);
      }
      const allMenuItems = Object.values(menu).flat();
      await orderService.pushActiveOrder(newOrder);
      await kotQueueService.routeOrderToCounters(newOrder, counters, allMenuItems);
      
      const studentForReceipt = { ...student, balance: newBalance };
      const bill = mapOrderToBill(newOrder as any, studentForReceipt);
      const kots = mapOrderToKOTs(newOrder as any, allMenuItems);
      printReceiptSilent([bill, ...kots], settings);
      
      setStudent({ ...student, balance: newBalance, credits: newBalance });
      toast.success(`Order placed! ₹${total} deducted from ${student.name}'s wallet.`);
      resetFlow();
    } catch (e: any) {
      console.error("Counter order failed", e);
      toast.error(e.message || "Failed to place order.");
    } finally {
      setIsPlacing(false);
    }
  };

  return (
    <div className="space-y-6 print:hidden">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Counter Order</h1>
        <p className="text-muted-foreground">Place orders for registered students using their wallet balance</p>
      </div>

      {step === "cart" ? (
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
                  <p className="text-sm">Select items from the menu</p>
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
                  <div className="border-t border-border pt-4 mb-6">
                    <div className="flex justify-between items-center text-lg">
                      <span className="font-bold text-foreground">Total</span>
                      <span className="font-bold text-primary text-2xl">₹{total}</span>
                    </div>
                  </div>
                  <button onClick={() => setStep("lookup")} disabled={cart.length === 0 || !hasSufficientStock} className="w-full h-16 bg-primary hover:bg-secondary text-primary-foreground rounded-xl font-black text-lg shadow-[0_4px_14px_0_rgba(255,213,79,0.39)] transition-transform active:scale-95 disabled:opacity-50 disabled:shadow-none disabled:active:scale-100">Confirm Order</button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto space-y-6">
          <button onClick={() => setStep("cart")} className="text-muted-foreground hover:text-foreground text-sm font-semibold flex items-center gap-1">&larr; Back to Cart</button>
          <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
            <h2 className="text-xl font-bold text-foreground mb-4">Order Summary</h2>
            <div className="flex justify-between items-center text-lg pt-4 border-t border-border">
              <span className="font-bold text-foreground">Total to Pay</span>
              <span className="font-bold text-primary text-2xl">₹{total}</span>
            </div>
          </div>
          <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
            <h3 className="font-bold text-foreground mb-3 flex items-center gap-2"><UserCheck className="h-4 w-4 text-primary" /> Student Details</h3>
            {!student ? (
              <div className="flex gap-2">
                <input type="text" value={regNoInput} onChange={(e) => setRegNoInput(e.target.value.toUpperCase())} placeholder="Enter Reg No." className="flex-1 px-3 py-2 bg-input-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary" />
                <button onClick={handleLookup} disabled={lookupLoading} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-bold">{lookupLoading ? "..." : "Search"}</button>
              </div>
            ) : (
              <div className="bg-primary/5 rounded-xl border border-primary/20 p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold">{student.name}</h4>
                    <p className="text-xs font-mono">{student.regNo}</p>
                  </div>
                  <button onClick={clearStudent} className="text-muted-foreground hover:text-destructive"><XCircle className="h-4 w-4" /></button>
                </div>
                <div className={`mt-3 rounded-lg p-3 border ${remainingBalance >= 0 ? "bg-accent/10" : "bg-destructive/10"}`}>
                  <div className="flex justify-between text-sm">
                    <span>Balance: ₹{studentBalance}</span>
                    <span className="font-bold">After: ₹{remainingBalance}</span>
                  </div>
                </div>
              </div>
            )}
            {lookupError && <p className="text-destructive text-xs mt-2">{lookupError}</p>}
          </div>
          <button onClick={handlePlaceOrder} disabled={!canPlaceOrder || isPlacing} className="w-full mt-6 h-16 bg-primary hover:bg-secondary text-primary-foreground rounded-xl font-black text-lg shadow-[0_4px_14px_0_rgba(255,213,79,0.39)] transition-transform active:scale-95 disabled:opacity-50 disabled:shadow-none disabled:active:scale-100">
            {isPlacing ? "Processing..." : "Place Order & Print Receipt"}
          </button>
        </div>
      )}
    </div>
  );
}
