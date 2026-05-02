import { useState, useRef, useEffect, useMemo } from "react";
import { Upload, Edit, Power, X, Download, AlertCircle, Trash2, Users, RefreshCw, Search as SearchIcon } from "lucide-react";
import { useStudents } from "../../features/students/StudentContext";
import { Student } from "@messflow/shared-core";
import { parseStudentCSV, downloadStudentTemplate, CSVParseResult } from "../../app/utils/csvParser";
import { EmptyState } from "../../app/components/EmptyState";
import { useVirtualizer } from "@tanstack/react-virtual";
import * as studentService from "./studentService";
import { walletService } from "./walletService";
import { toast } from "sonner";

export function StudentsPage() {
  const { students: studentsFromContext, setStudents, refreshStudents, loading } = useStudents();
  const [searchTerm, setSearchTerm] = useState("");
  const parentRef = useRef<HTMLDivElement>(null);
  
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showEditPasswordModal, setShowEditPasswordModal] = useState(false);
  const [showTogglePasswordModal, setShowTogglePasswordModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  const [pendingEditId, setPendingEditId] = useState<number | null>(null);
  const [pendingEditBalance, setPendingEditBalance] = useState("");
  const [pendingToggleId, setPendingToggleId] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  
  const [newName, setNewName] = useState("");
  const [newRegNo, setNewRegNo] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newCredits, setNewCredits] = useState("0");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredStudents = useMemo(() => {
    if (!searchTerm) return studentsFromContext;
    const lowerSearch = searchTerm.toLowerCase();
    return studentsFromContext.filter(s => 
      s.regNo.toLowerCase().includes(lowerSearch) ||
      s.email?.toLowerCase().includes(lowerSearch)
    );
  }, [studentsFromContext, searchTerm]);

  const rowVirtualizer = useVirtualizer({
    count: filteredStudents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 73,
    overscan: 10,
  });



  const handleConfirmAssignBalance = async () => {
    const amount = parseInt(monthlyAmount);
    if (amount > 0) {
      await walletService.assignMonthlyBalanceToAll(amount);
      setShowBalanceModal(false);
      setMonthlyAmount("");
      toast.success("Balance assigned to all students");
    }
  };

  const handleConfirmEditBalance = async () => {
    const studentToEdit = studentsFromContext.find(s => s.id === pendingEditId);
    if (studentToEdit) {
      try {
        await walletService.topUpWalletByRegNo(studentToEdit.regNo, parseInt(pendingEditBalance) || 0);
        toast.success("Balance updated");
        setShowEditPasswordModal(false);
      } catch (error) {
        toast.error("Failed to update balance. Student document might be missing.");
        console.error(error);
      }
    } else {
      setShowEditPasswordModal(false);
    }
  };

  const handleConfirmToggleStatus = async () => {
    const studentToToggle = studentsFromContext.find(s => s.id === pendingToggleId);
    if (studentToToggle) {
      await studentService.updateStudent(studentToToggle.regNo, { 
        status: studentToToggle.status === "active" ? "disabled" : "active" 
      });
      toast.success("Status updated");
    }
    setShowTogglePasswordModal(false);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    const studentToDelete = studentsFromContext.find(s => s.id === pendingDeleteId);
    if (studentToDelete) {
      await studentService.deleteStudentCompletely(studentToDelete.regNo);
      toast.success("Student deleted");
    }
    setShowDeleteModal(false);
    setIsDeleting(false);
  };

  const handleConfirmAddStudent = async () => {
    if (!newName || !newRegNo || !newEmail) {
      toast.error("Required fields missing");
      return;
    }
    setIsSubmitting(true);
    try {
      await studentService.addStudent({
        id: Date.now(),
        name: newName,
        regNo: newRegNo,
        email: newEmail,
        phone: newPhone || "N/A",
        balance: parseInt(newCredits) || 0,
        credits: parseInt(newCredits) || 0,
        status: "active",
      });
      setShowAddModal(false);
      toast.success("Student added");
    } catch (error) {
      toast.error("Failed to add student");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSyncAll = async () => {
    if (isSyncing || studentsFromContext.length === 0) return;
    setIsSyncing(true);
    try {
      await studentService.syncAllStudents(studentsFromContext);
      toast.success("All students synced");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Student Management</h1>
          <p className="text-muted-foreground">{filteredStudents.length} students found</p>
        </div>
        <div className="flex gap-3">
          <button onClick={refreshStudents} disabled={loading} className="bg-muted p-3 rounded-xl"><RefreshCw className={loading ? 'animate-spin' : ''} /></button>
          <button onClick={handleSyncAll} disabled={isSyncing} className="bg-accent text-accent-foreground px-6 py-3 rounded-xl font-semibold">Sync Emails</button>
          <button onClick={() => setShowAddModal(true)} className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold">Add Student</button>
          <button onClick={() => setShowBalanceModal(true)} className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold">Assign Monthly Credits</button>
        </div>
      </div>

      <div className="relative">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search students..." className="w-full bg-card pl-12 pr-4 py-4 rounded-xl border border-border shadow-sm focus:ring-2 focus:ring-primary outline-none" />
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div ref={parentRef} className="overflow-auto h-[600px] custom-scrollbar">
          <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const student = filteredStudents[virtualRow.index];
              return (
                <div key={student.id} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }} className="border-b border-border hover:bg-muted/30 flex items-center px-6">
                  <div className="flex-1 font-bold">{student.name}</div>
                  <div className="flex-1 font-mono text-sm">{student.regNo}</div>
                  <div className="flex-1 text-sm truncate">{student.email}</div>
                  <div className="w-24 font-bold text-lg">₹{student.balance}</div>
                  <div className="w-24 text-center"><span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${student.status === 'active' ? 'bg-accent/20 text-accent' : 'bg-destructive/20 text-destructive'}`}>{student.status}</span></div>
                  <div className="w-32 flex justify-end gap-2">
                    <button onClick={() => { setPendingEditId(student.id); setPendingEditBalance(student.balance.toString()); setShowEditPasswordModal(true); }} className="p-2 bg-primary text-primary-foreground rounded-lg"><Edit className="h-4 w-4" /></button>
                    <button onClick={() => { setPendingToggleId(student.id); setShowTogglePasswordModal(true); }} className="p-2 bg-muted rounded-lg"><Power className="h-4 w-4" /></button>
                    <button onClick={() => { setPendingDeleteId(student.id); setShowDeleteModal(true); }} className="p-2 bg-destructive/10 text-destructive rounded-lg"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Simplified Modals for Breadth */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md p-8 rounded-3xl border border-border space-y-4">
            <h2 className="text-2xl font-bold">Add Student</h2>
            <input type="text" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full bg-input-background p-3 rounded-lg border border-border" />
            <input type="text" placeholder="Reg No" value={newRegNo} onChange={(e) => setNewRegNo(e.target.value)} className="w-full bg-input-background p-3 rounded-lg border border-border" />
            <input type="email" placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full bg-input-background p-3 rounded-lg border border-border" />
            <div className="flex gap-3 pt-4">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 bg-muted rounded-xl">Cancel</button>
              <button onClick={handleConfirmAddStudent} disabled={isSubmitting} className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl">Add</button>
            </div>
          </div>
        </div>
      )}

      {showEditPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card w-full max-w-md p-8 rounded-3xl border border-border space-y-4">
             <h2>Update Balance</h2>
             <input type="number" value={pendingEditBalance} onChange={(e) => setPendingEditBalance(e.target.value)} className="w-full p-3 bg-muted rounded-lg" />
             <div className="flex gap-3">
               <button onClick={() => setShowEditPasswordModal(false)} className="flex-1 py-3 bg-muted rounded-xl">Cancel</button>
               <button onClick={handleConfirmEditBalance} className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl">Update</button>
             </div>
          </div>
        </div>
      )}

      {/* Toggle Modal */}
      {showTogglePasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card w-full max-w-md p-8 rounded-3xl border border-border space-y-4">
             <h2>Confirm Status Toggle</h2>
             <div className="flex gap-3">
               <button onClick={() => setShowTogglePasswordModal(false)} className="flex-1 py-3 bg-muted rounded-xl">Cancel</button>
               <button onClick={handleConfirmToggleStatus} className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl">Confirm</button>
             </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card w-full max-w-md p-8 rounded-3xl border border-destructive/20 space-y-4">
             <h2 className="text-destructive">Delete Student Account</h2>
             <p className="text-sm opacity-70">This will completely remove the student from the system. This cannot be undone.</p>
             <div className="flex gap-3">
               <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-3 bg-muted rounded-xl">Cancel</button>
               <button onClick={handleConfirmDelete} disabled={isDeleting} className="flex-1 py-3 bg-destructive text-destructive-foreground rounded-xl">Delete</button>
             </div>
          </div>
        </div>
      )}

      {/* Assign Balance Modal */}
      {showBalanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card w-full max-w-md p-8 rounded-3xl border border-border space-y-4">
             <h2>Monthly Credits Reset</h2>
             <input type="number" placeholder="Amount (e.g. 2500)" value={monthlyAmount} onChange={(e) => setMonthlyAmount(e.target.value)} className="w-full p-3 bg-muted rounded-lg" />
             <div className="flex gap-3">
               <button onClick={() => setShowBalanceModal(false)} className="flex-1 py-3 bg-muted rounded-xl">Cancel</button>
               <button onClick={handleConfirmAssignBalance} className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl">Assign to All</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
