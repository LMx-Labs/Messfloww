import { ref, onValue, update, get } from "firebase/database";
import { rtdb } from "../firebaseConfig";

export const messStatusService = {
  subscribeMessStatus(callback: (status: { isOpen: boolean, currentlyServing: number }) => void) {
    const statusRef = ref(rtdb, "mess_status");
    return onValue(statusRef, (snapshot: any) => {
      if (snapshot.exists()) {
        callback({
          isOpen: snapshot.val()?.isOpen ?? false,
          currentlyServing: snapshot.val()?.currentlyServing ?? 0
        });
      } else {
        callback({ isOpen: false, currentlyServing: 0 });
      }
    });
  },

  async setMessStatus(statusData: { isOpen?: boolean, currentlyServing?: number }) {
    const statusRef = ref(rtdb, "mess_status");
    await update(statusRef, { ...statusData, updatedAt: new Date().toISOString() });
  },

  async getMessStatus() {
    const statusRef = ref(rtdb, "mess_status");
    const snap = await get(statusRef);
    if (snap.exists()) {
      return snap.val() as { isOpen: boolean, currentlyServing: number };
    }
    return { isOpen: false, currentlyServing: 0 };
  }
};
