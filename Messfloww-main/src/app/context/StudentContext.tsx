import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { fetchAllStudents, batchReplaceStudents } from "../services/firestoreService";

export interface Student {
  id: number;
  name: string;
  email: string;
  regNo: string;
  phone: string;
  balance: number; // Actual current wallet balance
  credits: number; // Same as balance, used interchangeably in UI
  status: "active" | "disabled";
  uid?: string;
}

interface StudentContextType {
  students: Student[];
  setStudents: (students: Student[]) => Promise<void>;
  refreshStudents: () => Promise<void>;
  activeStudentsCount: number;
  totalStudentsCount: number;
  loading: boolean;
}

const StudentContext = createContext<StudentContextType | undefined>(undefined);

export function StudentProvider({ children }: { children: ReactNode }) {
  const [students, setStudentsState] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuth();

  const fetchStudentsData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const data = await fetchAllStudents();
      setStudentsState(data);
    } catch (error) {
      console.error("Failed to fetch students:", error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchStudentsData();
  }, [fetchStudentsData]);

  const setStudents = async (newStudents: Student[]) => {
    await batchReplaceStudents(newStudents);
    await fetchStudentsData(); // Refresh after bulk update
  };
  
  const refreshStudents = async () => {
    await fetchStudentsData();
  };
  
  // Calculate active students
  const activeStudentsCount = students.filter(
    (student) => student.status === "active"
  ).length;
  
  const totalStudentsCount = students.length;

  return (
    <StudentContext.Provider value={{ 
      students, 
      setStudents, 
      refreshStudents,
      activeStudentsCount, 
      totalStudentsCount, 
      loading 
    }}>
      {children}
    </StudentContext.Provider>
  );
}

export function useStudents() {
  const context = useContext(StudentContext);
  if (!context) {
    throw new Error("useStudents must be used within StudentProvider");
  }
  return context;
}
