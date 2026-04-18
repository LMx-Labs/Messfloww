import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../core/firebase";

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
};

export const saveRoles = async (roles: any) => {
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
