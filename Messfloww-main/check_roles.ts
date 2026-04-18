import { db } from "./src/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

async function checkRoles() {
  const docRef = doc(db, "app_config", "roles");
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    console.log("Roles Config:", JSON.stringify(docSnap.data(), null, 2));
  } else {
    console.log("Roles document does not exist!");
  }
}

checkRoles();
