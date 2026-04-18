import { useState, useEffect } from "react";
import { Plus, Minus, Trash2, Printer, AlertCircle, Clock, Search, UserCheck, Wallet, XCircle, ShoppingCart } from "lucide-react";
import { useTimeSlots } from "../context/TimeSlotContext";
import { useMenu } from "../context/MenuContext";
import { Link } from "react-router";
import { fetchSettings, getStudentByRegNo, deductStudentBalance } from "../services/firestoreService";
import { rtdbService } from "../services/rtdbService";
import { printReceipt, mapOrderToBill } from "../modules/ThermalPrinter";
import { Student } from "../context/StudentContext";
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

export function CounterOrder() {
  const { activeSlot } = useTimeSlots();
  const { menu, decreaseStock } = useMenu();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [step, setStep] = useState<"cart" | "lookup">("cart");
  const [settings, setSettings] = useState<any>(null);
  const [regNoInput, setRegNoInput] = useState("");
  const [student, setStudent] = useState<Student | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [isPlacing, setIsPlacing] = useState(false);

  useEffect(() => {
    fetchSettings().then(setSettings);
  }, []);

  // Get active menu items for the current slot
  const activeSlotKey = activeSlot ? activeSlot.name.toLowerCase() : "";
  const currentSlotMenu = activeSlot ? (menu[activeSlotKey] || []).filter(item => item.available && item.stock > 0) : [];

  // Student lookup
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
        setStudent(found); // still show card but gray
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
  };

  // Reset flow completely
  const resetFlow = () => {
    setStudent(null);
    setRegNoInput("");
    setLookupError("");
    setCart([]);
    setStep("cart");
  };

  // If mess is closed, show blocking message
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

          <h2 className="text-2xl font-bold text-foreground mb-3">
            Mess is Closed
          </h2>
          <p className="text-muted-foreground mb-8">
            Counter ordering is only available when the mess is open. Please activate a time slot to enable this feature.
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

  // Cart logic
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
  const studentBalance = student?.balance || 0;
  const remainingBalance = studentBalance - total;
  
  // Calculate if all cart items have sufficient stock
  const cartWithStockWarnings = cart.map(item => {
    const menuItem = (menu[activeSlotKey] || []).find(i => i.id === item.id);
    const availableStock = menuItem?.stock || 0;
    return { ...item, availableStock, isOverdraft: item.quantity > availableStock };
  });
  const hasSufficientStock = !cartWithStockWarnings.some(item => item.isOverdraft);
  
  const canPlaceOrder = student && student.status === "active" && cart.length > 0 && remainingBalance >= 0 && hasSufficientStock;

  const handlePlaceOrder = async () => {
    if (!canPlaceOrder || !student) return;
    
    // Final check for stock just in case another device depleted it
    if (!hasSufficientStock) {
      toast.error("Some items are out of stock. Please adjust your cart.");
      return;
    }

    setIsPlacing(true);

    const orderId = `CNT-${Date.now().toString().slice(-6)}`;
    const newOrder = {
      id: orderId,
      userId: student.uid || student.regNo,
      userRollNo: student.regNo,
      externalLabel: student.name,
      isExternal: false,
      isCounterOrder: true,
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
      // 1. Deduct wallet balance
      const { newBalance } = await deductStudentBalance(student.regNo, total);

      // 2. Push order to RTDB
      await rtdbService.pushActiveOrder(newOrder);

      // 3. Decrement stock
      for (const item of cart) {
        decreaseStock(activeSlotKey, item.id, item.quantity);
      }

      // 4. Print receipt with student details
      const studentForReceipt = { ...student, balance: newBalance };
      printReceipt(mapOrderToBill(newOrder as any, studentForReceipt), settings);

      // 5. Update local student state
      setStudent({ ...student, balance: newBalance, credits: newBalance });
      toast.success(`Order placed! ₹${total} deducted from ${student.name}'s wallet. New balance: ₹${newBalance}`);
      resetFlow();
    } catch (e: any) {
      console.error("Counter order failed", e);
      toast.error(e.message || "Failed to place order. Check console.");
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

      {/* Checkout Wizard */}
      {step === "cart" ? (
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
                <ShoppingCart className="h-10 w-10 mx-auto opacity-30 mb-3" />
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
                  <div className="flex justify-between items-center text-lg mb-4">
                    <span className="font-bold text-foreground">Total</span>
                    <span className="font-bold text-primary text-2xl">₹{total}</span>
                  </div>

                </div>

                <button
                  onClick={() => setStep("lookup")}
                  disabled={cart.length === 0 || !hasSufficientStock}
                  className="w-full bg-primary hover:bg-secondary text-primary-foreground px-6 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {!hasSufficientStock ? "Insufficient Stock" : "Confirm Order"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      ) : (
      <div className="max-w-2xl mx-auto space-y-6">
        <button
          onClick={() => setStep("cart")}
          className="text-muted-foreground hover:text-foreground transition-colors text-sm font-semibold flex items-center gap-1"
        >
          &larr; Back to Cart
        </button>
        
        {/* Order Summary (Collapsed Cart) */}
        <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
          <h2 className="text-xl font-bold text-foreground mb-4">Order Summary</h2>
          <div className="space-y-2 mb-4 max-h-40 overflow-y-auto pr-2">
            {cart.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.quantity}x {item.name}</span>
                <span className="font-semibold text-foreground">
                  ₹{Math.round(item.price * (1 + (item.gst || 0) / 100)) * item.quantity}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center text-lg pt-4 border-t border-border">
            <span className="font-bold text-foreground">Total to Pay</span>
            <span className="font-bold text-primary text-2xl">₹{total}</span>
          </div>
        </div>

        {/* Student Lookup Section */}
        <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
                  <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-primary" />
                    Student Details
                  </h3>

                  {!student || student.status === "disabled" ? (
                    <div>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            value={regNoInput}
                            onChange={(e) => setRegNoInput(e.target.value.toUpperCase())}
                            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                            placeholder="Enter Reg No. (e.g. 22BCE1234)"
                            className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm tracking-wider"
                            autoFocus
                          />
                        </div>
                        <button
                          onClick={handleLookup}
                          disabled={lookupLoading || !regNoInput.trim()}
                          className="px-4 py-2 bg-primary hover:bg-secondary text-primary-foreground rounded-lg font-bold transition-colors disabled:opacity-50"
                        >
                          {lookupLoading ? "..." : "Search"}
                        </button>
                      </div>
                      
                      {lookupError && (
                        <div className="mt-2 flex items-center gap-1.5 text-destructive text-xs font-semibold">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          {lookupError}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Student Card */
                    <div className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl border border-primary/20 p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0 pr-2">
                          <h4 className="font-bold text-foreground truncate">{student.name}</h4>
                          <p className="text-xs text-muted-foreground font-mono">{student.regNo}</p>
                        </div>
                        <button
                          onClick={clearStudent}
                          className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex-shrink-0"
                          title="Clear student"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Wallet Balance Preview */}
                      <div className={`mt-3 rounded-lg p-3 border ${remainingBalance >= 0 ? "bg-accent/10 border-accent/30" : "bg-destructive/10 border-destructive/30"}`}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Wallet className="h-3 w-3" />
                            Current Wallet
                          </span>
                          <span className="text-sm font-semibold text-foreground">₹{studentBalance}</span>
                        </div>
                        <div className="flex justify-between items-center relative z-10">
                          <span className="text-sm font-bold text-foreground">After Order</span>
                          <span className={`font-black text-lg ${remainingBalance >= 0 ? "text-accent" : "text-destructive"}`}>
                            ₹{remainingBalance}
                          </span>
                        </div>
                        {remainingBalance < 0 && (
                          <p className="text-xs text-destructive mt-1.5 font-semibold flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Insufficient wallet balance
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                <button
                  onClick={handlePlaceOrder}
                  disabled={!canPlaceOrder || isPlacing}
                  className="w-full mt-6 bg-primary hover:bg-secondary text-primary-foreground px-6 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPlacing ? (
                    <div className="h-5 w-5 border-2 border-primary-foreground border-t-transparent animate-spin rounded-full" />
                  ) : (
                    <Printer className="h-5 w-5" />
                  )}
                  {isPlacing ? "Processing..." : "Place Order & Print Receipt"}
                </button>
        </div>
      )}
    </div>
  );
}
