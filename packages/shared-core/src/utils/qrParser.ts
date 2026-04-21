/**
 * Generate a complex QR code value with order ID and timestamp
 * Format: MESSFLOWW|ID:<orderId>|TS:<timestamp>
 */
export function generateQRCodeValue(orderId: string, timestamp: number): string {
  return `MESSFLOWW|ID:${orderId}|TS:${timestamp}`;
}

/**
 * Simplified QR code parser:
 */
export function parseQRCodeValue(qrValue: string): {
  orderId: string;
  regNo?: string;
  ts?: number;
} | null {
  try {
    if (qrValue.startsWith('MESSFLOWW|')) {
      const parts = qrValue.split('|');
      let orderId = "";
      let regNo = "";
      let ts = 0;
      
      parts.forEach(part => {
        if (part.startsWith('ID:')) orderId = part.replace('ID:', '');
        if (part.startsWith('REGNO:')) regNo = part.replace('REGNO:', '');
        if (part.startsWith('TS:')) ts = parseInt(part.replace('TS:', ''), 10);
      });

      if (orderId) {
        return { orderId, regNo, ts };
      }
    }
    
    // Otherwise, assume it's simply the order ID
    return { orderId: qrValue };
  } catch (error) {
    return { orderId: qrValue }; // Safe fallback
  }
}
