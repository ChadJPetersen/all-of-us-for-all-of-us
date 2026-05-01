import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * DELETE /api/organization-calendar-links/[id]
 * Deletes a calendar link by id.
 */
export async function DELETE(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id: idParam } = await params;
		const id = idParam != null ? parseInt(idParam, 10) : NaN;
		if (!Number.isInteger(id) || id < 1) {
			return NextResponse.json({ error: "Invalid calendar link id" }, { status: 400 });
		}

		const db = getDb();
		const result = await db
			.prepare("DELETE FROM organization_calendar_links WHERE id = ?")
			.bind(id)
			.run();
		const changes = (result as { meta?: { changes?: number } }).meta?.changes ?? 0;
		if (changes === 0) {
			return NextResponse.json({ error: "Calendar link not found" }, { status: 404 });
		}
		return NextResponse.json({ ok: true });
	} catch (err) {
		console.error("organization-calendar-links [id] DELETE error:", err);
		return NextResponse.json(
			{ error: "Failed to delete calendar link" },
			{ status: 500 }
		);
	}
}
