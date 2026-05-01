import type { NextRequest } from "next/server";

const WINDOW_MS = 60_000;

/** Max API requests per IP per window in production. */
const LIMIT_PRODUCTION = 100;

/** Relaxed cap in development so local testing is not blocked. */
const LIMIT_DEVELOPMENT = 1000;

function limitForEnv(): number {
	return process.env.NODE_ENV === "development" ? LIMIT_DEVELOPMENT : LIMIT_PRODUCTION;
}

/**
 * Best-effort client identifier for rate limiting (Cloudflare sets cf-connecting-ip).
 * Falls back when running outside CF (e.g. plain Node or some proxies).
 */
export function getRateLimitClientKey(request: NextRequest): string {
	const cf = request.headers.get("cf-connecting-ip")?.trim();
	if (cf) return cf;

	const forwarded = request.headers.get("x-forwarded-for");
	if (forwarded) {
		const first = forwarded.split(",")[0]?.trim();
		if (first) return first;
	}

	const realIp = request.headers.get("x-real-ip")?.trim();
	if (realIp) return realIp;

	const vercelIp = request.headers.get("x-vercel-forwarded-for")?.trim();
	if (vercelIp) return vercelIp;

	return "unknown";
}

type WindowEntry = { windowStart: number; count: number };

const hits = new Map<string, WindowEntry>();

function pruneHits(now: number): void {
	const cutoff = now - 2 * WINDOW_MS;
	for (const [key, entry] of hits) {
		if (entry.windowStart < cutoff) {
			hits.delete(key);
		}
	}
}

export type RateLimitResult =
	| { ok: true; remaining: number; resetMs: number }
	| { ok: false; retryAfterSec: number };

/**
 * Fixed-window limiter keyed by client + time bucket. In-memory only (per runtime isolate).
 */
export function checkApiRateLimit(clientKey: string, now = Date.now()): RateLimitResult {
	const limit = limitForEnv();
	const windowStart = Math.floor(now / WINDOW_MS) * WINDOW_MS;
	const mapKey = `${clientKey}:${windowStart}`;
	const resetMs = windowStart + WINDOW_MS;

	let entry = hits.get(mapKey);
	if (!entry) {
		entry = { windowStart, count: 0 };
		hits.set(mapKey, entry);
	}

	if (entry.count >= limit) {
		const retryAfterSec = Math.max(1, Math.ceil((resetMs - now) / 1000));
		return { ok: false, retryAfterSec };
	}

	entry.count += 1;
	if (hits.size > 50_000) {
		pruneHits(now);
	}

	return { ok: true, remaining: Math.max(0, limit - entry.count), resetMs };
}
