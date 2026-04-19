/**
 * Generate a complex QR code value with student registration number, date-time, and RTDB order ID
 * Format: MESSFLOWW|ID:-NABCXYZ|REGNO:21CS001|TS:1712920200000
 */

export function generateQRCodeValue(orderId: string, timestamp: number): string {
  // Generate a dynamic QR code value with timestamp to prevent screenshots
  return `MESSFLOWW|ID:${orderId}|TS:${timestamp}`;
}

/**
 * Parse QR code value back to its components
 */
export function parseQRCodeValue(qrValue: string): {
  orderId: string;
  ts: number;
} | null {
  try {
    const parts = qrValue.split('|');
    
    if (parts[0] !== 'MESSFLOWW' || parts.length !== 3) {
      return null;
    }
    
    const orderId = parts[1].replace('ID:', '');
    const ts = parseInt(parts[2].replace('TS:', ''), 10);
    
    return { orderId, ts };
  } catch (error) {
    return null;
  }
}

