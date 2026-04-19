import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { ChevronDown, ChevronUp, Filter, Download, FileText, RefreshCw, Loader2 } from "lucide-react";
import { EmptyState } from "../../app/components/EmptyState";
import * as financeService from "./financeService";
import { collection, getDocs, query, orderBy, limit, QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "@messflow/shared-core";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

export function LedgerPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterMealType, setFilterMealType] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("");
  
  const parentRef = useRef<HTMLDivElement>(null);

  const fetchInitialData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const activeQ = query(collection(db, "active_orders"), orderBy("createdAt", "desc"), limit(50));
      const activeSnap = await getDocs(activeQ);
      const activeData = activeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const { orders: histOrders, lastDoc: newLastDoc, hasMore: newHasMore } = await financeService.fetchLedgerPage(50);
      setOrders([...activeData, ...histOrders]);
      setLastDoc(newLastDoc);
      setHasMore(newHasMore);
    } catch (e) {
      toast.error("Failed to fetch ledger");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const loadMore = async () => {
    if (!hasMore || loadingMore || !lastDoc) return;
    setLoadingMore(true);
    try {
      const { orders: newOrders, lastDoc: nextLastDoc, hasMore: nextHasMore } = await financeService.fetchLedgerPage(50, lastDoc);
      setOrders(prev => [...prev, ...newOrders]);
      setLastDoc(nextLastDoc);
      setHasMore(nextHasMore);
    } finally {
      setLoadingMore(false);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const mealType = order.slotName || "General";
      const mealTypeMatch = filterMealType === "all" || mealType.toLowerCase() === filterMealType.toLowerCase();
      const dateStr = new Date(order.createdAt).toISOString().split('T')[0];
      const dateMatch = !filterDate || dateStr === filterDate;
      return mealTypeMatch && dateMatch;
    });
  }, [orders, filterMealType, filterDate]);

  const rowVirtualizer = useVirtualizer({
    count: filteredOrders.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 73,
    overscan: 10,
  });

  if (loading && !refreshing) return <div className="h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between bg-card p-6 rounded-2xl border border-border shadow-sm">
        <div>
          <h1 className="text-3xl font-black">Order Ledger</h1>
          <p className="text-muted-foreground">Complete transaction history and record keeping</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => fetchInitialData(true)} className="p-3 bg-muted rounded-xl"><RefreshCw className={refreshing ? 'animate-spin' : ''} /></button>
          <button className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold shadow-sm">
             <Download className="w-5 h-5" /> Download Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-card p-6 rounded-2xl border border-border shadow-sm">
        <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Date</label>
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="w-full bg-input-background p-3 rounded-xl border border-border font-bold" />
        </div>
        <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Meal</label>
            <select value={filterMealType} onChange={e => setFilterMealType(e.target.value)} className="w-full bg-input-background p-3 rounded-xl border border-border font-bold">
                <option value="all">All Meals</option>
                <option value="Breakfast">Breakfast</option>
                <option value="Lunch">Lunch</option>
                <option value="Snacks">Snacks</option>
                <option value="Dinner">Dinner</option>
                <option value="Night">Night</option>
            </select>
        </div>
        <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Revenue</label>
            <div className="p-3 bg-accent/10 border border-accent/20 rounded-xl font-black text-xl text-accent">₹{filteredOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0)}</div>
        </div>
      </div>

      <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
        <div ref={parentRef} className="overflow-auto h-[600px] custom-scrollbar">
            <div style={{ height: rowVirtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const order = filteredOrders[virtualRow.index];
                    const isExpanded = expandedId === order.id;
                    const dateObj = new Date(order.createdAt);
                    return (
                        <div key={order.id} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: virtualRow.size, transform: `translateY(${virtualRow.start}px)` }} className="border-b border-border flex flex-col">
                            <div className="flex items-center px-6 py-4">
                                <span className="flex-1 font-mono text-xs opacity-50">{order.id.slice(-8)}</span>
                                <span className="flex-[2] font-black">{order.externalLabel || order.userRollNo}</span>
                                <span className="flex-1 text-sm font-bold opacity-70">{dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <span className="w-24 font-black text-lg">₹{order.totalPrice}</span>
                                <span className={`w-24 px-2 py-1 rounded-full text-[10px] font-black text-center uppercase ${order.status === 'completed' ? 'bg-accent/20 text-accent' : 'bg-amber-500/20 text-amber-500'}`}>{order.status}</span>
                                <button onClick={() => setExpandedId(isExpanded ? null : order.id)} className="w-10 h-10 flex items-center justify-center hover:bg-muted rounded-full transition-colors">
                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                            </div>
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-6 pb-4 bg-muted/20 border-t border-border overflow-hidden">
                                        <div className="py-4 grid grid-cols-2 gap-4">
                                            {order.items.map((i: any, idx: number) => (
                                                <div key={idx} className="flex justify-between text-sm p-2 bg-card rounded-lg border border-border">
                                                    <span className="font-bold">{i.name}</span>
                                                    <span className="opacity-50">x{i.qty}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>
            {hasMore && (
                <button onClick={loadMore} disabled={loadingMore} className="w-full py-6 font-black opacity-50 hover:opacity-100 transition-opacity">
                    {loadingMore ? 'Loading...' : 'LOAD MORE RECORDS'}
                </button>
            )}
        </div>
      </div>
    </div>
  );
}
