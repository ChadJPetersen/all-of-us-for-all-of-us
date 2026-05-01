import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * DELETE /api/volunteer-opportunities/[id]
 * Deletes a volunteer opportunity by id. Cascades to volunteer_opportunity_slots.
 */
export async function DELETE(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id: idParam } = await params;
		const id = idParam != null ? parseInt(idParam, 10) : NaN;
		if (!Number.isInteger(id) || id < 1) {
			return NextResponse.json({ error: "Invalid volunteer opportunity id" }, { status: 400 });
		}

		const db = getDb();
		const result = await db
			.prepare("DELETE FROM volunteer_opportunities WHERE id = ?")
			.bind(id)
			.run();
		const changes = (result as { meta?: { changes?: number } }).meta?.changes ?? 0;
		if (changes === 0) {
			return NextResponse.json({ error: "Volunteer opportunity not found" }, { status: 404 });
		}
		return NextResponse.json({ ok: true });
	} catch (err) {
		console.error("volunteer-opportunities [id] DELETE error:", err);
		return NextResponse.json(
			{ error: "Failed to delete volunteer opportunity" },
			{ status: 500 }
		);
	}
}
