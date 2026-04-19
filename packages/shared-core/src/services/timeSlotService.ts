import { doc, onSnapshot, DocumentSnapshot, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { messStatusService } from "../rtdb/messStatusService";
import { TimeSlot } from "../types";

export const timeSlotService = {
  subscribeToTimeSlots(callback: (slots: TimeSlot[]) => void) {
    const configRef = doc(db, "timeSlots", "config");
    return onSnapshot(configRef, (docSnap: DocumentSnapshot) => {
      if (docSnap.exists() && docSnap.data()!.slots) {
        callback(docSnap.data()!.slots as TimeSlot[]);
      } else {
        callback([]);
      }
    });
  },

  subscribeToActiveSlot(callback: (slot: TimeSlot | null) => void) {
    const slotRef = doc(db, "timeSlots", "current");
    return onSnapshot(slotRef, (docSnap: DocumentSnapshot) => {
      if (docSnap.exists() && docSnap.data()!.active) {
        callback(docSnap.data()!.slot as TimeSlot);
      } else {
        callback(null);
      }
    });
  },

  async activateSlot(slot: TimeSlot) {
    const slotRef = doc(db, "timeSlots", "current");
    await setDoc(slotRef, { 
      active: true, 
      slot, 
      updatedAt: new Date().toISOString() 
    });

    await messStatusService.setMessStatus({ isOpen: true, currentlyServing: 0 });
  },

  async deactivateSlot() {
    const slotRef = doc(db, "timeSlots", "current");
    const snap = await getDoc(slotRef);
    let slotName = "UNKNOWN";
    if (snap.exists() && snap.data().active && snap.data().slot) {
      slotName = snap.data().slot.name;
    }

    await setDoc(slotRef, { active: false, slot: null });
    await messStatusService.setMessStatus({ isOpen: false });

    return slotName;
  },

  async getTimeSlotsConfig(): Promise<TimeSlot[] | null> {
    const configRef = doc(db, "timeSlots", "config");
    try {
      const snap = await getDoc(configRef);
      if (snap.exists()) {
        return snap.data().slots as TimeSlot[];
      }
    } catch (e) {
      console.error("Failed to fetch time slots config:", e);
    }
    return null;
  },

  async saveTimeSlotsConfig(slots: TimeSlot[]) {
    const configRef = doc(db, "timeSlots", "config");
    await setDoc(configRef, { 
      slots,
      updatedAt: new Date().toISOString() 
    });
  },

  async syncMessStatus() {
    const slotRef = doc(db, "timeSlots", "current");
    const snap = await getDoc(slotRef);
    if (snap.exists()) {
      const data = snap.data();
      const isActive = !!data.active;
      await messStatusService.setMessStatus({ isOpen: isActive });
      return isActive;
    } else {
      await messStatusService.setMessStatus({ isOpen: false });
      return false;
    }
  },

  async getSettings(): Promise<{ thresholdMinutes: number; autoToggleEnabled: boolean } | null> {
    const settingsRef = doc(db, "timeSlots", "settings");
    try {
      const snap = await getDoc(settingsRef);
      if (snap.exists()) {
        return snap.data() as { thresholdMinutes: number; autoToggleEnabled: boolean };
      }
    } catch (e) {
      console.error("Failed to fetch time slots settings:", e);
    }
    return null;
  },

  async saveSettings(settings: { thresholdMinutes: number; autoToggleEnabled: boolean }) {
    const settingsRef = doc(db, "timeSlots", "settings");
    await setDoc(settingsRef, {
      ...settings,
      updatedAt: new Date().toISOString()
    });
  }
};
