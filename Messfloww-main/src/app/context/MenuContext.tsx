import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { rtdbService } from "../services/rtdbService";

export interface MenuItem {
  id: number;
  name: string;
  price: number;
  available: boolean;
  isVeg: boolean;
  category: string;
  stock: number;
  initialStock: number;
  minStock: number;
  lowStockAlert: boolean;
  slot: MealType;
  gst: number;
  isMRP: boolean;
  cost?: number; // Optional cost price for profitability reports
}

export type MealType = string;

interface MenuContextType {
  menu: Record<MealType, MenuItem[]>;
  setMenu: React.Dispatch<React.SetStateAction<Record<MealType, MenuItem[]>>>;
  decreaseStock: (mealType: MealType, itemId: number, quantity: number) => void;
  setInitialStock: (mealType: MealType, itemId: number, stock: number) => void;
  setMinStock: (mealType: MealType, itemId: number, minStock: number) => void;
  lowStockItems: MenuItem[];
  outOfStockItems: MenuItem[];
}

const MenuContext = createContext<MenuContextType | undefined>(undefined);

export function MenuProvider({ children }: { children: ReactNode }) {
  const [menu, setMenuState] = useState<Record<string, MenuItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [lowStockItems, setLowStockItems] = useState<MenuItem[]>([]);
  const [outOfStockItems, setOutOfStockItems] = useState<MenuItem[]>([]);

  useEffect(() => {
    let currentMenu: Record<MealType, MenuItem[]> = {
      breakfast: [], lunch: [], snacks: [], dinner: [], night: []
    };
    let currentStockMap: Record<string, any> = {};
    let rtdbLoaded = false;

    const emitMenu = () => {
      const mergedMenu: Record<string, MenuItem[]> = { ...currentMenu };
      let lowStock: MenuItem[] = [];
      let outOfStock: MenuItem[] = [];

      (Object.keys(mergedMenu) as MealType[]).forEach((mealType) => {
        mergedMenu[mealType] = mergedMenu[mealType].map(item => {
          const rtdbStock = currentStockMap[item.id];
          const stockValue = rtdbStock?.stock ?? item.stock ?? 0;
          const minStockValue = rtdbStock?.minStock ?? item.minStock ?? 0;
          const isAvailable = rtdbStock?.available ?? item.available ?? true;

          const mergedItem = {
            ...item,
            stock: stockValue,
            minStock: minStockValue,
            available: isAvailable,
            lowStockAlert: isAvailable && stockValue <= 20 && stockValue >= 15
          };

          if (mergedItem.available && mergedItem.stock >= 15 && mergedItem.stock <= 20) {
            lowStock.push(mergedItem);
          }
          if (mergedItem.available && mergedItem.stock <= mergedItem.minStock) {
            outOfStock.push(mergedItem);
          }

          return mergedItem;
        });
      });

      setMenuState(mergedMenu);
      setLowStockItems(lowStock);
      setOutOfStockItems(outOfStock);

      // Auto-disable items that reached minimum stock in RTDB
      if (rtdbLoaded) {
        outOfStock.forEach(item => {
          if (item.available) {
            rtdbService.setMenuStock(item.id, { 
              stock: item.stock, 
              minStock: item.minStock, 
              available: false 
            });
          }
        });
      }
    };

    let unsubscribeFirestore: () => void;
    let unsubscribeRTDB: () => void;

    import("../services/firestoreService").then(({ subscribeMenu }) => {
      unsubscribeFirestore = subscribeMenu((data: Record<string, MenuItem[]>) => {
        // map string record to MealType record
        currentMenu = data as Record<MealType, MenuItem[]>;
        setLoading(false);
        emitMenu();
      });
    });

    unsubscribeRTDB = rtdbService.subscribeMenuStock((stockMap) => {
      currentStockMap = stockMap;
      rtdbLoaded = true;
      if (!loading) emitMenu();
    });

    return () => {
      if (unsubscribeFirestore) unsubscribeFirestore();
      if (unsubscribeRTDB) unsubscribeRTDB();
    };
  }, [loading]);

  const setMenu = async (_newMenuOrUpdater: any) => {
    // Handled by subscribers
  };

  const decreaseStock = async (mealType: MealType, itemId: number, quantity: number) => {
    try {
        // Atomic decrement in RTDB
        const updatedData = await rtdbService.decrementStock(itemId, quantity);
        if (updatedData) {
            const newStock = updatedData.stock;
            // Sync with Firestore for long-term persistence (baselines)
            const { updateMenuItem } = await import("../services/firestoreService");
            await updateMenuItem(itemId, { stock: newStock });
        }
    } catch (e) {
        console.error("Failed to decrease stock atomically:", e);
    }
  };

  const setInitialStock = async (mealType: MealType, itemId: number, stock: number) => {
      const item = menu[mealType].find(i => i.id === itemId);
      if(item) {
        await rtdbService.setMenuStock(itemId, {
            stock: stock,
            minStock: item.minStock,
            available: stock > item.minStock
        });
        // Also update initialStock in Firestore
        const { updateMenuItem } = await import("../services/firestoreService");
        await updateMenuItem(itemId, { initialStock: stock, stock: stock });
      }
  };

  const setMinStock = async (mealType: MealType, itemId: number, minStock: number) => {
      const item = menu[mealType].find(i => i.id === itemId);
      if(item) {
        await rtdbService.setMenuStock(itemId, {
            stock: item.stock,
            minStock: minStock,
            available: item.stock > minStock
        });
        const { updateMenuItem } = await import("../services/firestoreService");
        await updateMenuItem(itemId, { minStock: minStock });
      }
  };

  return (
    <MenuContext.Provider
      value={{
        menu,
        setMenu: setMenu as any,
        decreaseStock,
        setInitialStock,
        setMinStock,
        lowStockItems,
        outOfStockItems,
      }}
    >
      {children}
    </MenuContext.Provider>
  );
}

export function useMenu() {
  const context = useContext(MenuContext);
  if (context === undefined) {
    throw new Error("useMenu must be used within a MenuProvider");
  }
  return context;
}