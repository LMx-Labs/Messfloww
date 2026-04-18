import { useState, useMemo, useEffect, useRef } from "react";
import { Search, BookUser, TrendingDown, TrendingUp, X } from "lucide-react";
import { useOrders } from "../context/OrderContext";
import { useStudents, Student } from "../context/StudentContext";
import { subscribeStudentLedger, subscribeStudentHistoricalOrders } from "../services/firestoreService";
import { useVirtualizer } from "@tanstack/react-virtual";

export function Passbook() {
  const { orders } = useOrders();
  const { students: allStudents } = useStudents();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [historicalOrders, setHistoricalOrders] = useState<any[]>([]);

  const studentListParentRef = useRef<HTMLDivElement>(null);
  const transactionListParentRef = useRef<HTMLDivElement>(null);

  // ... (rest of search/select logic unchanged)

// Subscribe to student ledger when a student is selected
  useEffect(() => {
    if (selectedStudent) {
      const unsubLedger = subscribeStudentLedger(selectedStudent.regNo, (entries) => {
        setLedgerEntries(entries);
      });
      const unsubOrders = subscribeStudentHistoricalOrders(selectedStudent.regNo, (orders) => {
        setHistoricalOrders(orders);
      });
      return () => {
        unsubLedger();
        unsubOrders();
      };
    } else {
      setLedgerEntries([]);
      setHistoricalOrders([]);
    }
  }, [selectedStudent]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery) return allStudents;
    const lowerQuery = searchQuery.toLowerCase();
    return allStudents.filter(
      (student) =>
        student.name.toLowerCase().includes(lowerQuery) ||
        student.regNo.toLowerCase().includes(lowerQuery) ||
        (student.email && student.email.toLowerCase().includes(lowerQuery))
    );
  }, [allStudents, searchQuery]);

  const studentVirtualizer = useVirtualizer({
    count: filteredStudents.length,
    getScrollElement: () => studentListParentRef.current,
    estimateSize: () => 104, // Height of student card
    overscan: 5,
  });

  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
  };

  // ... (transactions logic same as before, see Step 2)

