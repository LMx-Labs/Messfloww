/**
 * Generate a standard Order ID
 * Format: MFW-[UnixTimestamp]-[UserShortUID]
 */
export function generateOrderID(userId: string): string {
  const ts = Math.floor(Date.now() / 1000);
  const shortUid = userId.length >= 4 ? userId.slice(-4).toUpperCase() : userId.padEnd(4, '0').toUpperCase();
  return `MFW-${ts}-${shortUid}`;
}

/**
 * Generate a QR code value - Now just the raw order ID
 */
export function generateQRCodeValue(orderId: string, timestamp?: number): string {
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
