import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";

export interface MealSlot {
  name: string;
  time: string;
}

export const subscribeToActiveSlot = (callback: (slot: MealSlot | null) => void) => {
  const slotRef = doc(db, "timeSlots", "current");
  return onSnapshot(slotRef, (docSnap) => {
    if (docSnap.exists() && docSnap.data().active) {
      const slotData = docSnap.data().slot;
      callback({
        name: slotData.name,
        time: `${slotData.startTime} - ${slotData.endTime}`
      });
    } else {
      callback(null);
    }
  });
};

export async function getCurrentSlot(): Promise<MealSlot | null> {
  const slotRef = doc(db, "timeSlots", "current");
  const docSnap = await getDoc(slotRef);
  if (docSnap.exists() && docSnap.data().active) {
    const slotData = docSnap.data().slot;
    return {
      name: slotData.name,
      time: `${slotData.startTime} - ${slotData.endTime}`
    };
  }
  return null;
}

export async function getAllSlotsConfig(): Promise<any[]> {
  const configRef = doc(db, "timeSlots", "config");
  const snap = await getDoc(configRef);
  if (snap.exists()) {
    return snap.data().slots || [];
  }
  return [];
}