import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * GET /api/form-options
 * Returns location_types, primary_types, location_areas, and organizations (for parent dropdown).
 */
export async function GET() {
	try {
		const db = getDb();

		const locationTypes = (
			await db.prepare(
				"SELECT id, label, sort_order FROM location_types ORDER BY sort_order"
			).all()
		).results as { id: number; label: string; sort_order: number }[];

		const primaryTypes = (
			await db.prepare(
				"SELECT id, label FROM primary_types ORDER BY label"
			).all()
		).results as { id: number; label: string }[];

		// Location areas are no longer loaded here (can be 90k+ rows). Use GET /api/location-areas?location_type=0|1|2 for lazy-load by type.

		const organizations = (
			await db.prepare(
				"SELECT id, name, slug FROM organizations ORDER BY name"
			).all()
		).results as { id: number; name: string; slug: string | null }[];

		let resourceTypes: { id: number; label: string }[] = [];
		try {
			resourceTypes = (
				await db.prepare(
					"SELECT id, label FROM resource_types ORDER BY label"
				).all()
			).results as { id: number; label: string }[];
		} catch {
			// resource_types table may not exist before initial schema (0000)
		}

		let scheduleTypes: { id: number; label: string; sort_order: number }[] = [];
		let volunteerRoleTypes: { id: number; label: string }[] = [];
		try {
			scheduleTypes = (
				await db.prepare(
					"SELECT id, label, sort_order FROM schedule_types ORDER BY sort_order"
				).all()
			).results as { id: number; label: string; sort_order: number }[];
			volunteerRoleTypes = (
				await db.prepare(
					"SELECT id, label FROM volunteer_role_types ORDER BY label"
				).all()
			).results as { id: number; label: string }[];
		} catch {
			// schedule_types / volunteer_role_types may not exist before initial schema (0000)
		}

		return NextResponse.json({
			locationTypes,
			primaryTypes,
			locationAreas: [], // Lazy-loaded via /api/location-areas?location_type=
			organizations,
			resourceTypes,
			scheduleTypes,
			volunteerRoleTypes,
		});
	} catch (err) {
		console.error("form-options API error:", err);
		return NextResponse.json(
			{ error: "Failed to fetch form options" },
			{ status: 500 }
		);
	}
}
