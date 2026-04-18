import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "../../core/firebase";

export interface ReportSubscription {
  id: string;
  userId: string;
  reportTypes: string[];      // ['daily_revenue', 'low_stock_alert', ...]
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  customDays?: number;        // For custom frequency
  sendTime: string;           // '22:00' (24hr format)
  channel: 'email' | 'whatsapp';
  recipients: string[];       // Email addresses
  enabled: boolean;
  lastSent?: string;          // ISO timestamp
  createdAt?: string;
  updatedAt?: string;
}

const SUBS_COLLECTION = "report_subscriptions";

export const createSubscription = async (sub: Omit<ReportSubscription, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const newRef = doc(collection(db, SUBS_COLLECTION));
  const newSub: ReportSubscription = {
    ...sub,
    id: newRef.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  await setDoc(newRef, newSub);
  return newRef.id;
};

export const updateSubscription = async (id: string, data: Partial<ReportSubscription>) => {
  const docRef = doc(db, SUBS_COLLECTION, id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: new Date().toISOString()
  });
};

export const deleteSubscription = async (id: string) => {
  const docRef = doc(db, SUBS_COLLECTION, id);
  await deleteDoc(docRef);
};

export const getSubscriptions = async (userId: string): Promise<ReportSubscription[]> => {
  const q = query(collection(db, SUBS_COLLECTION), where("userId", "==", userId));
  const snapshot = await getDocs(q);
  const subs: ReportSubscription[] = [];
  snapshot.forEach(doc => subs.push(doc.data() as ReportSubscription));
  return subs;
};

export const toggleSubscription = async (id: string, enabled: boolean) => {
  await updateSubscription(id, { enabled });
};
