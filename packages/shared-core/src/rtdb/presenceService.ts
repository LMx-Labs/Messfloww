import { ref, onValue, set, onDisconnect } from "firebase/database";
import { rtdb } from "../firebaseConfig";

/** Admin-side: Write presence on connect, clear on disconnect */
export function startAdminHeartbeat(): () => void {
  const connectedRef = ref(rtdb, ".info/connected");
  const adminOnlineRef = ref(rtdb, "system_status/admin_online");
  return onValue(connectedRef, (snap: any) => {
    if (snap.val() === true) {
      set(adminOnlineRef, true);
      onDisconnect(adminOnlineRef).set(false);
    }
  });
}

/** Student-side: Subscribe to admin presence, returns unsubscribe */
export function subscribeAdminPresence(callback: (online: boolean) => void): () => void {
  const adminOnlineRef = ref(rtdb, "system_status/admin_online");
  return onValue(adminOnlineRef, (snap: any) => {
    callback(snap.val() === true);
  });
}
