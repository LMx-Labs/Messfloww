import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  QuerySnapshot,
  DocumentSnapshot,
  writeBatch, 
  getDocs
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { stockService } from "../rtdb/stockService";
import { MenuItem, MealType } from "../types";

const MENU_COLLECTION = "menu";

export const menuService = {
  // ---- Student Side ----
  async getMenu(): Promise<Record<string, MenuItem[]>> {
    const menuRef = collection(db, MENU_COLLECTION);
    const snapshot = await getDocs(menuRef);
    const menu: Record<string, MenuItem[]> = {};
    
    snapshot.forEach((docSnap: DocumentSnapshot) => {
      const data = docSnap.data()!;
      const item = {
        ...data,
        id: typeof data.id === 'string' ? parseInt(data.id) : data.id
      } as MenuItem;
      const slot = (item.slot || "Other").toLowerCase();
      if (!menu[slot]) {
        menu[slot] = [];
      }
      menu[slot].push(item);
    });
    return menu;
  },

  subscribeToMenu(callback: (menu: Record<string, MenuItem[]>) => void): () => void {
    const menuRef = collection(db, MENU_COLLECTION);
    
    let currentMenu: Record<string, MenuItem[]> = {};
    let currentStockMap: Record<string, any> = {};

    const emitMenu = () => {
      const mergedMenu: Record<string, MenuItem[]> = {};
      Object.keys(currentMenu).forEach(slot => {
        mergedMenu[slot] = currentMenu[slot].map(item => {
          const rtdbStock = currentStockMap[item.id];
          if (rtdbStock) {
            return {
              ...item,
              stock: rtdbStock.stock,
              minStock: rtdbStock.minStock,
              available: rtdbStock.available
            };
          }
          return item;
        });
      });
      callback(mergedMenu);
    };

    const unsubscribeFirestore = onSnapshot(menuRef, (snapshot: QuerySnapshot) => {
      const menu: Record<string, MenuItem[]> = {};
      snapshot.forEach((docSnap: DocumentSnapshot) => {
        const data = docSnap.data()!;
        const item = {
          ...data,
          id: typeof data.id === 'string' ? parseInt(data.id) : data.id
        } as MenuItem;
        const slot = (item.slot || "Other").toLowerCase();
        if (!menu[slot]) {
          menu[slot] = [];
        }
        menu[slot].push(item);
      });
      currentMenu = menu;
      emitMenu();
    });

    const unsubscribeRTDB = stockService.subscribeMenuStock((stockMap: any) => {
      currentStockMap = stockMap;
      emitMenu();
    });

    return () => {
      unsubscribeFirestore();
      unsubscribeRTDB();
    };
  },

  // ---- Admin Side ----
  async addMenuItem(item: MenuItem) {
    const id = item.id || Date.now();
    const docRef = doc(db, MENU_COLLECTION, id.toString());
    await setDoc(docRef, { ...item, id });
    
    await stockService.setMenuStock(id, {
      stock: item.stock || 0,
      minStock: item.minStock || 0,
      available: item.available !== undefined ? item.available : true
    });
  },

  async updateMenuItem(id: number, data: Partial<MenuItem>) {
    const docRef = doc(db, MENU_COLLECTION, id.toString());
    await updateDoc(docRef, data as any);
  },

  async deleteMenuItem(id: number) {
    const docRef = doc(db, MENU_COLLECTION, id.toString());
    await deleteDoc(docRef);
  },

  async batchReplaceMenuSlot(slot: MealType, items: MenuItem[]) {
    const snapshot = await getDocs(collection(db, MENU_COLLECTION));
    const batch = writeBatch(db);
    
    snapshot.forEach((document: DocumentSnapshot) => {
      const data = document.data();
      if (data && data.slot === slot) {
        batch.delete(document.ref);
      }
    });

    for (const item of items) {
      const id = item.id || Date.now() + Math.floor(Math.random() * 1000); 
      const itemWithId = { ...item, id };
      const docRef = doc(db, MENU_COLLECTION, id.toString());
      batch.set(docRef, itemWithId);
      
      await stockService.setMenuStock(id, {
        stock: item.stock || 0,
        minStock: item.minStock || 0,
        available: item.available !== undefined ? item.available : true
      });
    }
    
    await batch.commit();
  }
};
