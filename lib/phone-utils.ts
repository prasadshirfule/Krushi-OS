/**
 * Pure phone formatting and validation utilities safe for both client and server components.
 */

/**
 * Normalizes an Indian mobile phone number to a standard 10-digit string (e.g. "9876543210").
 * Strips formatting, "+91", leading "91", or leading "0".
 * Returns null if the phone is not a valid 10-digit Indian mobile.
 */
export function normalizeIndianMobile(rawPhone?: string | null): string | null {
  if (!rawPhone || typeof rawPhone !== 'string') return null;

  let cleaned = rawPhone.trim();
  if (!cleaned) return null;

  // Remove existing @c.us or @s.whatsapp.net suffix if present
  cleaned = cleaned.replace(/@(c\.us|s\.whatsapp\.net)$/i, '').trim();

  // Remove formatting characters (spaces, hyphens, parentheses, dots)
  cleaned = cleaned.replace(/[\s\-().]/g, '');

  // Strip leading '+'
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // Reject if non-numeric characters remain
  if (!/^\d+$/.test(cleaned)) {
    return null;
  }

  // 10-digit Indian standard mobile number (strictly starts with 6, 7, 8, or 9)
  if (cleaned.length === 10 && /^[6-9]\d{9}$/.test(cleaned)) {
    return cleaned;
  }

  // 11-digit starting with 0 followed by valid Indian 10-digit mobile
  if (cleaned.length === 11 && /^0[6-9]\d{9}$/.test(cleaned)) {
    return cleaned.slice(1);
  }

  // 12-digit starting with 91 followed by valid Indian 10-digit mobile
  if (cleaned.length === 12 && /^91[6-9]\d{9}$/.test(cleaned)) {
    return cleaned.slice(2);
  }

  return null;
}

/**
 * Validates whether an input represents a valid 10-digit Indian mobile number.
 */
export function isValidIndianMobile(rawPhone?: string | null): boolean {
  return normalizeIndianMobile(rawPhone) !== null;
}

/**
 * Formats a 10-digit Indian mobile number for user display (e.g. "+91 98765 43210").
 */
export function formatDisplayMobile(rawPhone?: string | null): string {
  const norm = normalizeIndianMobile(rawPhone);
  if (!norm) return rawPhone || '';
  return `+91 ${norm.slice(0, 5)} ${norm.slice(5)}`;
}

/**
 * Normalize an Indian mobile phone number into OpenWA chatId format (e.g. 918080750206@c.us).
 * Strict validation for Indian 10-digit mobile numbers starting with 6, 7, 8, or 9:
 * - 8080750206 -> 918080750206@c.us
 * - 918080750206 -> 918080750206@c.us
 * - +918080750206 -> 918080750206@c.us
 * - 08080750206 -> 918080750206@c.us
 * - 918080750206@c.us -> 918080750206@c.us
 * Strictly rejects invalid Indian numbers (e.g. numbers starting with 0-5 or wrong length).
 */
export function normalizeWhatsAppPhone(rawPhone?: string | null): string | null {
  const norm10 = normalizeIndianMobile(rawPhone);
  if (!norm10) return null;
  return `91${norm10}@c.us`;
}

/**
 * Mask phone number for safe diagnostic logging without leaking PII.
 */
export function maskPhoneNumber(phone?: string | null): string {
  if (!phone || typeof phone !== 'string') return '(none)';
  const cleaned = phone.trim();
  if (cleaned.length <= 4) return '****';
  const prefix = cleaned.slice(0, 4);
  const suffix = cleaned.includes('@') ? cleaned.slice(cleaned.indexOf('@') - 2) : cleaned.slice(-2);
  return `${prefix}****${suffix}`;
}