// Process transactions: Combine Ledger (Credits/Topups) and Orders (Debits/Purchases)
  const transactions = useMemo(() => {
    if (!selectedStudent) return [];

    // 1. Get completed orders for this student from active context (recent)
    const activeCompletedOrders = orders.filter(
      (order) => order.userRollNo === selectedStudent.regNo && order.status === "completed"
    );

    // ... (logic continues)

// 2. Map active orders to transaction format
    const activeOrderTransactions = activeCompletedOrders.map((order) => ({
      id: order.id,
      date: order.createdAt ? order.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
      time: order.slotTime,
      type: "debit" as const,
      description: `Order: ${order.items.map(i => i.name).join(", ")}`,
      amount: order.totalPrice,
      timestamp: order.createdAt ? { seconds: new Date(order.createdAt).getTime() / 1000 } : { seconds: 0 },
    }));

    // 3. Map historical orders to transaction format
    const histOrderTransactions = historicalOrders.map((order) => ({
        id: order.id,
        date: order.createdAt ? order.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
        time: order.slotTime,
        type: "debit" as const,
        description: `Order: ${order.items.map((i: any) => i.name).join(", ")}`,
        amount: order.totalPrice,
        timestamp: order.createdAt ? { seconds: new Date(order.createdAt).getTime() / 1000 } : { seconds: 0 },
    }));

    // 4. Map ledger entries (Topups) to transaction format
    const ledgerTransactions = ledgerEntries.map((entry) => ({
      id: entry.id,
      date: entry.timestamp?.seconds 
        ? new Date(entry.timestamp.seconds * 1000).toISOString().split('T')[0] 
        : new Date().toISOString().split('T')[0],
      time: entry.timestamp?.seconds 
        ? new Date(entry.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        : "00:00",
      type: (entry.type === "topup" ? "credit" : "debit") as "credit" | "debit",
      description: entry.description || "Wallet Update",
      amount: entry.amount,
      timestamp: entry.timestamp || { seconds: 0 },
    }));

    // 5. Combine and sort by timestamp desc, removing duplicates by ID
    const allTransactions = [...activeOrderTransactions, ...histOrderTransactions, ...ledgerTransactions];
    const uniqueTransactions = Array.from(new Map(allTransactions.map(t => [t.id, t])).values());

    return uniqueTransactions.sort((a, b) => {
      const timeA = a.timestamp?.seconds || 0;
      const timeB = b.timestamp?.seconds || 0;
      return timeB - timeA;
    });
  }, [selectedStudent, orders, ledgerEntries, historicalOrders]);

  const transactionVirtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => transactionListParentRef.current,
    estimateSize: () => 112, // Height of transaction card
    overscan: 5,
  });

  // ... (rest of stats logic)

  const studentCurrentStats = useMemo(() => {
    if (!selectedStudent) return { totalOrders: 0, totalSpent: 0 };
    
    // Combine active (recent) completed orders and historical orders
    const activeCompletedOrders = orders.filter(
      (order) => order.userRollNo === selectedStudent.regNo && order.status === "completed"
    );
    
    // Unique orders by ID
    const allOrdersMap = new Map();
    activeCompletedOrders.forEach(o => allOrdersMap.set(o.id, o));
    historicalOrders.forEach(o => allOrdersMap.set(o.id, o));
    
    const uniqueOrders = Array.from(allOrdersMap.values());
    const totalSpent = uniqueOrders.reduce((sum, order) => {
      const amount = order.totalPrice;
      return sum + (amount || 0);
    }, 0);

    return {
      totalOrders: uniqueOrders.length,
      totalSpent
    };
  }, [selectedStudent, orders, historicalOrders]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Student Passbook</h1>
          <p className="text-muted-foreground">
            View student account summary and transaction history from Firebase
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student Search Panel */}
        <div className="lg:col-span-1">
          <div className="bg-card rounded-xl border border-border shadow-sm p-6 flex flex-col h-[750px]">
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Student
            </h2>
            
            <div className="mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, reg no, or email..."
                className="bg-input-background text-foreground px-4 py-3 rounded-lg w-full border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div 
              ref={studentListParentRef}
              className="flex-1 overflow-y-auto custom-scrollbar relative"
            >
              {filteredStudents.length > 0 ? (
                <div
                  style={{
                    height: `${studentVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {studentVirtualizer.getVirtualItems().map((virtualRow) => {
                    const student = filteredStudents[virtualRow.index];
                    const isSelected = selectedStudent?.regNo === student.regNo;
                    return (
                      <div
                        key={student.regNo}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                          paddingBottom: '8px'
                        }}
                      >
                        <button
                          onClick={() => handleSelectStudent(student)}
                          className={`w-full h-full text-left p-4 rounded-lg border transition-all ${
                            isSelected
                              ? "bg-primary border-primary text-primary-foreground shadow-md"
                              : "bg-muted border-border hover:bg-muted/80"
                          }`}
                        >
                          <div className="font-semibold truncate">{student.name}</div>
                          <div className="text-sm opacity-80 truncate">{student.regNo}</div>
                          <div className="text-sm mt-1 font-bold">Credits: ₹{student.balance || 0}</div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No students found
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Passbook Details Panel */}
        <div className="lg:col-span-2">
          {selectedStudent ? (
            <div className="space-y-6">
              {/* Student Info Card */}
              <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-primary text-primary-foreground p-3 rounded-xl">
                      <BookUser className="h-8 w-8" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">{selectedStudent.name}</h2>
                      <p className="text-muted-foreground">{selectedStudent.regNo}</p>
                      <p className="text-sm text-muted-foreground">{selectedStudent.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedStudent(null)}
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mt-6">
                  <div className="bg-accent text-accent-foreground p-4 rounded-xl shadow-inner-sm">
                    <div className="text-sm opacity-80 mb-1">Current Credits</div>
                    <div className="text-2xl font-bold">₹{selectedStudent.balance || 0}</div>
                  </div>
                  <div className="bg-muted p-4 rounded-xl">
                    <div className="text-sm text-muted-foreground mb-1">Completed Orders</div>
                    <div className="text-2xl font-bold text-foreground">
                      {studentCurrentStats.totalOrders}
                    </div>
                  </div>
                  <div className="bg-muted p-4 rounded-xl">
                    <div className="text-sm text-muted-foreground mb-1">Total Spent</div>
                    <div className="text-2xl font-bold text-foreground">
                      ₹{studentCurrentStats.totalSpent}
                    </div>
                  </div>
                </div>
              </div>

              {/* Transaction History */}
              <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col h-[500px]">
                <div className="p-6 border-b border-border bg-muted/30 shrink-0">
                  <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <BookUser className="h-5 w-5 text-primary" />
                    Transaction History
                  </h2>
                </div>

                <div 
                  ref={transactionListParentRef}
                  className="flex-1 overflow-y-auto custom-scrollbar relative"
                >
                  {transactions.length > 0 ? (
                    <div
                      style={{
                        height: `${transactionVirtualizer.getTotalSize()}px`,
                        width: '100%',
                        position: 'relative',
                      }}
                    >
                      {transactionVirtualizer.getVirtualItems().map((virtualRow) => {
                        const transaction = transactions[virtualRow.index];
                        return (
                          <div
                            key={transaction.id}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: `${virtualRow.size}px`,
                              transform: `translateY(${virtualRow.start}px)`,
                            }}
                            className="p-6 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-4 flex-1">
                                <div
                                  className={`p-3 rounded-xl shrink-0 ${
                                    transaction.type === "credit"
                                      ? "bg-accent/20 text-accent"
                                      : "bg-destructive/10 text-destructive"
                                  }`}
                                >
                                  {transaction.type === "credit" ? (
                                    <TrendingUp className="h-5 w-5" />
                                  ) : (
                                    <TrendingDown className="h-5 w-5" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-foreground mb-1 truncate">
                                    {transaction.description}
                                  </div>
                                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                                    <span className={transaction.type === "credit" ? "text-accent font-bold" : "text-destructive font-bold"}>
                                      {transaction.type.toUpperCase()}
                                    </span>
                                    <span>•</span>
                                    <span>{transaction.date}</span>
                                    <span>•</span>
                                    <span>{transaction.time}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-right ml-4 shrink-0">
                                <div
                                  className={`text-xl font-bold mb-1 ${
                                    transaction.type === "credit"
                                      ? "text-accent"
                                      : "text-destructive"
                                  }`}
                                >
                                  {transaction.type === "credit" ? "+" : "-"}₹{transaction.amount}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  ID: {transaction.id.slice(-8)}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-12 text-center text-muted-foreground">
                      No transactions found for this student.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border border-dashed shadow-sm p-12 text-center h-[400px] flex flex-col items-center justify-center">
              <BookUser className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">No Student Selected</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Search and select a student from the left panel to view their detailed passbook and transaction history.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}