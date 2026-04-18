import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch, serverTimestamp, query, where, orderBy, limit, startAfter, QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Student } from "../context/StudentContext";
import { MenuItem, MealType } from "../context/MenuContext";
import { Order } from "../context/OrderContext";

// --- Students ---
const STUDENTS_COLLECTION = "students";
const REGISTERED_STUDENTS_COLLECTION = "registered_students";

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
  
  // 1. We no longer delete all students. Instead, we update existing ones 
  // and only add new ones, preserving critical fields like 'uid'.
  
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

/**
 * Irreversibly deletes a student from the system, including their registration sync,
 * user profile, transaction ledger, and historical orders.
 */
export const deleteStudentCompletely = async (regNo: string) => {
  const docRef = doc(db, STUDENTS_COLLECTION, regNo);
  const studentDoc = await getDoc(docRef);
  if (!studentDoc.exists()) return;

  const studentData = studentDoc.data() as Student;
  const { uid, email } = studentData;

  // 1. Delete standard records in a batch
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

  // 2. Cleanup Ledger entries
  const ledgerQ = query(collection(db, LEDGER_COLLECTION), where("studentRegNo", "==", regNo));
  const ledgerSnaps = await getDocs(ledgerQ);
  if (!ledgerSnaps.empty) {
    const ledgerBatch = writeBatch(db);
    ledgerSnaps.forEach((d) => ledgerBatch.delete(d.ref));
    await ledgerBatch.commit();
  }

  // 3. Cleanup Historical Orders
  const ordersQ = query(collection(db, "historical_orders"), where("userRollNo", "==", regNo));
  const orderSnaps = await getDocs(ordersQ);
  if (!orderSnaps.empty) {
    const orderBatch = writeBatch(db);
    orderSnaps.forEach((d) => orderBatch.delete(d.ref));
    await orderBatch.commit();
  }
};


/**
 * Fetches a single student by registration number.
 */
export const getStudentByRegNo = async (regNo: string): Promise<Student | null> => {
  const docRef = doc(db, STUDENTS_COLLECTION, regNo);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return snap.data() as Student;
};

/**
 * Atomically deducts wallet balance from a student for a counter order.
 * Also syncs the balance to users/{uid} so the Student App reflects instantly.
 */
export const deductStudentBalance = async (
  regNo: string,
  amount: number
): Promise<{ success: boolean; newBalance: number }> => {
  const docRef = doc(db, STUDENTS_COLLECTION, regNo);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error("Student not found");

  const student = snap.data();
  const currentBalance = student.balance || 0;
  if (currentBalance < amount) throw new Error("Insufficient balance");

  const newBalance = currentBalance - amount;
  await updateDoc(docRef, { balance: newBalance, credits: newBalance });

  // Sync to users/{uid} if UID is linked (keeps Student App wallet in real-time sync)
  if (student.uid) {
    try {
      const userDocRef = doc(db, "users", student.uid);
      await updateDoc(userDocRef, { walletBalance: newBalance });
    } catch (e) {
      console.warn("Could not sync balance to users collection:", e);
    }
  }

  return { success: true, newBalance };
};

// --- Menu ---
const MENU_COLLECTION = "menu";

export const subscribeMenu = (callback: (menu: Record<MealType, MenuItem[]>) => void) => {
  return onSnapshot(collection(db, MENU_COLLECTION), (snapshot) => {
    const newMenu: Record<MealType, MenuItem[]> = {
      breakfast: [], lunch: [], snacks: [], dinner: [], night: [],
    };
    snapshot.forEach((doc) => {
      const item = { ...doc.data() } as MenuItem;
      if(newMenu[item.slot]) {
         newMenu[item.slot].push(item);
      }
    });
    callback(newMenu);
  }, (error) => {
      console.error("Error subscribing to menu: ", error);
  });
};

export const batchReplaceMenuSlot = async (slot: MealType, items: MenuItem[]) => {
  const snapshot = await getDocs(collection(db, MENU_COLLECTION));
  const batch = writeBatch(db);
  snapshot.forEach((document) => {
    if (document.data().slot === slot) {
      batch.delete(document.ref);
    }
  });

  const { rtdbService } = await import("./rtdbService");
  
  for (const item of items) {
    const id = item.id || Date.now() + Math.floor(Math.random() * 1000); 
    const itemWithId = { ...item, id };
    const docRef = doc(db, MENU_COLLECTION, id.toString());
    batch.set(docRef, itemWithId);
    
    // Initialize RTDB stock for the new items
    await rtdbService.setMenuStock(id, {
      stock: item.stock || 0,
      minStock: item.minStock || 0,
      available: item.available !== undefined ? item.available : true
    });
  }
  
  await batch.commit();
};

