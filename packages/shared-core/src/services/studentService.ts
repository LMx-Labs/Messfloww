import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch, query, where, runTransaction } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { Student } from "../types";

// --- Students ---
const STUDENTS_COLLECTION = "students";
const REGISTERED_STUDENTS_COLLECTION = "registered_students";
const LEDGER_COLLECTION = "ledger";

const syncToRegisteredStudents = async (student: Student) => {
  if (!student.email) return;
  const emailDocId = student.email.toLowerCase().trim();
  const docRef = doc(db, REGISTERED_STUDENTS_COLLECTION, emailDocId);
  await setDoc(docRef, {
    email: emailDocId,
    regNo: student.regNo,
    name: student.name,
    status: student.status
  }, { merge: true });
};

export const syncAllStudents = async (students: Student[]) => {
  const batch = writeBatch(db);
  students.forEach((student) => {
    if (student.email) {
      const emailDocId = student.email.toLowerCase().trim();
      const regDocRef = doc(db, REGISTERED_STUDENTS_COLLECTION, emailDocId);
      batch.set(regDocRef, {
        email: emailDocId,
        regNo: student.regNo,
        name: student.name,
        status: student.status
      }, { merge: true });
    }
  });
  await batch.commit();
};

const removeFromRegisteredStudents = async (email: string) => {
  if (!email) return;
  const emailDocId = email.toLowerCase().trim();
  const docRef = doc(db, REGISTERED_STUDENTS_COLLECTION, emailDocId);
  await deleteDoc(docRef);
};

export const fetchAllStudents = async (): Promise<Student[]> => {
  const snapshot = await getDocs(collection(db, STUDENTS_COLLECTION));
  const students: Student[] = [];
  snapshot.forEach((doc) => {
    students.push({ id: doc.data().id, ...doc.data() } as Student);
  });
  return students;
};

export const subscribeStudents = (callback: (students: Student[]) => void) => {
  return onSnapshot(collection(db, STUDENTS_COLLECTION), (snapshot) => {
    const students: Student[] = [];
    snapshot.forEach((doc) => {
      students.push({ id: doc.data().id, ...doc.data() } as Student);
    });
    callback(students);
  }, (error) => {
    console.error("Error subscribing to students: ", error);
  });
};

export const batchReplaceStudents = async (students: Student[]) => {
  const batch = writeBatch(db);

  for (const student of students) {
    const docRef = doc(db, STUDENTS_COLLECTION, student.regNo);
    // Use set with merge: true to preserve any fields not present in the CSV (like 'uid')
    batch.set(docRef, student, { merge: true });

    if (student.email) {
      const emailDocId = student.email.toLowerCase().trim();
      const regDocRef = doc(db, REGISTERED_STUDENTS_COLLECTION, emailDocId);
      batch.set(regDocRef, {
        email: emailDocId,
        regNo: student.regNo,
        name: student.name,
        status: student.status
      }, { merge: true });
    }
  }

  await batch.commit();
};

export const addStudent = async (student: Student) => {
  const docRef = doc(db, STUDENTS_COLLECTION, student.regNo);
  await setDoc(docRef, student);
  await syncToRegisteredStudents(student);
};

export const updateStudent = async (regNo: string, data: Partial<Student>) => {
  const docRef = doc(db, STUDENTS_COLLECTION, regNo);
  await updateDoc(docRef, data);

  // If email or status changed, sync again
  if (data.email || data.status || data.name) {
    const studentDoc = await getDoc(docRef);
    if (studentDoc.exists()) {
      await syncToRegisteredStudents(studentDoc.data() as Student);
    }
  }
};

export const deleteStudent = async (regNo: string) => {
  const docRef = doc(db, STUDENTS_COLLECTION, regNo);
  const studentDoc = await getDoc(docRef);
  if (studentDoc.exists()) {
    const studentData = studentDoc.data() as Student;
    if (studentData.email) {
      await removeFromRegisteredStudents(studentData.email);
    }
  }
  await deleteDoc(docRef);
};

export const deleteStudentCompletely = async (regNo: string) => {
  const docRef = doc(db, STUDENTS_COLLECTION, regNo);
  const studentDoc = await getDoc(docRef);
  if (!studentDoc.exists()) return;

  const studentData = studentDoc.data() as Student;
  const { uid, email } = studentData;

  const batch = writeBatch(db);
  batch.delete(docRef);

  if (email) {
    const emailDocId = email.toLowerCase().trim();
    batch.delete(doc(db, REGISTERED_STUDENTS_COLLECTION, emailDocId));
  }

  if (uid) {
    batch.delete(doc(db, "users", uid));
  }
  await batch.commit();

  const ledgerQ = query(collection(db, LEDGER_COLLECTION), where("studentRegNo", "==", regNo));
  const ledgerSnaps = await getDocs(ledgerQ);
  if (!ledgerSnaps.empty) {
    const ledgerBatch = writeBatch(db);
    ledgerSnaps.forEach((d) => ledgerBatch.delete(d.ref));
    await ledgerBatch.commit();
  }

  const ordersQ = query(collection(db, "historical_orders"), where("userRollNo", "==", regNo));
  const orderSnaps = await getDocs(ordersQ);
  if (!orderSnaps.empty) {
    const orderBatch = writeBatch(db);
    orderSnaps.forEach((d) => orderBatch.delete(d.ref));
    await orderBatch.commit();
  }
};

export const getStudentByRegNo = async (regNo: string): Promise<Student | null> => {
  const docRef = doc(db, STUDENTS_COLLECTION, regNo);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return snap.data() as Student;
};

export const deductStudentBalance = async (
  regNo: string,
  amount: number
): Promise<{ success: boolean; newBalance: number }> => {
  const studentRef = doc(db, STUDENTS_COLLECTION, regNo);
  let newBalance = 0;

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(studentRef);
    if (!snap.exists()) throw new Error("Student not found");

    const student = snap.data();
    const currentBalance = student.balance || 0;
    if (currentBalance < amount) throw new Error("Insufficient balance");

    newBalance = currentBalance - amount;

    // Update student balance atomically — both fields in one write
    transaction.update(studentRef, { balance: newBalance, credits: newBalance });

    // NOTE: walletBalance sync on users/{uid} removed — saves Firestore writes.
    // AuthContext re-fetches balance from students collection on session start.
  });

  return { success: true, newBalance };
};

export const fetchActionPassword = async (): Promise<string> => {
  const settingsRef = doc(db, "settings", "security");
  const snap = await getDoc(settingsRef);
  if (snap.exists()) {
    return atob(snap.data().actionPassword || "");
  }
  return "12345"; // Default if not found
};

export const studentService = {
  syncAllStudents,
  fetchAllStudents,
  subscribeStudents,
  batchReplaceStudents,
  addStudent,
  updateStudent,
  deleteStudent,
  deleteStudentCompletely,
  getStudentByRegNo,
  deductStudentBalance,
  fetchActionPassword
};
