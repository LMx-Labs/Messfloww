/**
 * Generate a cryptographically secure, non-guessable Order ID.
 * Format: MFW-[12-char-hex] e.g. MFW-A3F9C2B48E17
 * The _userId param is kept for backward-compatibility but is no longer used.
 */
export function generateOrderID(_userId?: string): string {
  const uuid = crypto.randomUUID().replace(/-/g, '').substring(0, 12).toUpperCase();
  return `MFW-${uuid}`;
}

/**
 * Generate a QR code value - Now just the raw order ID
 */
export function generateQRCodeValue(orderId: string): string {
  return orderId;
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
    // Handle old format for backward compatibility
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
    
    // Otherwise, assume it's simply the raw order ID
    return { orderId: qrValue };
  } catch (error) {
    return { orderId: qrValue }; // Safe fallback
  }
}
