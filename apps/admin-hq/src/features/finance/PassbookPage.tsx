import { useState, useMemo, useEffect, useRef } from "react";
import { Search, BookUser, TrendingDown, TrendingUp, X } from "lucide-react";
import { useStudents } from "../../features/students/StudentContext";
import { Student } from "@messflow/shared-core";
import * as financeService from "./financeService";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion, AnimatePresence } from "motion/react";
import { ref, get, query as rtdbQuery, orderByChild, equalTo } from "firebase/database";
import { rtdb } from "@messflow/shared-core";

export function PassbookPage() {
  const { students: allStudents } = useStudents();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [historicalOrders, setHistoricalOrders] = useState<any[]>([]);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);

  const studentListParentRef = useRef<HTMLDivElement>(null);
  const transactionListParentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedStudent) {
      const unsubLedger = financeService.subscribeStudentLedger(selectedStudent.regNo, setLedgerEntries);
      const unsubOrders = financeService.subscribeStudentHistoricalOrders(selectedStudent.regNo, setHistoricalOrders);
      
      // Fetch active orders for this student
      const activeOrdersRef = ref(rtdb, "active_orders");
      const userOrdersQuery = rtdbQuery(activeOrdersRef, orderByChild("userRollNo"), equalTo(selectedStudent.regNo));
      get(userOrdersQuery).then((snapshot) => {
        if (snapshot.exists()) {
          const orders: any[] = [];
          snapshot.forEach((child) => {
            orders.push({ id: child.key, ...child.val() });
          });
          setActiveOrders(orders);
        } else {
          setActiveOrders([]);
        }
      });

      return () => {
        unsubLedger();
        unsubOrders();
      };
    } else {
      setLedgerEntries([]);
      setHistoricalOrders([]);
      setActiveOrders([]);
    }
  }, [selectedStudent]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery) return allStudents;
    const lowerQuery = searchQuery.toLowerCase();
    return allStudents.filter(s => s.name.toLowerCase().includes(lowerQuery) || s.regNo.toLowerCase().includes(lowerQuery));
  }, [allStudents, searchQuery]);

  const transactions = useMemo(() => {
    if (!selectedStudent) return [];
    
    // Non-wallet orders from active and historical orders
    const allOrders = [...activeOrders, ...historicalOrders];
    const nonWalletOrders = allOrders.filter(o => o.payment_mode !== 'credits' && o.payment_mode !== 'credit');
    
    const orderTransactions = nonWalletOrders.map(o => ({
      id: o.id,
      date: o.createdAt ? o.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
      type: "debit" as const,
      description: `Order (${o.payment_mode || 'External'}): ${o.items?.map((i: any) => i.name).join(", ")}`,
      amount: o.totalPrice,
      timestamp: { seconds: new Date(o.createdAt || Date.now()).getTime() / 1000 }
    }));

    const ledgerTransactions = ledgerEntries.map(e => ({
      id: e.id,
      date: e.timestamp?.seconds ? new Date(e.timestamp.seconds * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      type: (e.type === "topup" ? "credit" : "debit") as "credit" | "debit",
      description: e.description || (e.type === "purchase" ? "Wallet Purchase" : "Wallet Top-up"),
      amount: e.amount,
      timestamp: e.timestamp || { seconds: Date.now() / 1000 }
    }));

    const all = [...orderTransactions, ...ledgerTransactions];
    const unique = Array.from(new Map(all.map(t => [t.id, t])).values());
    return unique.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
  }, [selectedStudent, ledgerEntries, historicalOrders, activeOrders]);

  const studentVirtualizer = useVirtualizer({
    count: filteredStudents.length,
    getScrollElement: () => studentListParentRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });

  const transactionVirtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => transactionListParentRef.current,
    estimateSize: () => 112,
    overscan: 5,
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
        <h1 className="text-3xl font-black">Student Passbook</h1>
        <p className="text-muted-foreground">Comprehensive wallet and transaction history for students</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card rounded-2xl border border-border p-6 flex flex-col h-[700px]">
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search students..." className="w-full bg-input-background pl-10 pr-4 py-3 rounded-xl border border-border font-bold" />
          </div>
          <div ref={studentListParentRef} className="flex-1 overflow-auto custom-scrollbar relative">
            <div style={{ height: studentVirtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
                {studentVirtualizer.getVirtualItems().map(virtualRow => {
                    const student = filteredStudents[virtualRow.index];
                    const selected = selectedStudent?.regNo === student.regNo;
                    return (
                        <button key={student.regNo} onClick={() => setSelectedStudent(student)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: virtualRow.size - 8, transform: `translateY(${virtualRow.start}px)` }} className={`p-4 rounded-xl border text-left transition-all ${selected ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/30 border-border hover:bg-muted'}`}>
                            <div className="font-black truncate">{student.name}</div>
                            <div className="text-xs opacity-50 font-mono">{student.regNo}</div>
                            <div className="mt-2 font-black">₹{student.balance}</div>
                        </button>
                    );
                })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {selectedStudent ? (
            <>
              <div className="bg-card p-8 rounded-3xl border border-border flex justify-between items-start">
                <div className="flex gap-6">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center"><BookUser className="w-8 h-8 text-primary" /></div>
                    <div>
                        <h2 className="text-3xl font-black">{selectedStudent.name}</h2>
                        <p className="font-mono text-muted-foreground">{selectedStudent.regNo}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xs font-black uppercase text-muted-foreground">Credits</p>
                    <p className="text-4xl font-black text-accent">₹{selectedStudent.balance}</p>
                </div>
              </div>

              <div className="bg-card rounded-3xl border border-border overflow-hidden h-[500px] flex flex-col">
                <div className="p-6 border-b border-border bg-muted/20"><h3 className="font-black">History</h3></div>
                <div ref={transactionListParentRef} className="flex-1 overflow-auto relative custom-scrollbar">
                    <div style={{ height: transactionVirtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
                        {transactionVirtualizer.getVirtualItems().map(virtualRow => {
                            const t = transactions[virtualRow.index];
                            return (
                                <div key={t.id} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: virtualRow.size, transform: `translateY(${virtualRow.start}px)` }} className="p-6 border-b border-border flex justify-between items-center last:border-0 hover:bg-muted/10">
                                    <div className="flex gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${t.type === 'credit' ? 'bg-accent/10 text-accent' : 'bg-destructive/10 text-destructive'}`}>
                                            {t.type === 'credit' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm">{t.description}</p>
                                            <p className="text-xs opacity-50 font-bold">{t.date}</p>
                                        </div>
                                    </div>
                                    <div className={`text-xl font-black ${t.type === 'credit' ? 'text-accent' : 'text-destructive'}`}>
                                        {t.type === 'credit' ? '+' : '-'}₹{t.amount}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-card border-2 border-dashed border-border rounded-3xl opacity-50">
                <BookUser className="w-20 h-20 mb-4" />
                <h2 className="text-xl font-black">Select a student</h2>
                <p>Choose a student from the list to view their passbook</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
