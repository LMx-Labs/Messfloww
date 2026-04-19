import { ref, runTransaction } from "firebase/database";
import { rtdb } from "../firebaseConfig";

interface TransactionInput {
  userId: string;
  items: Array<{ id: number; name: string; qty: number; price: number }>;
  totalPrice: number;
}

interface TransactionResult {
  success: boolean;
  failedItem?: string;
  stockReverts?: Array<{ itemId: number; qty: number }>;
}

/**
 * Atomic: Decrement stock for all items in a single pass.
 * If any item fails, automatically reverts all previous decrements.
 */
export async function processTransaction(input: TransactionInput): Promise<TransactionResult> {
  const reverts: Array<{ itemId: number; qty: number }> = [];

  for (const item of input.items) {
    const stockRef = ref(rtdb, `menu_stock/${item.id}`);
    const result = await runTransaction(stockRef, (currentData: any) => {
      if (currentData === null) return currentData;
      if ((currentData.stock || 0) >= item.qty) {
        currentData.stock -= item.qty;
        if (currentData.stock <= (currentData.minStock || 0)) {
          currentData.available = false;
        }
        return currentData;
      }
      return undefined; // Abort
    });

    if (!result.committed) {
      // Revert all previously decremented items
      for (const revert of reverts) {
        const revertRef = ref(rtdb, `menu_stock/${revert.itemId}`);
        await runTransaction(revertRef, (data: any) => {
          if (data) {
            data.stock = (data.stock || 0) + revert.qty;
            if (data.stock > (data.minStock || 0)) data.available = true;
          }
          return data;
        });
      }
      return { success: false, failedItem: item.name, stockReverts: reverts };
    }
    reverts.push({ itemId: item.id, qty: item.qty });
  }

  return { success: true };
}
