interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitRecord>();

// Periodically clean expired rate-limit records
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of memoryStore.entries()) {
      if (record.resetAt <= now) {
        memoryStore.delete(key);
      }
    }
  }, 60000).unref?.();
}

export interface RateLimitOptions {
  windowMs?: number; // e.g. 60000 (1 minute)
  maxRequests?: number; // e.g. 20 requests per window
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Distributed-ready sliding-window rate limiter for sensitive endpoints
 * (public document access, SMS triggers, authentication).
 * 
 * Automatically falls back to in-memory sliding-window store when Upstash
 * Redis REST credentials are not provided.
 */
export async function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const windowMs = options.windowMs || 60000;
  const maxRequests = options.maxRequests || 20;
  const now = Date.now();

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  // If Upstash Redis is configured, use atomic HTTP REST commands
  if (upstashUrl && upstashToken) {
    try {
      const windowSeconds = Math.ceil(windowMs / 1000);
      const redisKey = `ratelimit:${identifier}`;

      // Pipeline INCR and EXPIRE in a single REST call
      const pipelineRes = await fetch(`${upstashUrl}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${upstashToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['INCR', redisKey],
          ['EXPIRE', redisKey, windowSeconds],
        ]),
        signal: AbortSignal.timeout(3000),
      });

      if (pipelineRes.ok) {
        const results = await pipelineRes.json();
        const currentCount = Number(results?.[0]?.result) || 1;
        const isAllowed = currentCount <= maxRequests;

        return {
          success: isAllowed,
          remaining: Math.max(0, maxRequests - currentCount),
          resetAt: now + windowMs,
        };
      }
    } catch (redisErr) {
      console.warn('[RateLimiter] Upstash Redis call failed, falling back to in-memory limiter:', redisErr);
    }
  }

  // Fallback to in-memory sliding-window limiter
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

/**
 * Resets a rate limit counter (primarily for testing and mock runs).
 */
export function resetRateLimit(identifier?: string): void {
  if (identifier) {
    memoryStore.delete(identifier);
  } else {
    memoryStore.clear();
  }
}
