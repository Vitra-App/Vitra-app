/**
 * Simple in-memory sliding-window rate limiter.
 * Works well on Railway (persistent Node.js server) and in local dev.
 * Resets on server restart — acceptable for anti-abuse, not billing.
 */

import type { NextRequest } from 'next/server';

interface Window {
  count: number;
  resetAt: number; // ms timestamp
}

const store = new Map<string, Window>();

/**
 * Check whether the given key has exceeded the limit.
 * @param key        Unique identifier (e.g. userId or IP)
 * @param limit      Max allowed requests per window
 * @param windowMs   Window duration in milliseconds
 * @returns `{ ok: true }` when allowed, `{ ok: false, retryAfterMs }` when rate-limited
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (entry.count < limit) {
    entry.count += 1;
    return { ok: true };
  }

  return { ok: false, retryAfterMs: entry.resetAt - now };
}

/**
 * Extracts the caller's IP for rate-limiting unauthenticated endpoints (register, login,
 * password reset, etc.) where there's no userId yet to key on. Railway sits behind a proxy,
 * so the real client IP arrives via `x-forwarded-for` (first entry in the chain).
 */
export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}
