import {
	addSessionCookieOptions,
	clientIpForTurnstile,
	signAddSessionValue,
	verifyTurnstileResponse,
	humanVerificationEnabled,
} from "@/lib/humanVerify";
import { ADD_SESSION_COOKIE } from "@/lib/humanVerifyConstants";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/human-verify
 * Body: { token: string } — Turnstile response. Sets session cookie for add operations (once per browser session).
 */
export async function POST(request: NextRequest) {
	if (!humanVerificationEnabled()) {
		return NextResponse.json({ ok: true, skipped: true });
	}
	try {
		const body = (await request.json()) as { token?: string };
		const token = typeof body.token === "string" ? body.token : "";
		const ip = clientIpForTurnstile(request);
		const ok = await verifyTurnstileResponse(token, ip);
		if (!ok) {
			return NextResponse.json({ error: "Verification failed" }, { status: 400 });
		}
		const value = signAddSessionValue();
		const res = NextResponse.json({ ok: true });
		res.cookies.set(ADD_SESSION_COOKIE, value, addSessionCookieOptions());
		return res;
	} catch {
		return NextResponse.json({ error: "Invalid request" }, { status: 400 });
	}
}
