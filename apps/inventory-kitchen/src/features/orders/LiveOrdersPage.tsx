import { Check, Download, PackageOpen, Printer, Calendar, Trash2 } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { ref, get, remove } from "firebase/database";
import { 
  rtdb, 
  orderService, 
  studentService, 
  timeSlotService, 
  fetchSettings, 
  printReceipt, 
  mapOrderToBill, 
  Student, 
  Order,
  TimeSlot
} from "@messflow/shared-core";
import { toast } from "sonner";

export function LiveOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [settings, setSettings] = useState<any>(null);
  
  useEffect(() => {
    const unsubOrders = orderService.subscribeActiveOrders(setOrders);
    const unsubStudents = studentService.subscribeStudents(setStudents);
    const unsubSlots = timeSlotService.subscribeToTimeSlots(setTimeSlots);
    fetchSettings().then(setSettings);
    
    return () => {
      unsubOrders();
      unsubStudents();
      unsubSlots();
    };
  }, []);

  const activeOrders = useMemo(() => orders.filter(o => o.status !== "completed"), [orders]);
  
  // Group orders by slot name
  const groupedOrders = useMemo(() => {
    const groups: Record<string, typeof activeOrders> = {};
    
    activeOrders.forEach(order => {
      const slot = order.slotName || "Unscheduled";
      if (!groups[slot]) groups[slot] = [];
      groups[slot].push(order);
    });
    
    return groups;
  }, [activeOrders]);

  // Order of slots to display
  const orderedSlotNames = useMemo(() => {
    const names = timeSlots.map(s => s.name);
    // Add "Unscheduled" if there are orders in it
    if (groupedOrders["Unscheduled"]) {
      names.push("Unscheduled");
    }
    return names;
  }, [timeSlots, groupedOrders]);

  const handlePrint = async (order: any) => {
    let student: Student | undefined;
    if (!order.isExternal && order.userRollNo) {
      student = students.find(s => s.regNo.trim().toUpperCase() === order.userRollNo.trim().toUpperCase());
    }
    
    await orderService.updateOrderStatus(order.id, 'status', 'completed');
    
    // Attempt dual print (Bill + KOT)
    // LiveOrdersPage doesn't inject useMenu yet, but it might not explicitly need categories if we pass an empty array, 
    // it defaults to 'UNCATEGORIZED'. For now, let's just print receipt.
    printReceipt(mapOrderToBill(order, student), settings);
  };
  
  const downloadLiveOrdersReport = () => {
    let csvContent = "MessFlow Live Orders Report\n";
    csvContent += `Generated: ${new Date().toLocaleString()}\n`;
    csvContent += "Order ID,Student Name,Student ID,Items,Amount,Time,Status\n";
    activeOrders.forEach(order => {
      const itemsList = order.items.map(i => `${i.name} x${i.qty}`).join(' | ');
      csvContent += `${order.id},"${order.externalLabel || ''}",${order.userRollNo},"${itemsList}",${order.totalPrice},${order.createdAt},${order.status}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `MessFlow_Live_Orders_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const todayStr = new Date().toLocaleDateString('en-IN', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  const clearTestOrders = async () => {
    try {
      const activeOrdersRef = ref(rtdb, "active_orders");
      const snapshot = await get(activeOrdersRef);
      if (snapshot.exists()) {
        const updates: Promise<void>[] = [];
        snapshot.forEach((child) => {
          const order = child.val();
          if (child.key?.startsWith("TEST-") || order.userId === "test-user") {
            updates.push(remove(ref(rtdb, `active_orders/${child.key}`)));
          }
        });
        await Promise.all(updates);
        toast.success("Test orders cleared successfully");
      }
    } catch (error) {
      console.error("Failed to clear test orders:", error);
      toast.error("Failed to clear test orders");
    }
  };
  
  return (
    <div className="space-y-6 print:hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Live Orders</h1>
          <p className="text-muted-foreground">Monitoring {activeOrders.length} active orders</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={clearTestOrders} className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-4 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors">
            <Trash2 className="h-5 w-5" /> Clear Test Orders
          </button>
          <button onClick={downloadLiveOrdersReport} className="bg-primary hover:bg-secondary text-primary-foreground px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors">
            <Download className="h-5 w-5" /> Download Report
          </button>
        </div>
      </div>

      {activeOrders.length === 0 ? (
        <div className="py-24 bg-card rounded-3xl border-2 border-dashed border-border flex flex-col items-center justify-center text-center space-y-4">
          <div className="p-4 bg-muted rounded-full">
             <PackageOpen className="h-10 w-10 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">No active orders</h3>
            <p className="text-muted-foreground">Incoming orders will automatically appear here.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Broad Yellow Strip - Starting of Day */}
          <div className="w-full h-14 bg-yellow-400 flex items-center justify-center rounded-2xl shadow-lg border-4 border-yellow-500/20">
            <div className="flex items-center gap-3">
              <Calendar className="w-6 h-6 text-black" />
              <span className="text-black font-black uppercase tracking-[0.3em] text-lg">--- Start of Day : {todayStr} ---</span>
            </div>
          </div>

          <div className="space-y-12 px-2">
            {orderedSlotNames.map(slotName => {
              const ordersInSlot = groupedOrders[slotName] || [];
              if (ordersInSlot.length === 0) return null;
              
              const slotConfig = timeSlots.find(s => s.name === slotName);
              const slotTimeRange = slotConfig ? `(${slotConfig.startTime} - ${slotConfig.endTime})` : "";

              return (
                <div key={slotName} className="space-y-6">
                  {/* White Strip - Meal Slot Header */}
                  <div className="w-full h-12 bg-white flex items-center justify-between px-8 rounded-xl shadow-md border-l-[12px] border-primary">
                    <span className="text-black font-black uppercase tracking-widest text-lg">{slotName} <span className="text-muted-foreground font-bold ml-2 text-sm">{slotTimeRange}</span></span>
                    <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-black">{ordersInSlot.length} ORDERS</span>
                  </div>

                  {/* Grid of Orders for this slot */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {ordersInSlot.map((order) => (
                      <div key={order.id} className="bg-card rounded-2xl p-6 border-2 border-border shadow-sm hover:shadow-xl hover:border-primary/20 transition-all group">
                        <div className="mb-4 pb-4 border-b border-border flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-black text-xl text-foreground mb-1 truncate tracking-tight">{order.id}</h3>
                            <p className="text-foreground font-bold truncate opacity-80">{order.externalLabel || order.userRollNo}</p>
                            <p className="text-xs text-muted-foreground truncate font-medium uppercase tracking-tighter">{order.userRollNo} • {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                          <button onClick={() => handlePrint(order)} className="shrink-0 p-3 bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground rounded-2xl transition-all shadow-sm group-hover:scale-110 active:scale-95">
                            <Printer className="h-6 w-6" />
                          </button>
                        </div>
                        <div className="mb-6">
                          <p className="text-[10px] text-muted-foreground mb-3 font-black uppercase tracking-[0.2em] opacity-50">Order Summary</p>
                          <ul className="space-y-2">
                            {order.items.map((item, idx) => (
                              <li key={idx} className="text-sm font-bold text-foreground flex justify-between items-center bg-muted/30 p-2 rounded-lg">
                                <span className="flex items-center"><span className="w-1.5 h-1.5 bg-primary rounded-full mr-3"></span>{item.name}</span>
                                <span className="text-primary">x{item.qty}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="flex justify-between items-center mb-6 pt-4 border-t border-dashed border-border">
                          <span className="text-muted-foreground text-xs font-bold uppercase">Total Bill</span>
                          <div className="font-black text-2xl text-foreground">₹{order.totalPrice}</div>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/50">
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Live Status</span>
                          <div className="flex items-center gap-1.5 text-primary font-black uppercase text-[10px] tracking-widest bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
                            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></span>
                            {order.status}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* White Strip - Meal Slot Footer/Separator */}
                  <div className="w-full h-1 bg-white/20 rounded-full mt-8"></div>
                  <div className="w-full h-6 bg-white/5 flex items-center justify-center rounded-lg">
                    <span className="text-[8px] text-white/30 font-black uppercase tracking-[0.5em]">--- Slot Section End ---</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Broad Yellow Strip - Ending of Day */}
          <div className="w-full h-14 bg-yellow-400 flex items-center justify-center rounded-2xl shadow-lg border-4 border-yellow-500/20 opacity-90 hover:opacity-100 transition-opacity">
            <span className="text-black font-black uppercase tracking-[0.3em] text-lg">--- End of Day Summary ---</span>
          </div>
        </div>
      )}
    </div>
  );
}

