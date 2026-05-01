import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/location-areas?location_type=0|1|2&q=optional_search
 * Returns location areas for the given type (0=country, 1=state_province, 2=local).
 * When q is provided (at least 1 character), results are filtered by name/code_int and limited to 100.
 */
export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const typeParam = searchParams.get("location_type");
		const locationType =
			typeParam != null && /^[012]$/.test(typeParam) ? parseInt(typeParam, 10) : null;
		if (locationType == null) {
			return NextResponse.json(
				{ error: "location_type query param required (0, 1, or 2)" },
				{ status: 400 }
			);
		}

		const q = searchParams.get("q")?.trim() ?? "";
		const hasQuery = q.length >= 1;

		const db = getDb();
		let result;
		// When q is empty we still limit rows to avoid transferring huge lists (e.g. 90k+ ZIPs for type 2).
		const maxRowsNoQuery = 2000;
		if (hasQuery) {
			const likeName = `%${q}%`;
			const likeCode = `${q}%`;
			result = await db
				.prepare(
					`SELECT id, location_type, code_int, name, parent_id FROM location_areas
					 WHERE location_type = ? AND (name LIKE ? OR CAST(code_int AS TEXT) LIKE ?)
					 ORDER BY name LIMIT 100`
				)
				.bind(locationType, likeName, likeCode)
				.all();
		} else {
			result = await db
				.prepare(
					`SELECT id, location_type, code_int, name, parent_id FROM location_areas
					 WHERE location_type = ? ORDER BY name LIMIT ?`
				)
				.bind(locationType, maxRowsNoQuery)
				.all();
		}

		const areas = (result.results ?? []) as {
			id: number;
			location_type: number;
			code_int: number;
			name: string;
			parent_id: number | null;
		}[];

		return NextResponse.json({ areas });
	} catch (err) {
		console.error("location-areas API error:", err);
		return NextResponse.json(
			{ error: "Failed to fetch location areas" },
			{ status: 500 }
		);
	}
}
