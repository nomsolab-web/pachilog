import { createMiddleware } from "hono/factory";

/**
 * Very small in-memory fixed-window rate limiter.
 * Good enough for a single Cloud Run instance (max-instances=1) protecting
 * cheap public endpoints (votes) from abuse/spam. Not distributed-safe —
 * if you scale to multiple instances later, replace with a shared store
 * (e.g. Redis/Upstash) or Cloud Armor at the edge.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit({ limit = 10, windowMs = 60_000 } = {}) {
  return createMiddleware(async (c, next) => {
    const key = `${c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "unknown"}:${c.req.path}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
    } else if (bucket.count >= limit) {
      return c.json({ error: "too many requests" }, 429);
    } else {
      bucket.count += 1;
    }

    await next();
  });
}
