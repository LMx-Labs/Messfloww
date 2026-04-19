import { ref, onValue, update, runTransaction } from "firebase/database";
import { rtdb } from "../firebaseConfig";

export const stockService = {
  subscribeMenuStock(callback: (stockMap: Record<string, { stock: number, minStock: number, available: boolean }>) => void) {
    const stockRef = ref(rtdb, "menu_stock");
    return onValue(stockRef, (snapshot: any) => {
      const stockMap: Record<string, any> = {};
      if (snapshot.exists()) {
        snapshot.forEach((child: any) => {
          stockMap[child.key] = child.val();
        });
      }
      callback(stockMap);
    });
  },

  async setMenuStock(itemId: number, stockData: { stock: number, minStock: number, available: boolean }) {
    const itemStockRef = ref(rtdb, `menu_stock/${itemId}`);
    await update(itemStockRef, stockData);
  },

  async decrementStock(itemId: number, quantity: number) {
    const itemStockRef = ref(rtdb, `menu_stock/${itemId}`);
    const result = await runTransaction(itemStockRef, (currentData: any) => {
      if (currentData) {
        const newStock = Math.max(0, (currentData.stock || 0) - quantity);
        return {
          ...currentData,
          stock: newStock,
          available: newStock > (currentData.minStock || 0)
        };
      }
      return currentData;
    });
    return result.snapshot.val();
  }
};
