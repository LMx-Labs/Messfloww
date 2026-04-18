import { doc, onSnapshot, updateDoc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { rtdbService } from "./rtdbService";

export interface TimeSlot {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
}

export const timeSlotService = {
  subscribeToActiveSlot(callback: (slot: TimeSlot | null) => void) {
    const slotRef = doc(db, "timeSlots", "current");
    return onSnapshot(slotRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().active) {
        callback(docSnap.data().slot as TimeSlot);
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

    await rtdbService.setMessStatus({ isOpen: true, currentlyServing: 0 });
  },

  async deactivateSlot() {
    const slotRef = doc(db, "timeSlots", "current");
    await setDoc(slotRef, { active: false, slot: null });

    await rtdbService.setMessStatus({ isOpen: false });
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

  /**
   * Forces a sync between the Firestore 'active' state and RTDB 'isOpen' state.
   */
  async syncMessStatus() {
    const slotRef = doc(db, "timeSlots", "current");
    const snap = await getDoc(slotRef);
    if (snap.exists()) {
      const data = snap.data();
      const isActive = !!data.active;
      await rtdbService.setMessStatus({ isOpen: isActive });
      return isActive;
    } else {
      await rtdbService.setMessStatus({ isOpen: false });
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
