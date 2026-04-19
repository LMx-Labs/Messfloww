import { db, menuService as coreMenuService, MenuItem } from "@messflow/shared-core";
import { offlineStorage } from "../../core/../shared/lib/offline/storage";



export type MenuData = Record<string, MenuItem[]>;

export const menuService = {
  /**
   * Fetch the menu from Firestore and latest stock from RTDB.
   */
  async getMenu(): Promise<MenuData> {
    try {
      return await fetchFromSource(true);
    } catch (error) {
      console.warn("Firestore menu fetch failed, trying local secondary cache...", error);
      const offlineMenu = await offlineStorage.getMenu();
      if (offlineMenu) return offlineMenu as MenuData;
      
      console.warn("Local storage cache miss, trying server fetch...");
      return await fetchFromSource(false);
    }
  },

  /**
   * Subscribe to real-time menu updates from core.
   */
  subscribeToMenu(callback: (menu: MenuData) => void): () => void {
    return coreMenuService.subscribeToMenu((mergedMenu: any) => {
      callback(mergedMenu as MenuData);
      // Persist to local secondary cache
      offlineStorage.saveMenu(mergedMenu);
    });
  }
};

async function fetchFromSource(_unused: boolean): Promise<MenuData> {
  return await coreMenuService.getMenu() as MenuData;
}
