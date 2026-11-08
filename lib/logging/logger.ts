import { maskPhoneNumber } from '../phone-utils';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogContext {
  requestId?: string;
  shopId?: string;
  userId?: string;
  action?: string;
  [key: string]: any;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'apikey',
  'api_key',
  'authorization',
  'service_role',
  'access_token',
  'refresh_token',
  'otp',
  'pin',
  'aadhaar',
]);

/**
 * Recursively sanitizes sensitive fields and PII from log payloads.
 */
export function sanitizeLogPayload(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // If string resembles an auth bearer or long token, mask it
    if (obj.startsWith('Bearer ') || obj.length > 120) {
      return `${obj.substring(0, 8)}...[MASKED]`;
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeLogPayload);
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.has(lowerKey)) {
        sanitized[key] = '[REDACTED]';
      } else if (lowerKey.includes('phone') || lowerKey.includes('mobile')) {
        sanitized[key] = maskPhoneNumber(String(val));
      } else {
        sanitized[key] = sanitizeLogPayload(val);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Standard structured JSON logger for KRUSHI OS server actions and background tasks.
 */
export const logger = {
  info(message: string, context?: LogContext, data?: any) {
    const entry = {
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...context,
      data: sanitizeLogPayload(data),
    };
    console.log(JSON.stringify(entry));
  },

  warn(message: string, context?: LogContext, data?: any) {
    const entry = {
      level: 'warn',
      message,
      timestamp: new Date().toISOString(),
      ...context,
      data: sanitizeLogPayload(data),
    };
    console.warn(JSON.stringify(entry));
  },

  error(message: string, error?: any, context?: LogContext) {
    const entry = {
      level: 'error',
      message,
      timestamp: new Date().toISOString(),
      ...context,
      error: error instanceof Error ? { message: error.message, stack: error.stack } : sanitizeLogPayload(error),
    };
    console.error(JSON.stringify(entry));
  },
};
