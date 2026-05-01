import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ADD_SESSION_COOKIE, TURNSTILE_TOKEN_HEADER } from "@/lib/humanVerifyConstants";
import { getRateLimitClientKey } from "@/lib/rateLimit";

export { ADD_SESSION_COOKIE, TURNSTILE_TOKEN_HEADER } from "@/lib/humanVerifyConstants";

export function humanVerificationEnabled(): boolean {
	return Boolean(
		process.env.TURNSTILE_SECRET_KEY?.trim() && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()
	);
}

function signingSecret(): string | undefined {
	return process.env.TURNSTILE_SECRET_KEY?.trim();
}

export function signAddSessionValue(): string {
	const secret = signingSecret();
	if (!secret) return "";
	const issuedAt = Date.now();
	const payload = String(issuedAt);
	const sig = createHmac("sha256", secret).update(payload).digest("hex");
	return `${payload}.${sig}`;
}

function timingSafeEqualHex(a: string, b: string): boolean {
	if (a.length !== b.length || a.length % 2 !== 0) return false;
	try {
		const ba = Buffer.from(a, "hex");
		const bb = Buffer.from(b, "hex");
		if (ba.length !== bb.length) return false;
		return timingSafeEqual(ba, bb);
	} catch {
		return false;
	}
}

export function hasValidAddSession(request: NextRequest): boolean {
	if (!humanVerificationEnabled()) return true;
	const secret = signingSecret();
	if (!secret) return true;
	const raw = request.cookies.get(ADD_SESSION_COOKIE)?.value;
	if (!raw) return false;
	const dot = raw.indexOf(".");
	if (dot <= 0) return false;
	const payload = raw.slice(0, dot);
	const sig = raw.slice(dot + 1);
	if (!/^\d{10,15}$/.test(payload)) return false;
	const expected = createHmac("sha256", secret).update(payload).digest("hex");
	return timingSafeEqualHex(expected, sig);
}

export async function verifyTurnstileResponse(
	token: string | undefined,
	remoteIp: string | undefined
): Promise<boolean> {
	const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
	if (!secret) return true;
	const t = token?.trim();
	if (!t) return false;

	const body = new URLSearchParams();
	body.set("secret", secret);
	body.set("response", t);
	if (remoteIp && remoteIp !== "unknown") {
		body.set("remoteip", remoteIp);
	}

	const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: body.toString(),
	});
	if (!res.ok) return false;
	const data = (await res.json()) as { success?: boolean };
	return data.success === true;
}

export function clientIpForTurnstile(request: NextRequest): string | undefined {
	const key = getRateLimitClientKey(request);
	return key === "unknown" ? undefined : key;
}

/** If verification is required and cookie is missing/invalid, return 403 JSON. */
export function requireAddHumanSession(request: NextRequest): NextResponse | null {
	if (!humanVerificationEnabled()) return null;
	if (hasValidAddSession(request)) return null;
	return NextResponse.json(
		{ error: "Human verification required before adding content.", code: "HUMAN_REQUIRED" },
		{ status: 403 }
	);
}

/** If verification is required, validate a one-time Turnstile token on every delete. */
export async function requireDeleteHumanVerification(
	request: NextRequest
): Promise<NextResponse | null> {
	if (!humanVerificationEnabled()) return null;
	const token = request.headers.get(TURNSTILE_TOKEN_HEADER);
	const ip = clientIpForTurnstile(request);
	const ok = await verifyTurnstileResponse(token ?? undefined, ip);
	if (ok) return null;
	return NextResponse.json(
		{ error: "Human verification required to delete.", code: "HUMAN_REQUIRED" },
		{ status: 403 }
	);
}

export function addSessionCookieOptions(): {
	httpOnly: boolean;
	secure: boolean;
	sameSite: "lax";
	path: string;
} {
	return {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
	};
}
