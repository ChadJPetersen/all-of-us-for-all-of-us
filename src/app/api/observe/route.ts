import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_TYPES = ["search", "click", "page_view"] as const;
const MAX_PAYLOAD_LENGTH = 2000;
const MAX_SESSION_ID_LENGTH = 64;

/**
 * POST /api/observe
 * Body: { type: 'search' | 'click' | 'page_view', payload: object, session_id?: string }
 * Stores an observation event in D1. Safe for Cloudflare edge.
 */
export async function POST(request: NextRequest) {
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const type = body.type as string | undefined;
		if (!type || !ALLOWED_TYPES.includes(type as (typeof ALLOWED_TYPES)[number])) {
			return NextResponse.json({ error: "Invalid type" }, { status: 400 });
		}

		let payload: string;
		if (body.payload != null && typeof body.payload === "object") {
			payload = JSON.stringify(body.payload);
		} else {
			payload = "{}";
		}
		if (payload.length > MAX_PAYLOAD_LENGTH) {
			payload = payload.slice(0, MAX_PAYLOAD_LENGTH) + '"}';
		}

		let sessionId: string | null = null;
		if (typeof body.session_id === "string" && body.session_id.length > 0) {
			sessionId = body.session_id.slice(0, MAX_SESSION_ID_LENGTH);
		}

		const db = getDb();
		try {
			await db
				.prepare(
					"INSERT INTO observations (type, payload, session_id) VALUES (?, ?, ?)"
				)
				.bind(type, payload, sessionId)
				.run();
		} catch (dbErr) {
			// Table may not exist yet (migration not applied); log but don't break the app
			console.warn("observe insert failed (run migrations?):", dbErr);
		}
		return new NextResponse(null, { status: 204 });
	} catch (err) {
		console.error("observe API error:", err);
		return NextResponse.json(
			{ error: "Failed to record observation" },
			{ status: 500 }
		);
	}
}
