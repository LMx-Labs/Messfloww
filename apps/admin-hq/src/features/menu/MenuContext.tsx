import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { menuService, stockService } from "@messflow/shared-core";
import type { MenuItem as CoreMenuItem, MealType } from "@messflow/shared-core";

// Re-export core types extended with admin-only fields
export interface MenuItem extends CoreMenuItem {
  lowStockAlert: boolean;
}

export type { MealType };

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

          const mergedItem: MenuItem = {
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
            stockService.setMenuStock(item.id, { 
              stock: item.stock, 
              minStock: item.minStock, 
              available: false 
            });
          }
        });
      }
    };

    const unsubFirestore = menuService.subscribeToMenu((data: Record<string, CoreMenuItem[]>) => {
      // cast to local MenuItem type (adds lowStockAlert)
      currentMenu = data as Record<MealType, MenuItem[]>;
      setLoading(false);
      emitMenu();
    });

    const unsubRTDB = stockService.subscribeMenuStock((stockMap: any) => {
      currentStockMap = stockMap;
      rtdbLoaded = true;
      if (!loading) emitMenu();
    });

    return () => {
      unsubFirestore();
      unsubRTDB();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // deliberately empty — subscriptions are set up once

  const setMenu = async (_newMenuOrUpdater: any) => {
    // Handled by subscribers
  };

  const decreaseStock = async (_mealType: MealType, itemId: number, quantity: number) => {
    try {
      const updatedData = await stockService.decrementStock(itemId, quantity);
      if (updatedData) {
        const newStock = updatedData.stock;
        await menuService.updateMenuItem(itemId, { stock: newStock });
      }
    } catch (e) {
      console.error("Failed to decrease stock atomically:", e);
    }
  };

  const setInitialStock = async (mealType: MealType, itemId: number, stock: number) => {
    const item = menu[mealType]?.find(i => i.id === itemId);
    if (item) {
      await stockService.setMenuStock(itemId, {
        stock,
        minStock: item.minStock,
        available: stock > item.minStock
      });
      await menuService.updateMenuItem(itemId, { initialStock: stock, stock });
    }
  };

  const setMinStock = async (mealType: MealType, itemId: number, minStock: number) => {
    const item = menu[mealType]?.find(i => i.id === itemId);
    if (item) {
      await stockService.setMenuStock(itemId, {
        stock: item.stock,
        minStock,
        available: item.stock > minStock
      });
      await menuService.updateMenuItem(itemId, { minStock });
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