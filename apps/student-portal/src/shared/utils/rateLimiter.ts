/**
 * Token Bucket Rate Limiter
 *
 * Each action has a bucket. When the action is taken, one token is consumed.
 * Tokens refill over time at the specified rate.
 *
 * This is purely client-side (resets on page refresh) and is a UX safeguard
 * to prevent accidental or malicious rapid Firestore reads/writes from a single session.
 * Server-side protection is enforced by Firestore Security Rules + App Check.
 */

interface TokenBucket {
  tokens: number;
  lastRefillTime: number;
  maxTokens: number;
  refillRateMs: number; // ms per token
}

const buckets = new Map<string, TokenBucket>();

/**
 * Create or get a rate limiter bucket.
 * @param key Unique identifier for the action (e.g. 'placeOrder', 'loadMenu')
 * @param maxTokens Maximum concurrent tokens (burst size)
 * @param refillRateMs Milliseconds per token to refill (e.g. 60000 = 1 token/min)
 */
function getBucket(key: string, maxTokens: number, refillRateMs: number): TokenBucket {
  if (!buckets.has(key)) {
    buckets.set(key, {
      tokens: maxTokens,
      lastRefillTime: Date.now(),
      maxTokens,
      refillRateMs,
    });
  }
  return buckets.get(key)!;
}

/**
 * Refill the bucket based on elapsed time.
 */
function refill(bucket: TokenBucket): void {
  const now = Date.now();
  const elapsed = now - bucket.lastRefillTime;
  const tokensToAdd = Math.floor(elapsed / bucket.refillRateMs);

  if (tokensToAdd > 0) {
    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefillTime = now;
  }
}

/**
 * Try to consume a token. Returns true if allowed, false if rate limited.
 * @param key Unique identifier for the action
 * @param maxTokens Maximum burst count
 * @param refillRateMs Ms per token refill
 */
export function tryConsume(
  key: string,
  maxTokens: number,
  refillRateMs: number
): boolean {
  const bucket = getBucket(key, maxTokens, refillRateMs);
  refill(bucket);

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }

  return false;
}

/**
 * Get remaining seconds until the next token is available.
 */
export function secondsUntilNextToken(key: string): number {
  const bucket = buckets.get(key);
  if (!bucket) return 0;

  const now = Date.now();
  const elapsed = now - bucket.lastRefillTime;
  const msUntilNext = bucket.refillRateMs - (elapsed % bucket.refillRateMs);
  return Math.ceil(msUntilNext / 1000);
}

// ─── Pre-defined Rate Limits ────────────────────────────────────────────────
// Use these constants in screens to keep limits centralized.

// Max 3 orders per 5 minutes
export const ORDER_RATE = { key: 'placeOrder', max: 3, refillMs: 100_000 };

// Max 1 manual menu refresh per 30 seconds
export const MENU_REFRESH_RATE = { key: 'menuRefresh', max: 1, refillMs: 30_000 };

// Max 5 login attempts before lockout (60s per token)
export const LOGIN_RATE = { key: 'login', max: 5, refillMs: 60_000 };
