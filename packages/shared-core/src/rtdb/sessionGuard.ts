import { ref, onValue, set } from "firebase/database";
import { rtdb } from "../firebaseConfig";

/** Generate or retrieve a browser-unique session ID */
export function getDeviceSessionId(): string {
  const key = "messflow_session_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem(key, id);
  }
  return id;
}

/** Write current session to RTDB */
export async function claimSession(uid: string): Promise<void> {
  const sessionRef = ref(rtdb, `users/${uid}/current_session_id`);
  await set(sessionRef, getDeviceSessionId());
}

/** Watch for session collisions; calls onCollision if another device logs in */
export function watchSessionCollision(
  uid: string, 
  onCollision: () => void,
  skipInitial: boolean = true
): () => void {
  const sessionRef = ref(rtdb, `users/${uid}/current_session_id`);
  const localId = getDeviceSessionId();
  let isFirstSnapshot = true;
  return onValue(sessionRef, (snap: any) => {
    const remoteId = snap.val();
    if (isFirstSnapshot && skipInitial) {
      isFirstSnapshot = false;
      return;
    }
    isFirstSnapshot = false;
    if (remoteId && remoteId !== localId) {
      onCollision();
    }
  });
}
