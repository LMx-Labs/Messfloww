import { BillDocument, BillItem } from './types';

/**
 * Maps an internal Order object to the BillDocument structure required by the ThermalPrinter.
 */
export function mapOrderToBill(order: any, student?: any): BillDocument {
  const isExternal = order.isExternal || order.userId === 'EXTERNAL';
  
  // Map items and try to calculate/infer GST
  const items: BillItem[] = (order.items || []).map((item: any) => {
    const qty = item.qty || item.quantity || 1;
    const basePrice = item.price || 0;
    
    // In this system, if price is base price, we need to add GST to get the inclusive rate
    // If it's already inclusive, we use it as is.
    // ReceiptPrint assumes 5% if not specified.
    const gstPercentage = item.gst !== undefined ? item.gst : 5.0;
    
    // Calculate inclusive rate if it's not already inclusive
    // Based on ExternalOrder.tsx: finalPrice = price + round(price * gst/100)
    const gstAmount = Math.round(basePrice * (gstPercentage / 100));
    const inclusiveRate = basePrice + gstAmount;

    return {
      name: item.name.toUpperCase(),
      qty: qty,
      rate: inclusiveRate,
      gstPercentage: gstPercentage
    };
  });

  // Find student if not provided for better resilience, though usually handlePrint passes it
  // account balance mapping
  let currentBalance = 0;
  if (student) {
    // Some structures might use 'credits' while others use 'balance'
    currentBalance = typeof student.balance === 'number' ? student.balance : 
                     typeof student.credits === 'number' ? student.credits : 0;
  }

  return {
    billId: order.id,
    timestamp: order.createdAt ? new Date(order.createdAt) : new Date(),
    customer: {
      name: order.externalLabel || student?.name || (isExternal ? "WALK-IN CUSTOMER" : "STUDENT"),
      regNo: order.userRollNo || "N/A"
    },
    items: items,
    meta: {
      tokenNo: order.orderNumber?.toString() || "0",
      paymentStatus: (order.status === 'completed' || isExternal) ? "PAID" : "PENDING"
    },
    account: student ? {
      currentBalance: currentBalance
    } : undefined
  };
}

/**
 * Maps an internal Order object to an array of KOTs grouped by category.
 */
export function mapOrderToKOTs(order: any, allMenuItems: any[]): BillDocument[] {
  const groups: Record<string, any[]> = {};
  
  for (const item of (order.items || [])) {
    // Resolve category
    const menuItem = allMenuItems.find(i => i.id === item.id || i.name === item.name);
    const category = menuItem?.category || 'UNCATEGORIZED';
    
    if (!groups[category]) {
      groups[category] = [];
    }
    
    // Combine identical items
    const existing = groups[category].find(i => i.name === item.name);
    if (existing) {
      existing.qty += (item.qty || 1);
    } else {
      groups[category].push({ ...item, qty: item.qty || 1 });
    }
  }

  // Generate a distinct KOT for each category
  return Object.entries(groups).map(([category, items]) => {
    const mappedItems: BillItem[] = items.map(item => ({
      name: item.name.toUpperCase(),
      qty: item.qty,
      rate: 0,
      gstPercentage: 0
    }));

    return {
      billId: order.id,
      timestamp: order.createdAt ? new Date(order.createdAt) : new Date(),
      customer: {
        name: "STUDENT",
        regNo: order.externalLabel || order.userRollNo || "N/A"
      },
      items: mappedItems,
      meta: {
        tokenNo: order.orderNumber?.toString() || "0",
        paymentStatus: "PREPARING"
      },
      isKOT: true,
      kotCategory: category.toUpperCase()
    };
  });
}

/**
 * Maps a KOT queue item from RTDB to the minimal BillDocument format.
 */
export function mapQueuedKOTToBill(kot: any, counterName?: string): BillDocument {
  return {
    billId: kot.orderId,
    timestamp: kot.createdAt ? new Date(kot.createdAt) : new Date(),
    customer: {
      name: kot.externalLabel || "STUDENT",
      regNo: kot.userRollNo || "N/A"
    },
    items: (kot.items || []).map((i: any) => ({
      name: i.name,
      qty: i.qty,
      rate: 0,
      gstPercentage: 0
    })),
    meta: {
      tokenNo: kot.orderNumber?.toString() || "0",
      paymentStatus: "PREPARING"
    },
    isKOT: true,
    kotCategory: counterName?.toUpperCase() || (kot.isUncategorized ? "GENERAL" : undefined)
  };
}
