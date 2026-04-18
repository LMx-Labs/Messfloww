import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { ChevronDown, ChevronUp, Filter, Download, FileText, RefreshCw, Loader2 } from "lucide-react";
import { EmptyState } from "../components/EmptyState";
import { fetchLedgerPage, fetchAllHistoricalOrders } from "../services/firestoreService";
import { collection, getDocs, query, orderBy, limit, QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useVirtualizer } from "@tanstack/react-virtual";

export function Ledger() {
  const [orders, setOrders] = useState<any[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  const parentRef = useRef<HTMLDivElement>(null);

  const fetchInitialData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
    try {
      // 1. Fetch Active Orders once (non-realtime)
      const activeQ = query(collection(db, "active_orders"), orderBy("createdAt", "desc"), limit(50));
      const activeSnap = await getDocs(activeQ);
      const activeData = activeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // 2. Fetch first page of Historical Orders
      const { orders: histOrders, lastDoc: newLastDoc, hasMore: newHasMore } = await fetchLedgerPage(50);
      
      setOrders([...activeData, ...histOrders]);
      setLastDoc(newLastDoc);
      setHasMore(newHasMore);
    } catch (e) {
      console.error("Failed to fetch ledger data:", e);
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
      const { orders: newOrders, lastDoc: nextLastDoc, hasMore: nextHasMore } = await fetchLedgerPage(50, lastDoc);
      setOrders(prev => [...prev, ...newOrders]);
      setLastDoc(nextLastDoc);
      setHasMore(nextHasMore);
    } catch (e) {
      console.error("Failed to load more ledger entries:", e);
    } finally {
      setLoadingMore(false);
    }
  };

  // Map raw orders to the format expected by the Ledger UI
  const ledgerData = useMemo(() => {
    return orders.map(order => {
      const dateObj = new Date(order.createdAt);
      const mealType = order.slotName || "General";
      const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = dateObj.toISOString().split('T')[0];

      return {
        id: order.id,
        student: order.externalLabel || order.userRollNo,
        items: order.items.map((i: any) => `${i.name} x${i.qty}`),
        date: dateStr,
        time: timeStr,
        mealType: mealType.charAt(0).toUpperCase() + mealType.slice(1),
        amount: order.totalPrice || 0,
        status: order.status
      };
    });
  }, [orders]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterMealType, setFilterMealType] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("");

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const filteredOrders = useMemo(() => {
    return ledgerData.filter((order) => {
      const mealTypeMatch = filterMealType === "all" || order.mealType === filterMealType;
      const dateMatch = !filterDate || order.date === filterDate;
      return mealTypeMatch && dateMatch;
    });
  }, [ledgerData, filterMealType, filterDate]);

  const totalRevenue = useMemo(() => {
    return filteredOrders
      .filter((o) => o.status === "completed")
      .reduce((sum, order) => sum + order.amount, 0);
  }, [filteredOrders]);

  const downloadLedgerReport = async () => {
    setExporting(true);
    try {
      // Fetch everything for the report
      const allHistorical = await fetchAllHistoricalOrders();
      // Also get current active orders to be comprehensive
      const activeQ = query(collection(db, "active_orders"), orderBy("createdAt", "desc"));
      const activeSnap = await getDocs(activeQ);
      const activeData = activeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const reportData = [...activeData, ...allHistorical].map((order: any) => {
        const dateObj = new Date(order.createdAt);
        const mealType = order.slotName || "General";
        const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = dateObj.toISOString().split('T')[0];

        return {
          id: order.id,
          student: order.externalLabel || order.userRollNo,
          items: order.items.map((i: any) => `${i.name} x${i.qty}`),
          date: dateStr,
          time: timeStr,
          mealType: mealType.charAt(0).toUpperCase() + mealType.slice(1),
          amount: order.totalPrice || 0,
          status: order.status
        };
      });

      // Filter based on UI filters if they are set
      const filteredReport = reportData.filter((order) => {
        const mealTypeMatch = filterMealType === "all" || order.mealType === filterMealType;
        const dateMatch = !filterDate || order.date === filterDate;
        return mealTypeMatch && dateMatch;
      });

      let csvContent = "MessFlow Basic Ledger Report\n";
      csvContent += `Generated: ${new Date().toLocaleString()}\n`;
      csvContent += `Filter - Date: ${filterDate || 'All'}, Meal Type: ${filterMealType === 'all' ? 'All' : filterMealType}\n\n`;
      csvContent += "Order ID,Student,Meal Type,Items,Date,Time,Amount,Status\n";
      
      filteredReport.forEach(order => {
        const itemsList = order.items.join(' | ');
        csvContent += `${order.id},"${order.student}",${order.mealType},"${itemsList}",${order.date},${order.time},₹${order.amount},${order.status}\n`;
      });
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `MessFlow_Ledger_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } catch (e) {
      console.error("Failed to export ledger:", e);
      alert("Failed to export ledger. Please check console.");
    } finally {
      setExporting(false);
    }
  };

  const rowVirtualizer = useVirtualizer({
    count: filteredOrders.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (expandedId ? 180 : 73), // dynamic height if expanded
    overscan: 10,
  });

  if (loading && !refreshing) {
    return (
      <div className="h-full w-full flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent animate-spin rounded-full" />
          <p className="text-muted-foreground font-semibold">Loading Ledger...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Order Ledger</h1>
          <p className="text-muted-foreground">
            Complete order history and transaction records
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => fetchInitialData(true)}
            disabled={refreshing}
            className="bg-muted hover:bg-muted/80 text-foreground px-4 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
            title="Refresh Ledger"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={downloadLedgerReport}
            disabled={exporting}
            className="bg-primary hover:bg-secondary text-primary-foreground px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Download className="h-5 w-5" />
            )}
            {exporting ? "Preparing..." : "Download Report"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-bold text-foreground">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Date Range
            </label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full bg-input-background text-foreground px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Meal Type
            </label>
            <select
              value={filterMealType}
              onChange={(e) => setFilterMealType(e.target.value)}
              className="w-full bg-input-background text-foreground px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Meals</option>
              <option value="Breakfast">Breakfast</option>
              <option value="Lunch">Lunch</option>
              <option value="Snacks">Snacks</option>
              <option value="Dinner">Dinner</option>
              <option value="Night">Night</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Total Revenue
            </label>
            <div className="bg-accent text-accent-foreground px-4 py-3 rounded-lg font-bold text-xl">
              ₹{totalRevenue}
            </div>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {filteredOrders.length === 0 ? (
            <div className="p-12">
               <EmptyState 
                  icon={FileText}
                  title="No transactions found"
                  description="Processed orders and completed payments will appear here. Try adjusting your filters."
               />
            </div>
          ) : (
            <div className="min-w-[1000px]">
              {/* Sticky Header */}
              <table className="w-full table-fixed border-b border-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left py-4 px-6 text-foreground font-bold w-[15%]">Order ID</th>
                    <th className="text-left py-4 px-6 text-foreground font-bold w-[20%]">Student</th>
                    <th className="text-left py-4 px-6 text-foreground font-bold w-[12%]">Meal Type</th>
                    <th className="text-left py-4 px-6 text-foreground font-bold w-[12%]">Date</th>
                    <th className="text-left py-4 px-6 text-foreground font-bold w-[12%]">Time</th>
                    <th className="text-left py-4 px-6 text-foreground font-bold w-[10%]">Amount</th>
                    <th className="text-left py-4 px-6 text-foreground font-bold w-[10%]">Status</th>
                    <th className="text-center py-4 px-6 text-foreground font-bold w-[9%]">Details</th>
                  </tr>
                </thead>
              </table>

              {/* Scrollable Body */}
              <div
                ref={parentRef}
                className="overflow-y-auto custom-scrollbar"
                style={{ height: '600px' }}
              >
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const order = filteredOrders[virtualRow.index];
                    const isExpanded = expandedId === order.id;
                    return (
                      <div
                        key={order.id}
                        data-index={virtualRow.index}
                        ref={rowVirtualizer.measureElement}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                        className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <table className="w-full table-fixed">
                          <tbody>
                            <tr className="flex items-center">
                              <td className="py-4 px-6 font-bold text-foreground w-[15%] truncate">{order.id}</td>
                              <td className="py-4 px-6 text-foreground w-[20%] truncate">{order.student}</td>
                              <td className="py-4 px-6 w-[12%]">
                                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/20 text-primary-foreground">
                                  {order.mealType}
                                </span>
                              </td>
                              <td className="py-4 px-6 text-foreground w-[12%]">{order.date}</td>
                              <td className="py-4 px-6 text-muted-foreground w-[12%]">{order.time}</td>
                              <td className="py-4 px-6 font-bold text-foreground w-[10%] truncate">₹{order.amount}</td>
                              <td className="py-4 px-6 w-[10%]">
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                    order.status === "completed"
                                      ? "bg-accent text-accent-foreground"
                                      : order.status === "failed"
                                      ? "bg-destructive text-destructive-foreground"
                                      : "bg-yellow-500 text-white"
                                  }`}
                                >
                                  {order.status}
                                </span>
                              </td>
                              <td className="py-4 px-6 w-[9%] flex justify-center">
                                <button
                                  onClick={() => toggleExpand(order.id)}
                                  className="p-2 rounded-lg hover:bg-muted transition-colors shrink-0"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4 text-foreground" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-foreground" />
                                  )}
                                </button>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-muted/50 w-full flex">
                                <td colSpan={8} className="py-4 px-6 w-full">
                                  <div className="bg-card rounded-lg p-4 border border-border shadow-inner">
                                    <h4 className="font-bold text-sm text-foreground mb-2 flex items-center gap-2">
                                      <FileText className="h-4 w-4 text-primary" />
                                      Order Items:
                                    </h4>
                                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                      {order.items.map((item: string, idx: number) => (
                                        <li key={idx} className="flex items-center text-sm text-foreground bg-muted/30 p-2 rounded">
                                          <span className="text-accent mr-2">•</span>
                                          {item}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
                
                {/* Load More Button at the bottom of the list */}
                {hasMore && (
                  <div className="p-6 flex justify-center border-t border-border bg-muted/10">
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="bg-primary hover:bg-secondary text-primary-foreground px-8 py-3 rounded-xl font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Loading More...
                        </>
                      ) : (
                        "Load 50 More Records"
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl p-6 border border-border">
          <p className="text-muted-foreground mb-1">Total Orders</p>
          <p className="text-3xl font-bold text-foreground">{filteredOrders.length}</p>
        </div>
        <div className="bg-card rounded-xl p-6 border border-border">
          <p className="text-muted-foreground mb-1">Completed</p>
          <p className="text-3xl font-bold text-accent">
            {filteredOrders.filter((o) => o.status === "completed").length}
          </p>
        </div>
        <div className="bg-card rounded-xl p-6 border border-border">
          <p className="text-muted-foreground mb-1">Failed</p>
          <p className="text-3xl font-bold text-destructive">
            {filteredOrders.filter((o) => o.status === "failed").length}
          </p>
        </div>
        <div className="bg-card rounded-xl p-6 border border-border">
          <p className="text-muted-foreground mb-1">Avg Order Value</p>
          <p className="text-3xl font-bold text-foreground">
            ₹{Math.round(totalRevenue / filteredOrders.filter((o) => o.status === "completed").length) || 0}
          </p>
        </div>
      </div>
    </div>
  );
}