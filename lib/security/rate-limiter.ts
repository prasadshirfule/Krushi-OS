interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitRecord>();

// Periodically clean expired rate-limit records
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of memoryStore.entries()) {
    if (record.resetAt <= now) {
      memoryStore.delete(key);
    }
  }
}, 60000).unref?.();

export interface RateLimitOptions {
  windowMs?: number; // e.g. 60000 (1 minute)
  maxRequests?: number; // e.g. 10 requests per window
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * In-memory sliding-window rate limiter for sensitive API routes (auth, login, token access).
 * Does not require external Redis for single-node / Vercel lambda execution.
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const windowMs = options.windowMs || 60000;
  const maxRequests = options.maxRequests || 20;
  const now = Date.now();

  const record = memoryStore.get(identifier);

  if (!record || record.resetAt <= now) {
    memoryStore.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      success: true,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
    };
  }

  if (record.count >= maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetAt: record.resetAt,
    };
  }

  record.count += 1;
  return {
    success: true,
    remaining: maxRequests - record.count,
    resetAt: record.resetAt,
  };
}
