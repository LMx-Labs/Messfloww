/**
 * Shared Formatting Utilities
 */

/**
 * Formats a number as Indian Rupee (INR) currency
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Formats a date or string into a readable date string (e.g., "18 Apr 2026")
 */
export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Formats a date or string into a readable time string (e.g., "01:25 PM")
 */
export const formatTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Formats a date or string into a full readable timestamp (e.g., "18 Apr 2026, 01:25 PM")
 */
export const formatTimestamp = (date: Date | string): string => {
  return `${formatDate(date)}, ${formatTime(date)}`;
};
