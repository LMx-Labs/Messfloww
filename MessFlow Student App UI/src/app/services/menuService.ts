import { collection, onSnapshot, getDocs, getDocsFromCache } from "firebase/firestore";
import { db } from "../firebase/config";
import { rtdbService } from "./rtdbService";

export interface MenuItem {
  id: number;
  name: string;
  price: number;
  available: boolean;
  stock: number;
  minStock?: number;
  category: string;
  isVeg: boolean;
  slot: string;
  gst?: number;
  isMRP?: boolean;
}

export type MenuData = Record<string, MenuItem[]>;

export const menuService = {
  /**
   * Fetch the menu from Firestore and latest stock from RTDB.
   */
  async getMenu(): Promise<MenuData> {
    try {
      return await fetchFromSource(true);
    } catch (error) {
      console.warn("Cache miss for menu, fetching from server...");
      return await fetchFromSource(false);
    }
  },

  /**
   * Subscribe to real-time menu updates from Firestore & Stock from RTDB.
   */
  subscribeToMenu(callback: (menu: MenuData) => void): () => void {
    const menuRef = collection(db, "menu");
    
    let currentMenu: MenuData = {};
    let currentStockMap: Record<string, any> = {};

    const emitMenu = () => {
      const mergedMenu: MenuData = {};
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
          return item; // Fallback to Firestore defaults if not in RTDB yet
        });
      });
      callback(mergedMenu);
    };

    const unsubscribeFirestore = onSnapshot(menuRef, { includeMetadataChanges: true }, (snapshot) => {
      console.log(`[MenuService] Firestore snapshot received. Size: ${snapshot.size}`);
      const menu: MenuData = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
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

    const unsubscribeRTDB = rtdbService.subscribeToMenuStock((stockMap) => {
      currentStockMap = stockMap;
      emitMenu();
    });

    return () => {
      unsubscribeFirestore();
      unsubscribeRTDB();
    };
  }
};

async function fetchFromSource(fromCache: boolean): Promise<MenuData> {
  const menuRef = collection(db, "menu");
  const snapshot = fromCache 
    ? await getDocsFromCache(menuRef)
    : await getDocs(menuRef);

  if (fromCache && snapshot.empty) {
    throw new Error("Cache is empty");
  }

  const menu: MenuData = {};
  
  snapshot.forEach((doc) => {
    const data = doc.data();
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

  // Note: For initial static fetch `getMenu`, we might return stale initial stock from Firestore.
  // The subscription will override it. If exact initial stock is needed, we'd do a `get()` on RTDB here.
  return menu;
}
