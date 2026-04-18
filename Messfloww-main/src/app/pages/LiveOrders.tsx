import { Check, Download, PackageOpen, Printer } from "lucide-react";
import { useState, useEffect } from "react";
import { useOrders } from "../context/OrderContext";
import { useStudents } from "../context/StudentContext";
import { EmptyState } from "../components/EmptyState";
import { fetchSettings } from "../services/firestoreService";
import { rtdbService } from "../services/rtdbService";
import { printReceipt, mapOrderToBill } from "../modules/ThermalPrinter";

export function LiveOrders() {
  const { orders } = useOrders();
  const { students } = useStudents();
  const [settings, setSettings] = useState<any>(null);
  
  useEffect(() => {
    fetchSettings().then(setSettings);
  }, []);

  const activeOrders = orders.filter(o => o.status !== "completed");
  
  const handlePrint = async (order: any) => {
    let student: any;
    if (!order.isExternal && order.userRollNo) {
      student = students.find(s => s.regNo.trim().toUpperCase() === order.userRollNo.trim().toUpperCase());
    }
    
    // Auto complete the order on print to prevent double-redemptions
    await rtdbService.updateActiveOrderStatus(order.id, 'status', 'completed');
    
    // Use ThermalPrinter module for consistent printing
    printReceipt(mapOrderToBill(order, student), settings);
  };
  
  const downloadLiveOrdersReport = () => {
    // Prepare CSV content
    let csvContent = "MessFlow Live Orders Report\n";
    csvContent += `Generated: ${new Date().toLocaleString()}\n`;
    csvContent += `Total Active Orders: ${activeOrders.length}\n\n`;
    
    csvContent += "Order ID,Student Name,Student ID,Items,Amount,Time,Status\n";
    
    activeOrders.forEach(order => {
      const itemsList = order.items.map(i => `${i.name} x${i.qty}`).join(' | ');
      csvContent += `${order.id},"${order.externalLabel || ''}",${order.userRollNo},"${itemsList}",${order.totalPrice},${order.createdAt},${order.status}\n`;
    });
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `MessFlow_Live_Orders_${new Date().toISOString().split('T')[0]}_${new Date().toTimeString().split(' ')[0].replace(/:/g, '-')}.csv`;
    link.click();
  };
  
  return (
    <div className="space-y-6 print:hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Live Orders</h1>
          <p className="text-muted-foreground">
            Real-time order monitoring • {activeOrders.length} active orders
          </p>
        </div>
        <button
          onClick={downloadLiveOrdersReport}
          className="bg-primary hover:bg-secondary text-primary-foreground px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors"
        >
          <Download className="h-5 w-5" />
          Download Report
        </button>
      </div>

      {/* Orders Grid */}
      {activeOrders.length === 0 ? (
        <div className="py-12 bg-card rounded-xl border border-border shadow-sm">
          <EmptyState 
            icon={PackageOpen}
            title="No active orders"
            description="Incoming orders will automatically appear here."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {activeOrders.map((order) => (
          <div
            key={order.id}
            className="bg-card rounded-xl p-5 border border-border shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Order Header */}
            <div className="mb-4 pb-3 border-b border-border flex justify-between items-start gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-lg text-foreground mb-1 truncate">{order.id}</h3>
                <p className="text-foreground truncate">{order.externalLabel || order.userRollNo}</p>
                <p className="text-sm text-muted-foreground truncate">{order.userRollNo}</p>
              </div>
              <button
                onClick={() => handlePrint(order)}
                className="shrink-0 p-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground rounded-xl transition-all shadow-sm"
                title="Print Receipt"
              >
                <Printer className="h-5 w-5" />
              </button>
            </div>

            {/* Items List */}
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2 font-semibold">ITEMS</p>
              <ul className="space-y-1">
                {order.items.map((item, idx) => (
                  <li key={idx} className="text-sm text-foreground flex items-start">
                    <span className="text-accent mr-2">•</span>
                    {item.name} x{item.qty}
                  </li>
                ))}
              </ul>
            </div>

            {/* Time and Amount */}
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-border">
              <div className="text-muted-foreground text-sm">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              <div className="font-bold text-lg text-foreground">₹{order.totalPrice}</div>
            </div>

            {/* Status Indicators */}
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <span className="text-sm font-semibold text-foreground">Status</span>
                <div className="flex items-center gap-2">
                  {order.status === "completed" ? (
                    <div className="flex items-center gap-1 text-accent font-black uppercase text-[10px] tracking-widest bg-accent/10 px-2 py-1 rounded">
                      <Check className="h-3 w-3" />
                      Completed
                    </div>
                  ) : order.status === "preparing" ? (
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1 text-indigo-500 font-black uppercase text-[10px] tracking-widest bg-indigo-500/10 px-2 py-1 rounded">
                        Preparing
                      </div>
                    </div>
                  ) : order.status === "ordered" ? (
                    <div className="flex items-center gap-1 text-amber-500 font-black uppercase text-[10px] tracking-widest bg-amber-500/10 px-2 py-1 rounded">
                      Order Placed
                    </div>
                  ) : (
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2 py-1 bg-muted rounded">
                      {order.status}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        </div>
      )}
    </div>
  );
}