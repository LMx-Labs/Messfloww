import { Timestamp } from 'firebase/firestore';

export interface BillItem {
  name: string;
  qty: number;
  rate: number;
  gstPercentage: number;
}

export interface ReceiptSettings {
  messName?: string;
  address?: string;
  gstin?: string;
  fssai?: string;
}

export interface BillDocument {
  billId: string;
  timestamp: Timestamp | Date | any; // Any added for flexibility if it's serialized
  customer: {
    name: string;
    regNo: string;
  };
  items: BillItem[];
  meta: {
    tokenNo: string;
    paymentStatus: string;
  };
  account?: {
    currentBalance: number;
  };
  settings?: ReceiptSettings;
  isKOT?: boolean;
  kotCategory?: string;
}
