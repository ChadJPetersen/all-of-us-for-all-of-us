import { getDb } from "@/lib/db";
import {
	requirePositiveInt,
	requireUrl,
} from "@/lib/validation";
import { requireAddHumanSession } from "@/lib/humanVerify";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/organization-calendar-links
 * Body: organization_id, link, name? (optional display name for the calendar)
 * Adds a calendar link to an organization.
 */
export async function POST(request: NextRequest) {
	try {
		const humanBlock = requireAddHumanSession(request);
		if (humanBlock) return humanBlock;
		const body = (await request.json()) as Record<string, unknown>;
		const orgIdResult = requirePositiveInt(body, "organization_id", "Valid organization_id is required");
		if (orgIdResult.errorResponse) return orgIdResult.errorResponse;
		const organizationId = orgIdResult.value;

		const linkResult = requireUrl(body, "link", "Please enter a valid calendar URL (e.g. https://… or webcal://…)");
		if (linkResult.errorResponse) return linkResult.errorResponse;
		const link = linkResult.value;

		const name =
			typeof body.name === "string" && body.name.trim()
				? body.name.trim()
				: null;

		const db = getDb();
		const maxOrder = (await db
			.prepare(
				"SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM organization_calendar_links WHERE organization_id = ?"
			)
			.bind(organizationId)
			.first()) as { next: number } | null;
		const sortOrder = maxOrder?.next ?? 0;

		await db
			.prepare(
				"INSERT INTO organization_calendar_links (organization_id, link, name, sort_order) VALUES (?, ?, ?, ?)"
			)
			.bind(organizationId, link, name, sortOrder)
			.run();

		return NextResponse.json({ ok: true });
	} catch (err) {
		console.error("organization-calendar-links POST error:", err);
		return NextResponse.json(
			{ error: "Failed to add calendar link" },
			{ status: 500 }
		);
	}
}
