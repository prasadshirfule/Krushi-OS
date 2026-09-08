/**
 * Universal Indian Mobile Number Normalization Utility
 * 
 * Accurately normalizes any valid Indian mobile number format:
 * - +919876543210 -> 9876543210
 * - +91 98765 43210 -> 9876543210
 * - +91-98765-43210 -> 9876543210
 * - 919876543210 -> 9876543210
 * - 09876543210 -> 9876543210
 * - 9876543210 -> 9876543210
 * 
 * Strict Validation:
 * - Indian mobile numbers must be 10 digits and start with 6, 7, 8, or 9.
 * - Non-matching or malformed inputs return null.
 */

export function normalizeIndianMobile(rawMobile: string | null | undefined): string | null {
  if (!rawMobile || typeof rawMobile !== 'string') {
    return null;
  }

  // Strip all non-digit characters
  let digits = rawMobile.replace(/\D/g, '');

  // Case 1: 12 digits starting with country code 91 (e.g. 919876543210)
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  }

  // Case 2: 11 digits starting with trunk prefix 0 (e.g. 09876543210)
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Verify valid Indian 10-digit mobile starting with 6, 7, 8, or 9
  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
    return digits;
  }

  return null;
}

/**
 * Formats a normalized 10-digit mobile for UI display (e.g. "+91 98765 43210")
 */
export function formatDisplayMobile(rawMobile: string | null | undefined): string {
  const normalized = normalizeIndianMobile(rawMobile);
  if (!normalized) return rawMobile || '';
  return `+91 ${normalized.slice(0, 5)} ${normalized.slice(5)}`;
}
