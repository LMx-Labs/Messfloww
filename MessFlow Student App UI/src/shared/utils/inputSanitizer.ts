/**
 * Input Sanitizer & Validator
 * Prevents XSS, script injection, and malformed data from reaching Firestore.
 */

/**
 * Strip HTML tags and dangerous characters from a string.
 * Used for: name, rollNo fields in signup form.
 */
export function sanitizeInput(str: string): string {
  return str
    .replace(/<[^>]*>/g, '')           // Remove HTML tags
    .replace(/javascript:/gi, '')       // Remove JS injection
    .replace(/on\w+=/gi, '')            // Remove event handlers like onclick=
    .replace(/[<>"'`]/g, '')            // Remove remaining dangerous chars
    .trim();
}

/**
 * Validate email format.
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate a student Roll Number (e.g., 21CS001, 23ME45).
 * Alphanumeric, 4–10 characters, no special characters.
 */
export function validateRollNo(rollNo: string): boolean {
  const rollNoRegex = /^[A-Za-z0-9]{4,15}$/;
  return rollNoRegex.test(rollNo.trim());
}

/**
 * Validate password strength.
 * Must be at least 6 characters.
 */
export function validatePassword(password: string): string | null {
  if (password.length < 6) return 'Password must be at least 6 characters.';
  return null;
}

/**
 * Validate and sanitize a display name.
 * Letters, spaces, periods, hyphens only.
 */
export function validateName(name: string): string | null {
  const sanitized = sanitizeInput(name);
  if (sanitized.length < 2) return 'Name must be at least 2 characters.';
  if (sanitized.length > 64) return 'Name is too long.';
  if (!/^[A-Za-z\s.\-]+$/.test(sanitized)) return 'Name can only contain letters, spaces, periods, and hyphens.';
  return null;
}
