import { rtdbService } from "./rtdbService";
import { Order } from "../context/OrderContext";

export interface KOTCounter {
  id: string;
  name: string;
  categories: string[];
  autoPrint: boolean;
  mode: 'browser' | 'device';
  status: 'active' | 'idle' | 'disconnected';
  lastHeartbeat?: string;
  activeSessionId?: string;
}

export const kotService = {
  /**
   * Generates a deterministic KOT ID to prevent duplicate printing.
   * Unique per order + counter combination.
   */
  generateKOTId(orderId: string, counterId: string): string {
    return `${orderId}_${counterId}`;
  },

  /**
   * Routes an order's items to the appropriate counters based on their categories.
   */
  async routeOrderToCounters(order: Order, counters: KOTCounter[], allMenuItems: any[]) {
    if (!order.items || order.items.length === 0) return;

    // Group items by counter
    const itemsByCounter: Record<string, any[]> = {};
    const uncategorizedItems: any[] = [];

    order.items.forEach(item => {
      // Find the menu item to get its category
      const menuItem = allMenuItems.find(m => m.id === item.id || m.name === item.name);
      const category = menuItem?.category || 'UNCATEGORIZED';

      // Find which counter handles this category
      const counter = counters.find(c => 
        c.categories.some(cat => cat.toUpperCase() === category.toUpperCase())
      );

      if (counter) {
        if (!itemsByCounter[counter.id]) {
          itemsByCounter[counter.id] = [];
        }
        itemsByCounter[counter.id].push(item);
      } else {
        uncategorizedItems.push(item);
      }
    });

    // Enqueue KOTs for each counter that has items
    const promises = Object.entries(itemsByCounter).map(async ([counterId, items]) => {
      const kotId = this.generateKOTId(order.id, counterId);
      const kotData = {
        orderId: order.id,
        orderNumber: order.orderNumber,
        externalLabel: order.externalLabel,
        userRollNo: order.userRollNo,
        items: items.map(i => ({
          name: i.name.toUpperCase(),
          qty: i.qty
        })),
        slotName: order.slotName,
        createdAt: order.createdAt
      };

      await rtdbService.pushKOTToQueue(counterId, kotId, kotData);
    });

    // Handle items that didn't match any counter (pushed to a special 'uncategorized' queue)
    if (uncategorizedItems.length > 0) {
      const kotId = this.generateKOTId(order.id, 'uncategorized');
      const kotData = {
        orderId: order.id,
        orderNumber: order.orderNumber,
        externalLabel: order.externalLabel,
        userRollNo: order.userRollNo,
        items: uncategorizedItems.map(i => ({
          name: i.name.toUpperCase(),
          qty: i.qty
        })),
        slotName: order.slotName,
        createdAt: order.createdAt,
        isUncategorized: true
      };
      await rtdbService.pushKOTToQueue('uncategorized', kotId, kotData);
    }

    await Promise.all(promises);
  }
};
