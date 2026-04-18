import { useState, useRef, useEffect, useMemo } from "react";
import { Upload, DollarSign, Edit, Power, X, Check, Download, AlertCircle, FileText, Trash2, Users, RefreshCw, Search as SearchIcon } from "lucide-react";
import { useStudents, Student } from "../context/StudentContext";
import { parseStudentCSV, downloadStudentTemplate, CSVParseResult } from "../utils/csvParser";
import { EmptyState } from "../components/EmptyState";
import { checkActionRateLimit, recordFailedAction, resetActionRateLimit } from "../utils/rateLimiter";
import { useVirtualizer } from "@tanstack/react-virtual";

export function Students() {
  const { students: studentsFromContext, setStudents, refreshStudents, loading } = useStudents();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const parentRef = useRef<HTMLDivElement>(null);
  
  const [editBalance, setEditBalance] = useState("");
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [password, setPassword] = useState("");
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showPasswordError, setShowPasswordError] = useState(false);
  const [showEditPasswordModal, setShowEditPasswordModal] = useState(false);
  const [showTogglePasswordModal, setShowTogglePasswordModal] = useState(false);
  const [editPassword, setEditPassword] = useState("");
  const [togglePassword, setTogglePassword] = useState("");
  const [pendingEditId, setPendingEditId] = useState<number | null>(null);
  const [pendingEditBalance, setPendingEditBalance] = useState("");
  const [pendingToggleId, setPendingToggleId] = useState<number | null>(null);
  const [showEditPasswordError, setShowEditPasswordError] = useState(false);
  const [showTogglePasswordError, setShowTogglePasswordError] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRegNo, setNewRegNo] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newCredits, setNewCredits] = useState("0");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Deletion States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [showDeletePasswordError, setShowDeletePasswordError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Memoized filtering for search
  const filteredStudents = useMemo(() => {
    if (!searchTerm) return studentsFromContext;
    const lowerSearch = searchTerm.toLowerCase();
    return studentsFromContext.filter(s => 
      s.name.toLowerCase().includes(lowerSearch) ||
      s.regNo.toLowerCase().includes(lowerSearch) ||
      s.email?.toLowerCase().includes(lowerSearch)
    );
  }, [studentsFromContext, searchTerm]);

  // Virtualizer setup
  const rowVirtualizer = useVirtualizer({
    count: filteredStudents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 73, // Height of each row in pixels
    overscan: 10,
  });

  // Lockout interval check
  useEffect(() => {
    if (!showBalanceModal && !showEditPasswordModal && !showTogglePasswordModal && !showAddModal) return;
    const checkLockout = () => {
      const rateLimit = checkActionRateLimit('students_action');
      if (!rateLimit.allowed) {
        setLockoutSeconds(rateLimit.remainingSeconds);
        setShowPasswordError(true);
        setShowEditPasswordError(true);
        setShowTogglePasswordError(true);
      } else {
        if (lockoutSeconds > 0) {
           setShowPasswordError(false);
           setShowEditPasswordError(false);
           setShowTogglePasswordError(false);
        }
        setLockoutSeconds(0);
      }
    };
    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, [showBalanceModal, showEditPasswordModal, showTogglePasswordModal, showDeleteModal, lockoutSeconds]);

  // CSV Upload States
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [parseResult, setParseResult] = useState<CSVParseResult<Student> | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleToggleStatus = (id: number) => {
    setPendingToggleId(id);
    setShowTogglePasswordModal(true);
  };

  const handleDeleteClick = (id: number) => {
    setPendingDeleteId(id);
    setShowDeleteModal(true);
  };

  const handleEditBalance = (id: number, currentBalance: number) => {
    setPendingEditId(id);
    setPendingEditBalance(currentBalance.toString());
    setShowEditPasswordModal(true);
  };

  const handleSaveBalance = (id: number) => {
    const newBalance = parseInt(editBalance) || 0;
    setStudents(
      studentsFromContext.map((student) =>
        student.id === id ? { ...student, balance: newBalance } : student
      )
    );
    setEditingId(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = parseStudentCSV(text);
      setParseResult(result);
    };
    reader.readAsText(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = () => {
    setIsDragOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === "text/csv") {
      processFile(file);
    }
  };

  const handleConfirmUpload = () => {
    if (parseResult && parseResult.valid.length > 0) {
      // Replace All mode (default)
      setStudents(parseResult.valid);
      setShowUploadModal(false);
      setParseResult(null);
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
    }
  };

  const handleAssignMonthlyBalance = () => {
    setShowBalanceModal(true);
  };

  const handleConfirmAssignBalance = async () => {
    const rateLimit = checkActionRateLimit('students_action');
    if (!rateLimit.allowed) return;

    const { fetchActionPassword } = await import("../services/firestoreService");
    const storedPasswordBtoa = await fetchActionPassword();
    const actualPassword = storedPasswordBtoa ? atob(storedPasswordBtoa) : "12345";

    if (password !== actualPassword) {
      recordFailedAction('students_action');
      setShowPasswordError(true);
      setTimeout(() => setShowPasswordError(false), 3000);
      return;
    }
    resetActionRateLimit('students_action');

    const amount = parseInt(monthlyAmount);
    if (amount && amount > 0) {
      const { walletService } = await import("../services/walletService");
      await walletService.assignMonthlyBalanceToAll(amount);
      
      setShowBalanceModal(false);
      setMonthlyAmount("");
      setPassword("");
      setShowPasswordError(false);
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
    }
  };

  const handleCancelModal = () => {
    setShowBalanceModal(false);
    setMonthlyAmount("");
    setPassword("");
    setShowPasswordError(false);
  };

  const handleConfirmEditBalance = async () => {
    const rateLimit = checkActionRateLimit('students_action');
    if (!rateLimit.allowed) return;

    const { fetchActionPassword } = await import("../services/firestoreService");
    const storedPasswordBtoa = await fetchActionPassword();
    const actualPassword = storedPasswordBtoa ? atob(storedPasswordBtoa) : "12345";

    if (editPassword !== actualPassword) {
      recordFailedAction('students_action');
      setShowEditPasswordError(true);
      setTimeout(() => setShowEditPasswordError(false), 3000);
      return;
    }
    resetActionRateLimit('students_action');

    const newBalance = parseInt(pendingEditBalance) || 0;
    const studentToEdit = studentsFromContext.find(s => s.id === pendingEditId);
    if (studentToEdit) {
      const { walletService } = await import("../services/walletService");
      await walletService.topUpWalletByRegNo(studentToEdit.regNo, newBalance);
    }
    setShowEditPasswordModal(false);
    setPendingEditId(null);
    setPendingEditBalance("");
    setEditPassword("");
    setShowEditPasswordError(false);
  };

  const handleConfirmToggleStatus = async () => {
    const rateLimit = checkActionRateLimit('students_action');
    if (!rateLimit.allowed) return;

    const { fetchActionPassword } = await import("../services/firestoreService");
    const storedPasswordBtoa = await fetchActionPassword();
    const actualPassword = storedPasswordBtoa ? atob(storedPasswordBtoa) : "12345";

    if (togglePassword !== actualPassword) {
      recordFailedAction('students_action');
      setShowTogglePasswordError(true);
      setTimeout(() => setShowTogglePasswordError(false), 3000);
      return;
    }
    resetActionRateLimit('students_action');

    const studentToToggle = studentsFromContext.find(s => s.id === pendingToggleId);
    if (studentToToggle) {
      const { updateStudent } = await import("../services/firestoreService");
      await updateStudent(studentToToggle.regNo, { 
        status: studentToToggle.status === "active" ? "disabled" : "active" 
      });
    }
    setShowTogglePasswordModal(false);
    setPendingToggleId(null);
    setTogglePassword("");
    setShowTogglePasswordError(false);
  };

  const handleConfirmDelete = async () => {
    const rateLimit = checkActionRateLimit('students_action');
    if (!rateLimit.allowed) return;

    setIsDeleting(true);
    try {
      const { fetchActionPassword, deleteStudentCompletely } = await import("../services/firestoreService");
      const storedPasswordBtoa = await fetchActionPassword();
      const actualPassword = storedPasswordBtoa ? atob(storedPasswordBtoa) : "12345";

      if (deletePassword !== actualPassword) {
        recordFailedAction('students_action');
        setShowDeletePasswordError(true);
        setIsDeleting(false);
        setTimeout(() => setShowDeletePasswordError(false), 3000);
        return;
      }
      resetActionRateLimit('students_action');

      const studentToDelete = studentsFromContext.find(s => s.id === pendingDeleteId);
      if (studentToDelete) {
        await deleteStudentCompletely(studentToDelete.regNo);
        setShowSuccessMessage(true);
        setTimeout(() => setShowSuccessMessage(false), 3000);
      }
      
      setShowDeleteModal(false);
      setPendingDeleteId(null);
      setDeletePassword("");
      setShowDeletePasswordError(false);
    } catch (error) {
      console.error("Deletion failed:", error);
      alert("Failed to delete student. Check logs.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmAddStudent = async () => {
    const rateLimit = checkActionRateLimit('students_action');
    if (!rateLimit.allowed) return;

    if (!newName || !newRegNo || !newEmail) {
      alert("Name, Registration Number, and Email are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { addStudent } = await import("../services/firestoreService");
      resetActionRateLimit('students_action');

      const newStudent: Student = {
        id: Date.now(),
        name: newName,
        regNo: newRegNo,
        email: newEmail,
        phone: newPhone || "N/A",
        balance: parseInt(newCredits) || 0, // Maps manual "Credits" to balance
        credits: parseInt(newCredits) || 0,
        status: "active",
      };

      await addStudent(newStudent);

      setShowAddModal(false);
      setNewName("");
      setNewRegNo("");
      setNewEmail("");
      setNewPhone("");
      setNewCredits("0");
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
    } catch (error) {
      console.error("Failed to register student:", error);
      alert("Registration failed. Please check your internet connection or account permissions.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSyncAll = async () => {
    if (isSyncing) return;
    
    const count = studentsFromContext.length;
    if (!confirm(`Sync ${count} students to the registration system?`)) return;

    setIsSyncing(true);
    try {
      const { syncAllStudents } = await import("../services/firestoreService");
      await syncAllStudents(studentsFromContext);
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
    } catch (error) {
      console.error("Sync failed:", error);
      alert("Sync failed. Check connection.");
    } finally {
      setIsSyncing(false);
    }
  };

  const downloadStudentReport = () => {
    let csvContent = "MessFlow Student Management Report\n";
    csvContent += `Generated: ${new Date().toLocaleString()}\n`;
    csvContent += `Total Students: ${studentsFromContext.length}\n`;
    csvContent += `Active Students: ${studentsFromContext.filter(s => s.status === 'active').length}\n`;
    csvContent += `Total Balance: ₹${studentsFromContext.filter(s => s.status === 'active').reduce((sum, s) => sum + s.balance, 0)}\n\n`;
    
    csvContent += "Name,Email,Registration Number,Credits,Phone Number,Balance,Status\n";
    
    studentsFromContext.forEach(student => {
      csvContent += `"${student.name}",${student.email},${student.regNo},${student.phone},₹${student.balance},${student.status}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `MessFlow_Students_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Student Management</h1>
          <p className="text-muted-foreground">
            Manage student accounts and balances • {studentsFromContext.filter(s => s.status === 'active').length} active
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={refreshStudents}
            disabled={loading}
            className="bg-muted hover:bg-muted/80 text-foreground px-4 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
            title="Refresh Student List"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleSyncAll}
            disabled={isSyncing || studentsFromContext.length === 0}
            className="bg-accent hover:bg-accent/80 text-accent-foreground px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
            title="Sync all students to the registration database"
          >
            <Power className={`h-5 w-5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Emails'}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors shadow-sm"
          >
            <Users className="h-5 w-5" />
            Add Student
          </button>
          <button
            onClick={downloadStudentReport}
            className="bg-muted hover:bg-muted/80 text-foreground px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors"
          >
            <Download className="h-5 w-5" />
            Download Report
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="bg-muted hover:bg-muted/80 text-foreground px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors"
          >
            <Upload className="h-5 w-5" />
            Upload CSV
          </button>
          <button
            onClick={() => setShowBalanceModal(true)}
            className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition-colors flex items-center gap-2"
          >
            <span className="text-lg font-bold">₹</span>
            Assign Monthly Credits
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <SearchIcon className="h-5 w-5 text-muted-foreground" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search students by name, reg no, or email..."
          className="bg-card text-foreground pl-12 pr-4 py-4 rounded-xl w-full border border-border focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
        />
      </div>

      {/* Students Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {filteredStudents.length === 0 ? (
            <div className="p-12">
              <EmptyState 
                icon={Users}
                title="No students found"
                description={searchTerm ? "Try searching for something else." : "Import your student database via CSV to start managing accounts and balances."}
                action={!searchTerm ? {
                  label: "Upload Student CSV",
                  onClick: () => setShowUploadModal(true)
                } : undefined}
              />
            </div>
          ) : (
            <div className="min-w-[1000px]">
              {/* Sticky Header */}
              <table className="w-full table-fixed border-b border-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left py-4 px-6 text-foreground font-bold w-[25%]">Name</th>
                    <th className="text-left py-4 px-6 text-foreground font-bold w-[18%]">Reg No</th>
                    <th className="text-left py-4 px-6 text-foreground font-bold w-[22%]">Email</th>
                    <th className="text-left py-4 px-6 text-foreground font-bold w-[15%]">Phone</th>
                    <th className="text-left py-4 px-6 text-foreground font-bold w-[10%]">Credits</th>
                    <th className="text-left py-4 px-6 text-foreground font-bold w-[10%]">Status</th>
                    <th className="text-right py-4 px-6 text-foreground font-bold w-[10%]">Actions</th>
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
                    const student = filteredStudents[virtualRow.index];
                    return (
                      <div
                        key={student.id}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                        className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors flex items-center"
                      >
                        <table className="w-full table-fixed">
                          <tbody>
                            <tr>
                              <td className="py-4 px-6 font-semibold text-foreground w-[25%]">
                                <div className="flex flex-col">
                                  <span className="font-bold truncate">{student.name}</span>
                                  {student.uid ? (
                                    <span className="text-[9px] bg-green-500/10 text-green-600 px-2 py-0.5 rounded w-fit border border-green-500/20 font-black mt-1 uppercase tracking-widest text-center">
                                      Linked
                                    </span>
                                  ) : (
                                    <span className="text-[9px] bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded w-fit border border-amber-500/20 font-black mt-1 uppercase tracking-widest text-center">
                                      Pending
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 px-6 text-foreground w-[18%] truncate">{student.regNo}</td>
                              <td className="py-4 px-6 text-foreground text-sm w-[22%] truncate">{student.email}</td>
                              <td className="py-4 px-6 text-foreground text-sm w-[15%] truncate">{student.phone}</td>
                              <td className="py-4 px-6 w-[10%]">
                                <span className="font-bold text-lg text-foreground truncate">₹{student.balance}</span>
                              </td>
                              <td className="py-4 px-6 w-[10%]">
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                    student.status === "active"
                                      ? "bg-accent text-accent-foreground"
                                      : "bg-destructive text-destructive-foreground"
                                  }`}
                                >
                                  {student.status.toUpperCase()}
                                </span>
                              </td>
                              <td className="py-4 px-6 w-[10%]">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleEditBalance(student.id, student.balance)}
                                    className="p-2 rounded-lg bg-primary hover:bg-primary/80 text-primary-foreground transition-colors shrink-0"
                                    title="Edit Credits"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleToggleStatus(student.id)}
                                    className={`p-2 rounded-lg transition-colors shrink-0 ${
                                      student.status === "active"
                                        ? "bg-destructive hover:bg-destructive/80 text-destructive-foreground"
                                        : "bg-accent hover:bg-accent/80 text-accent-foreground"
                                    }`}
                                    title={student.status === "active" ? "Disable" : "Enable"}
                                  >
                                    <Power className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteClick(student.id)}
                                    className="p-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors shrink-0"
                                    title="Delete Account"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CSV Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-border shadow-2xl flex flex-col">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Upload Student CSV</h2>
                <p className="text-sm text-muted-foreground">Import student data from a CSV file</p>
              </div>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setParseResult(null);
                }}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-6 w-6 text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {!parseResult ? (
                /* Upload Zone */
                <div
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
                    isDragOver ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
                  }`}
                >
                  <div className="flex justify-center mb-6">
                    <div className="p-6 rounded-full bg-primary/10">
                      <Upload className="h-10 w-10 text-primary" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">
                    Drag and drop your CSV file here
                  </h3>
                  <p className="text-muted-foreground mb-8">
                    Or click to browse from your computer
                  </p>
                  
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".csv"
                    className="hidden"
                  />
                  
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-primary hover:bg-secondary text-primary-foreground px-8 py-3 rounded-xl font-semibold transition-colors shadow-md"
                    >
                      Browse Files
                    </button>
                    <button
                      onClick={downloadStudentTemplate}
                      className="flex items-center gap-2 text-primary hover:text-secondary font-semibold transition-colors"
                    >
                      <Download className="h-5 w-5" />
                      Download Template
                    </button>
                  </div>

                  <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                    <div className="bg-muted p-3 rounded-lg border border-border">
                      <p className="text-muted-foreground mb-1">Column 1</p>
                      <p className="font-bold text-foreground">Name</p>
                    </div>
                    <div className="bg-muted p-3 rounded-lg border border-border">
                      <p className="text-muted-foreground mb-1">Column 2</p>
                      <p className="font-bold text-foreground">Reg No</p>
                    </div>
                    <div className="bg-muted p-3 rounded-lg border border-border">
                      <p className="text-muted-foreground mb-1">Column 3</p>
                      <p className="font-bold text-foreground">Credits</p>
                    </div>
                    <div className="bg-muted p-3 rounded-lg border border-border">
                      <p className="text-muted-foreground mb-1">Column 4</p>
                      <p className="font-bold text-foreground">Email</p>
                    </div>
                    <div className="bg-muted p-3 rounded-lg border border-border">
                      <p className="text-muted-foreground mb-1">Column 5</p>
                      <p className="font-bold text-foreground">Phone</p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Preview Zone */
                <div className="space-y-6">
                  {/* Summary Bar */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-muted rounded-xl border border-border">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-green-500"></div>
                        <span className="font-semibold">{parseResult.valid.length} valid students</span>
                      </div>
                      {parseResult.errors.length > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full bg-red-500"></div>
                          <span className="font-semibold text-red-500">{parseResult.errors.length} errors found</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setParseResult(null)}
                      className="text-primary hover:text-secondary font-semibold text-sm flex items-center gap-1"
                    >
                      < Trash2 className="h-4 w-4" />
                      Clear and re-upload
                    </button>
                  </div>

                  {/* Errors List */}
                  {parseResult.errors.length > 0 && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-destructive font-bold mb-3">
                        <AlertCircle className="h-5 w-5" />
                        Row Validation Errors
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-2 text-sm">
                        {parseResult.errors.map((error, idx) => (
                          <div key={idx} className="flex gap-2">
                            <span className="text-destructive font-bold whitespace-nowrap">Row {error.row}:</span>
                            <span className="text-muted-foreground">{error.field} — {error.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Valid Data Preview */}
                  <div>
                    <h3 className="font-bold text-foreground mb-3 px-1">Data Preview (Valid Rows)</h3>
                    <div className="border border-border rounded-xl overflow-hidden bg-background">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="text-left p-3 font-bold">Name</th>
                            <th className="text-left p-3 font-bold">Reg No</th>
                            <th className="text-left p-3 font-bold">Email</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parseResult.valid.slice(0, 10).map((s, idx) => (
                            <tr key={idx} className="border-t border-border">
                              <td className="p-3">{s.name}</td>
                              <td className="p-3">{s.regNo}</td>
                              <td className="p-3">{s.email}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {parseResult.valid.length > 10 && (
                        <div className="p-3 text-center text-xs text-muted-foreground bg-muted/30 border-t border-border">
                          And {parseResult.valid.length - 10} more students...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-6 border-t border-border bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                Mode: Replace All Existing Data
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setParseResult(null);
                  }}
                  className="bg-muted hover:bg-muted/80 text-foreground px-6 py-3 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmUpload}
                  disabled={!parseResult || parseResult.valid.length === 0}
                  className="bg-primary hover:bg-secondary text-primary-foreground px-8 py-3 rounded-xl font-semibold transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Import {parseResult?.valid.length || 0} Students
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Credits Modal */}
      {showBalanceModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl p-8 w-full max-w-md border border-border shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">Assign Monthly Credits</h2>
              <button
                onClick={handleCancelModal}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            
            <div className="mb-6">
              <p className="text-muted-foreground mb-4">
                Add credits to all <span className="font-bold text-foreground">{studentsFromContext.filter(s => s.status === "active").length}</span> active students
              </p>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Amount (₹)
              </label>
              <input
                type="number"
                value={monthlyAmount}
                onChange={(e) => setMonthlyAmount(e.target.value)}
                placeholder="Enter amount"
                autoFocus
                className="bg-input-background text-foreground px-4 py-3 rounded-lg w-full border border-border focus:outline-none focus:ring-2 focus:ring-primary text-lg"
              />
              {monthlyAmount && parseInt(monthlyAmount) > 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Total amount: ₹{parseInt(monthlyAmount) * studentsFromContext.filter(s => s.status === "active").length}
                </p>
              )}
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-semibold text-foreground mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="bg-input-background text-foreground px-4 py-3 rounded-lg w-full border border-border focus:outline-none focus:ring-2 focus:ring-primary text-lg"
              />
              {showPasswordError && (
                <p className="text-sm text-red-500 mt-2">
                  Incorrect password
                </p>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleCancelModal}
                className="flex-1 bg-muted hover:bg-muted/80 text-foreground px-6 py-3 rounded-xl font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAssignBalance}
                disabled={!monthlyAmount || parseInt(monthlyAmount) <= 0}
                className="flex-1 bg-primary hover:bg-secondary text-primary-foreground px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <DollarSign className="h-5 w-5" />
                {lockoutSeconds > 0 ? `Locked (${lockoutSeconds}s)` : "Assign Credits"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Credits Password Modal */}
      {showEditPasswordModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl p-8 w-full max-w-md border border-border shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">Edit Credits</h2>
              <button
                onClick={() => {
                  setShowEditPasswordModal(false);
                  setPendingEditId(null);
                  setPendingEditBalance("");
                  setEditPassword("");
                  setShowEditPasswordError(false);
                }}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            
            <div className="mb-6">
              <p className="text-muted-foreground mb-4">
                Editing credits for student with Reg No: <span className="font-bold text-foreground">{pendingEditId ? studentsFromContext.find(s => s.id === pendingEditId)?.regNo : ''}</span>
              </p>
              <label className="block text-sm font-semibold text-foreground mb-2">
                New Credits (₹)
              </label>
              <input
                type="number"
                value={pendingEditBalance}
                onChange={(e) => setPendingEditBalance(e.target.value)}
                placeholder="Enter new credits"
                autoFocus
                className="bg-input-background text-foreground px-4 py-3 rounded-lg w-full border border-border focus:outline-none focus:ring-2 focus:ring-primary text-lg mb-4"
              />
              <label className="block text-sm font-semibold text-foreground mb-2">
                Password
              </label>
              <input
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Enter password"
                className="bg-input-background text-foreground px-4 py-3 rounded-lg w-full border border-border focus:outline-none focus:ring-2 focus:ring-primary text-lg"
              />
              {showEditPasswordError && (
                <p className="text-sm text-red-500 mt-2">
                  Incorrect password
                </p>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowEditPasswordModal(false);
                  setPendingEditId(null);
                  setPendingEditBalance("");
                  setEditPassword("");
                  setShowEditPasswordError(false);
                }}
                className="flex-1 bg-muted hover:bg-muted/80 text-foreground px-6 py-3 rounded-xl font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEditBalance}
                disabled={!editPassword || !pendingEditBalance}
                className="flex-1 bg-primary hover:bg-secondary text-primary-foreground px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Edit className="h-5 w-5" />
                {lockoutSeconds > 0 ? `Locked (${lockoutSeconds}s)` : "Edit Credits"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Status Password Modal */}
      {showTogglePasswordModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl p-8 w-full max-w-md border border-border shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">Toggle Status</h2>
              <button
                onClick={() => setShowTogglePasswordModal(false)}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            
            <div className="mb-6">
              <p className="text-muted-foreground mb-4">
                Enter password to toggle status for student with Reg No: <span className="font-bold text-foreground">{pendingToggleId ? studentsFromContext.find(s => s.id === pendingToggleId)?.regNo : ''}</span>
              </p>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Password
              </label>
              <input
                type="password"
                value={togglePassword}
                onChange={(e) => setTogglePassword(e.target.value)}
                placeholder="Enter password"
                className="bg-input-background text-foreground px-4 py-3 rounded-lg w-full border border-border focus:outline-none focus:ring-2 focus:ring-primary text-lg"
              />
              {showTogglePasswordError && (
                <p className="text-sm text-red-500 mt-2">
                  Incorrect password
                </p>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowTogglePasswordModal(false)}
                className="flex-1 bg-muted hover:bg-muted/80 text-foreground px-6 py-3 rounded-xl font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmToggleStatus}
                disabled={!togglePassword}
                className="flex-1 bg-primary hover:bg-secondary text-primary-foreground px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Power className="h-5 w-5" />
                {lockoutSeconds > 0 ? `Locked (${lockoutSeconds}s)` : "Toggle Status"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl p-8 w-full max-w-lg border border-border shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Users className="h-6 w-6 text-primary" />
                Add New Student
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-4 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Full Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="bg-input-background text-foreground px-4 py-2.5 rounded-lg w-full border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Reg No / Roll No</label>
                  <input
                    type="text"
                    value={newRegNo}
                    onChange={(e) => setNewRegNo(e.target.value)}
                    placeholder="e.g. 21BCE1234"
                    className="bg-input-background text-foreground px-4 py-2.5 rounded-lg w-full border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Email Address</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="e.g. john@university.edu"
                    className="bg-input-background text-foreground px-4 py-2.5 rounded-lg w-full border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Phone Number</label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="bg-input-background text-foreground px-4 py-2.5 rounded-lg w-full border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Initial Credits</label>
                <input
                  type="number"
                  value={newCredits}
                  onChange={(e) => setNewCredits(e.target.value)}
                  className="bg-input-background text-foreground px-4 py-2.5 rounded-lg w-full border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 bg-muted hover:bg-muted/80 text-foreground px-6 py-3 rounded-xl font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAddStudent}
                disabled={!newName || !newRegNo || !newEmail || isSubmitting}
                className="flex-1 bg-primary hover:bg-secondary text-primary-foreground px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                {isSubmitting ? (
                  <div className="h-5 w-5 border-2 border-primary-foreground border-t-transparent animate-spin rounded-full" />
                ) : (
                  <>
                    {lockoutSeconds > 0 ? `Locked (${lockoutSeconds}s)` : "Register Student"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-card rounded-2xl p-8 w-full max-w-md border-2 border-destructive/20 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-destructive"></div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3 text-destructive">
                <Trash2 className="h-6 w-6" />
                <h2 className="text-2xl font-bold">Delete Existence</h2>
              </div>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setPendingDeleteId(null);
                  setDeletePassword("");
                }}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            
            <div className="mb-6 space-y-4">
              <div className="bg-destructive/10 p-4 rounded-xl border border-destructive/20">
                <p className="text-destructive font-bold text-sm mb-1 uppercase tracking-wider flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Critical Warning
                </p>
                <p className="text-sm text-foreground/80 leading-relaxed">
                  You are about to delete <span className="font-black text-destructive underline">{pendingDeleteId ? studentsFromContext.find(s => s.id === pendingDeleteId)?.name : 'this student'}</span>'s 
                  entire existence from Messfloww.
                </p>
                <ul className="text-[11px] text-destructive/80 mt-2 list-disc list-inside font-semibold">
                  <li>Remove Wallet & Personal Details</li>
                  <li>Wipe all Order History</li>
                  <li>Erase all Ledger Transactions</li>
                  <li>Unlink Email & APP Access</li>
                </ul>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-foreground">
                  Manager Password
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter manager password"
                  autoFocus
                  className="bg-input-background text-foreground px-4 py-3 rounded-lg w-full border border-border focus:outline-none focus:ring-2 focus:ring-destructive text-lg"
                />
                {showDeletePasswordError && (
                  <p className="text-xs font-bold text-destructive animate-pulse">
                    Invalid manager password. Attempt recorded.
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setPendingDeleteId(null);
                  setDeletePassword("");
                }}
                className="flex-1 bg-muted hover:bg-muted/80 text-foreground px-6 py-3 rounded-xl font-semibold transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={!deletePassword || isDeleting || lockoutSeconds > 0}
                className="flex-1 bg-destructive hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-destructive/20"
              >
                {isDeleting ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent animate-spin rounded-full" />
                ) : (
                  <>
                    <Trash2 className="h-5 w-5" />
                    {lockoutSeconds > 0 ? `Locked (${lockoutSeconds}s)` : "Wipe Data"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {showSuccessMessage && (
        <div className="fixed bottom-6 right-6 bg-accent text-accent-foreground px-6 py-4 rounded-xl shadow-lg border-2 border-accent flex items-center gap-3 animate-slide-up z-50">
          <div className="p-2 bg-accent-foreground/20 rounded-full">
            <Check className="h-5 w-5" />
          </div>
          <span className="font-semibold">Action completed successfully!</span>
        </div>
      )}
    </div>
  );
}