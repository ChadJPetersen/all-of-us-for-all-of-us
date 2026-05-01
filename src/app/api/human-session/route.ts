import { hasValidAddSession, humanVerificationEnabled } from "@/lib/humanVerify";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/human-session
 * Whether Turnstile is configured and whether this browser has a valid add-session cookie.
 */
export async function GET(request: NextRequest) {
	const enabled = humanVerificationEnabled();
	const addVerified = enabled ? hasValidAddSession(request) : false;
	return NextResponse.json({ enabled, addVerified });
}