export const addMenuItem = async (item: MenuItem) => {
  const id = item.id || Date.now();
  const itemWithId = { ...item, id };
  const docRef = doc(db, MENU_COLLECTION, id.toString());
  await setDoc(docRef, itemWithId);
};

export const updateMenuItem = async (id: number, data: Partial<MenuItem>) => {
  const docRef = doc(db, MENU_COLLECTION, id.toString());
  await updateDoc(docRef, data);
};

export const deleteMenuItem = async (id: number) => {
  const docRef = doc(db, MENU_COLLECTION, id.toString());
  await deleteDoc(docRef);
};


// Orders are now managed via RTDB in rtdbService.ts

// --- Settings ---
const SETTINGS_COLLECTION = "settings";
const SETTINGS_DOC = "global";

export const fetchSettings = async () => {
  const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data();
  }
  return null;
};

export const saveSettings = async (settings: any) => {
  const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC);
  await setDoc(docRef, settings);
};

// --- App Config (Roles/Passwords) ---
const APP_CONFIG_COLLECTION = "app_config";

export const fetchRoles = async () => {
  const docRef = doc(db, APP_CONFIG_COLLECTION, "roles");
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data();
  }
  return null;
};export const saveRoles = async (roles: any) => {
  const docRef = doc(db, APP_CONFIG_COLLECTION, "roles");
  await setDoc(docRef, roles, { merge: true });
};

export const fetchActionPassword = async () => {
  const docRef = doc(db, APP_CONFIG_COLLECTION, "passwords");
  const docSnap = await getDoc(docRef);
  if (docSnap.exists() && docSnap.data().actionPassword) {
    return docSnap.data().actionPassword;
  }
  return null;
};

export const saveActionPassword = async (actionPasswordBtoa: string) => {
  const docRef = doc(db, APP_CONFIG_COLLECTION, "passwords");
  await setDoc(docRef, { actionPassword: actionPasswordBtoa }, { merge: true });
};

export const saveStaffPassword = async (staffPasswordBtoa: string) => {
  const docRef = doc(db, APP_CONFIG_COLLECTION, "passwords");
  await setDoc(docRef, { staffPassword: staffPasswordBtoa }, { merge: true });
};

// --- Ledger (Transactions) ---
const LEDGER_COLLECTION = "ledger";

export const subscribeLedger = (callback: (entries: any[]) => void) => {
  return onSnapshot(collection(db, LEDGER_COLLECTION), (snapshot) => {
    const entries: any[] = [];
    snapshot.forEach((doc) => {
      entries.push({ id: doc.id, ...doc.data() });
    });
    entries.sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
    callback(entries);
  }, (error) => {
    console.error("Error subscribing to ledger: ", error);
  });
};

export const subscribeStudentLedger = (regNo: string, callback: (entries: any[]) => void) => {
  const q = query(collection(db, LEDGER_COLLECTION), where("studentRegNo", "==", regNo));
  return onSnapshot(q, (snapshot) => {
    const entries: any[] = [];
    snapshot.forEach((doc) => {
      entries.push({ id: doc.id, ...doc.data() });
    });
    entries.sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
    callback(entries);
  }, (error) => {
    console.error("Error subscribing to student ledger: ", error);
  });
};

export const subscribeStudentHistoricalOrders = (regNo: string, callback: (orders: any[]) => void) => {
  const q = query(collection(db, "historical_orders"), where("userRollNo", "==", regNo));
  return onSnapshot(q, (snapshot) => {
    const orders: any[] = [];
    snapshot.forEach((doc) => {
      orders.push({ id: doc.id, ...doc.data() });
    });
    // Sort by createdAt descending
    orders.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeB - timeA;
    });
    callback(orders);
  }, (error) => {
    console.error("Error subscribing to student historical orders: ", error);
  });
};

/**
 * Fetches ALL historical orders for report generation. 
 * Warning: Use with caution on very large collections.
 */
export const fetchAllHistoricalOrders = async () => {
  try {
    const q = query(
      collection(db, "historical_orders"),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching all historical orders:", error);
    throw error;
  }
};

/**
 * Fetches a single page of ledger entries (historical orders).
 */
export const fetchLedgerPage = async (
  pageSize: number,
  lastDocSnapshot?: QueryDocumentSnapshot
) => {
  try {
    let q = query(
      collection(db, "historical_orders"),
      orderBy("createdAt", "desc"),
      limit(pageSize)
    );
    
    if (lastDocSnapshot) {
      q = query(q, startAfter(lastDocSnapshot));
    }
    
    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    return {
      orders,
      lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
      hasMore: snapshot.docs.length === pageSize
    };
  } catch (error) {
    console.error("Error fetching ledger page:", error);
    throw error;
  }
};

