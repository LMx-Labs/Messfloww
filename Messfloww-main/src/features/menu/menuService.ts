import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch, getDocs } from "firebase/firestore";
import { db } from "../../core/firebase";
import { MenuItem, MealType } from "../../shared/types";

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

  // Note: We'll need to reach out to kitchen service for stock sync
  // For now, we import it directly from the feature folder
  const { kitchenService } = await import("../kitchen/kitchenService");
  
  for (const item of items) {
    const id = item.id || Date.now() + Math.floor(Math.random() * 1000); 
    const itemWithId = { ...item, id };
    const docRef = doc(db, MENU_COLLECTION, id.toString());
    batch.set(docRef, itemWithId);
    
    // Initialize RTDB stock for the new items
    await kitchenService.setMenuStock(id, {
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
