import { getDb } from "@/lib/db";
import {
	rowToOrgWithRefs,
	rowToVolunteerOpportunity,
	rowToOrganizationResource,
	SELECT_ORG_BASE,
	WHERE_ORG_ID,
	WHERE_ORG_SLUG,
} from "@/lib/organizations";
import { slugify } from "@/lib/strings";
import {
	parseOptionalUrl,
	parseOptionalPhotoUrl,
	parseOptionalLat,
	parseOptionalLng,
	validateMaxLength,
} from "@/lib/validation";
import type {
	OrganizationWithVolunteerOpportunities,
	VolunteerOpportunity,
	OrganizationResource,
} from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/organizations/[slug]
 * Returns a single organization by slug (or by id if the segment is numeric).
 * With calendar_links, volunteer_opportunities, and resources.
 * By default only current/future volunteer opportunities. Use ?include_past_opportunities=1 to include past.
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ slug: string }> }
) {
	try {
		const { slug: slugOrId } = await params;
		if (slugOrId == null || slugOrId === "") {
			return NextResponse.json({ error: "Invalid organization slug" }, { status: 400 });
		}

		const includePastOpportunities = new URL(request.url).searchParams.get("include_past_opportunities") === "1";
		const currentFutureVoWhere = includePastOpportunities
			? ""
			: ` AND (
				(vo.start_at_utc IS NULL OR vo.start_at_utc >= strftime('%s', 'now'))
				OR (vo.due_date IS NOT NULL AND vo.due_date >= date('now'))
				OR (vo.window_end_date IS NOT NULL AND vo.window_end_date >= date('now'))
				OR EXISTS (SELECT 1 FROM volunteer_opportunity_slots s WHERE s.volunteer_opportunity_id = vo.id AND s.start_at_utc >= strftime('%s', 'now'))
			)`;

		const db = getDb();
		const idByNumber = parseInt(slugOrId, 10);
		const isNumericId = Number.isInteger(idByNumber) && idByNumber >= 1;
		const normalizedSlug = slugOrId.trim().toLowerCase();

		const row = await (isNumericId
			? db.prepare(`${SELECT_ORG_BASE} WHERE ${WHERE_ORG_ID}`).bind(idByNumber)
			: db.prepare(`${SELECT_ORG_BASE} WHERE ${WHERE_ORG_SLUG}`).bind(normalizedSlug)
		).first();

		if (!row) {
			return NextResponse.json({ error: "Organization not found" }, { status: 404 });
		}

		const org = rowToOrgWithRefs(row as Record<string, unknown>);
		const id = org.id;

		const [linksResult, voResult, resResult, contactsResult] = await Promise.all([
			db
				.prepare(
					"SELECT id, link, name FROM organization_calendar_links WHERE organization_id = ? ORDER BY sort_order, id"
				)
				.bind(id)
				.all(),
			(async () => {
				try {
					return await db
						.prepare(
							`SELECT vo.id, vo.organization_id, vo.title, vo.description, vo.link,
								vo.schedule_type_id, vo.role_type_id, vo.start_at_utc, vo.start_at_offset_minutes, vo.end_at_utc, vo.end_at_offset_minutes, vo.due_date,
								vo.is_recurring, vo.recurrence_description, vo.window_start_date, vo.window_end_date,
								vo.volunteers_needed, vo.location_override, vo.created_at_utc, vo.created_at_offset_minutes, vo.updated_at_utc, vo.updated_at_offset_minutes,
								st.id AS st_id, st.label AS st_label, st.sort_order AS st_sort_order,
								vrt.id AS vrt_id, vrt.label AS vrt_label
							 FROM volunteer_opportunities vo
							 LEFT JOIN schedule_types st ON st.id = vo.schedule_type_id
							 LEFT JOIN volunteer_role_types vrt ON vrt.id = vo.role_type_id
							 WHERE vo.organization_id = ?${currentFutureVoWhere} ORDER BY vo.created_at_utc DESC`
						)
						.bind(id)
						.all();
				} catch {
					return await db
						.prepare(
							"SELECT id, organization_id, title, description, link, created_at_utc, created_at_offset_minutes, updated_at_utc, updated_at_offset_minutes FROM volunteer_opportunities WHERE organization_id = ? ORDER BY created_at_utc DESC"
						)
						.bind(id)
						.all();
				}
			})(),
			db
				.prepare(
					`SELECT r.id, r.organization_id, r.resource_type_id, r.title, r.description, r.link, r.created_at_utc, r.created_at_offset_minutes, r.updated_at_utc, r.updated_at_offset_minutes, rt.label AS resource_type_label
					 FROM organization_resources r
					 JOIN resource_types rt ON rt.id = r.resource_type_id
					 WHERE r.organization_id = ? ORDER BY r.created_at_utc DESC`
				)
				.bind(id)
				.all(),
			(async () => {
				try {
					return await db
						.prepare(
							"SELECT id, organization_id, entity_name, phone, email, contact_purpose, sort_order FROM organization_contacts WHERE organization_id = ? ORDER BY sort_order, id"
						)
						.bind(id)
						.all();
				} catch {
					return { results: [] };
				}
			})(),
		]);

		const calendar_links = ((linksResult.results ?? []) as { id: number; link: string; name?: string | null }[]).map(
			(r) => ({ id: r.id, link: r.link, name: r.name ?? null })
		);
		const voRows = (voResult.results ?? []) as Record<string, unknown>[];
		let slotsByVoId = new Map<number, { id: number; volunteer_opportunity_id: number; start_at_utc: number; start_at_offset_minutes: number | null; end_at_utc: number | null; end_at_offset_minutes: number | null }[]>();
		if (voRows.length > 0 && voRows[0].schedule_type_id !== undefined) {
			try {
				const voIds = voRows.map((r) => r.id as number);
				const placeholders = voIds.map(() => "?").join(",");
				const slotsResult = await db
					.prepare(
						`SELECT id, volunteer_opportunity_id, start_at_utc, start_at_offset_minutes, end_at_utc, end_at_offset_minutes FROM volunteer_opportunity_slots WHERE volunteer_opportunity_id IN (${placeholders}) ORDER BY start_at_utc`
					)
					.bind(...voIds)
					.all();
				const slotRows = (slotsResult.results ?? []) as { id: number; volunteer_opportunity_id: number; start_at_utc: number; start_at_offset_minutes: number | null; end_at_utc: number | null; end_at_offset_minutes: number | null }[];
				for (const s of slotRows) {
					const list = slotsByVoId.get(s.volunteer_opportunity_id) ?? [];
					list.push(s);
					slotsByVoId.set(s.volunteer_opportunity_id, list);
				}
			} catch {
				// slots table may not exist
			}
		}
		const volunteer_opportunities = voRows.map((r) => {
			const hasNew = r.schedule_type_id !== undefined;
			const schedule_type_ref =
				hasNew && r.st_id != null
					? { id: r.st_id as number, label: r.st_label as string, sort_order: r.st_sort_order as number }
					: null;
			const role_type_ref =
				hasNew && r.vrt_id != null ? { id: r.vrt_id as number, label: r.vrt_label as string } : null;
			const slots = hasNew ? (slotsByVoId.get(r.id as number) ?? []) : [];
			return rowToVolunteerOpportunity(r, {
				schedule_type_ref: schedule_type_ref ?? undefined,
				role_type_ref: role_type_ref ?? undefined,
				slots: slots.length ? slots : undefined,
			});
		}) as VolunteerOpportunity[];
		const resources = ((resResult.results ?? []) as Record<string, unknown>[]).map(
			(r) => rowToOrganizationResource(r)
		);
		const contacts = ((contactsResult.results ?? []) as { id: number; organization_id: number; entity_name: string; phone: string | null; email: string | null; contact_purpose: string; sort_order: number }[]).map(
			(r) => ({ id: r.id, organization_id: r.organization_id, entity_name: r.entity_name, phone: r.phone ?? null, email: r.email ?? null, contact_purpose: r.contact_purpose, sort_order: r.sort_order })
		);

		const out: OrganizationWithVolunteerOpportunities = {
			...org,
			calendar_links,
			volunteer_opportunities,
			resources,
			contacts,
		};

		return NextResponse.json(out);
	} catch (err) {
		console.error("organizations [slug] API error:", err);
		return NextResponse.json(
			{ error: "Failed to fetch organization" },
			{ status: 500 }
		);
	}
}

/**
 * PATCH /api/organizations/[slug]
 * Body: name?, slug?, primary_type_id?, location_type_id?, location_area_id?, parent_id?, address?, lat?, lng?
 * Updates an organization by slug or id. All fields optional; only provided fields are updated.
 */
export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ slug: string }> }
) {
	try {
		const { slug: slugOrId } = await params;
		if (slugOrId == null || slugOrId === "") {
			return NextResponse.json({ error: "Invalid organization slug" }, { status: 400 });
		}

		const db = getDb();
		const idByNumber = parseInt(slugOrId, 10);
		const isNumericId = Number.isInteger(idByNumber) && idByNumber >= 1;
		const normalizedSlug = slugOrId.trim().toLowerCase();

		const existing = await (isNumericId
			? db.prepare(`${SELECT_ORG_BASE} WHERE ${WHERE_ORG_ID}`).bind(idByNumber)
			: db.prepare(`${SELECT_ORG_BASE} WHERE ${WHERE_ORG_SLUG}`).bind(normalizedSlug)
		).first();

		if (!existing) {
			return NextResponse.json({ error: "Organization not found" }, { status: 404 });
		}

		const row = existing as Record<string, unknown>;
		const id = row.id as number;

		const body = (await request.json()) as Record<string, unknown>;

		const name =
			typeof body.name === "string" && body.name.trim()
				? body.name.trim()
				: (row.name as string);
		const nameLenErr = validateMaxLength(name, 500, "Name");
		if (nameLenErr) return nameLenErr;

		const locationTypeId =
			body.location_type_id != null && Number.isInteger(Number(body.location_type_id))
				? Number(body.location_type_id)
				: (row.location_type_id as number);
		if (locationTypeId < 1 || locationTypeId > 4) {
			return NextResponse.json(
				{ error: "Valid location_type_id is required (1–4)" },
				{ status: 400 }
			);
		}

		let slug: string;
		if (typeof body.slug === "string" && body.slug.trim()) {
			slug = slugify(body.slug.trim()).trim().toLowerCase() || slugify(name).trim().toLowerCase();
		} else {
			slug = (row.slug as string) ?? slugify(name).trim().toLowerCase();
		}
		if (!slug) {
			return NextResponse.json(
				{ error: "Slug cannot be empty" },
				{ status: 400 }
			);
		}

		// Slug must be unique (excluding this org)
		const slugTaken = await db
			.prepare("SELECT id FROM organizations WHERE slug = ? AND id != ?")
			.bind(slug, id)
			.first();
		if (slugTaken) {
			return NextResponse.json(
				{ error: "Another organization already uses this slug" },
				{ status: 400 }
			);
		}

		const primaryTypeId =
			body.primary_type_id !== undefined
				? (body.primary_type_id != null && Number.isInteger(Number(body.primary_type_id)) ? Number(body.primary_type_id) : null)
				: (row.primary_type_id as number | null);
		if (primaryTypeId != null && (primaryTypeId < 1 || primaryTypeId > 5)) {
			return NextResponse.json(
				{ error: "Primary type must be between 1 and 5" },
				{ status: 400 }
			);
		}
		const locationAreaId =
			body.location_area_id !== undefined
				? (body.location_area_id != null && Number.isInteger(Number(body.location_area_id)) ? Number(body.location_area_id) : null)
				: (row.location_area_id as number | null);
		let parentId: number | null =
			body.parent_id !== undefined
				? (body.parent_id != null && Number.isInteger(Number(body.parent_id)) ? Number(body.parent_id) : null)
				: (row.parent_id as number | null);
		if (parentId === id) {
			parentId = null; // avoid self-reference
		}
		const description =
			typeof body.description === "string"
				? body.description.trim()
				: (row.description as string) ?? "";
		if (!description) {
			return NextResponse.json(
				{ error: "Description is required" },
				{ status: 400 }
			);
		}
		const descLenErr = validateMaxLength(description, 10000, "Description");
		if (descLenErr) return descLenErr;

		const photoUrlResult = body.photo_url !== undefined
			? parseOptionalPhotoUrl(body, "photo_url", "Photo URL must be a valid URL (e.g. https://…) or an uploaded image.")
			: { value: row.photo_url as string | null, errorResponse: null as NextResponse | null };
		if (photoUrlResult.errorResponse) return photoUrlResult.errorResponse;
		const photoUrl = photoUrlResult.value;
		const address =
			typeof body.address === "string"
				? (body.address.trim() || null)
				: (row.address as string | null);
		const latFromBody = body.lat !== undefined ? parseOptionalLat(body, "lat") : undefined;
		const lngFromBody = body.lng !== undefined ? parseOptionalLng(body, "lng") : undefined;
		if (body.lat !== undefined && body.lat !== "" && latFromBody === null) {
			return NextResponse.json(
				{ error: "Latitude must be between -90 and 90" },
				{ status: 400 }
			);
		}
		if (body.lng !== undefined && body.lng !== "" && lngFromBody === null) {
			return NextResponse.json(
				{ error: "Longitude must be between -180 and 180" },
				{ status: 400 }
			);
		}
		const lat = latFromBody !== undefined ? latFromBody : (row.lat as number | null);
		const lng = lngFromBody !== undefined ? lngFromBody : (row.lng as number | null);

		await db
			.prepare(
				`UPDATE organizations SET
					name = ?, slug = ?, description = ?, photo_url = ?, primary_type_id = ?, location_type_id = ?, location_area_id = ?,
					parent_id = ?, address = ?, lat = ?, lng = ?, updated_at_utc = strftime('%s', 'now'), updated_at_offset_minutes = NULL
					WHERE id = ?`
			)
			.bind(
				name,
				slug,
				description,
				photoUrl,
				primaryTypeId,
				locationTypeId,
				locationAreaId,
				parentId,
				address,
				lat,
				lng,
				id
			)
			.run();

		const updated = await db
			.prepare(`${SELECT_ORG_BASE} WHERE ${WHERE_ORG_ID}`)
			.bind(id)
			.first();
		const out = rowToOrgWithRefs(updated as Record<string, unknown>);
		return NextResponse.json({ ok: true, organization: out });
	} catch (err) {
		console.error("organizations [slug] PATCH error:", err);
		return NextResponse.json(
			{ error: "Failed to update organization" },
			{ status: 500 }
		);
	}
}

/**
 * DELETE /api/organizations/[slug]
 * Deletes an organization by slug or id. Cascades to calendar links, resources, volunteer opportunities.
 */
export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ slug: string }> }
) {
	try {
		const { slug: slugOrId } = await params;
		if (slugOrId == null || slugOrId === "") {
			return NextResponse.json({ error: "Invalid organization slug" }, { status: 400 });
		}

		const db = getDb();
		const idByNumber = parseInt(slugOrId, 10);
		const isNumericId = Number.isInteger(idByNumber) && idByNumber >= 1;
		const normalizedSlug = slugOrId.trim().toLowerCase();

		const existing = await (isNumericId
			? db.prepare(`${SELECT_ORG_BASE} WHERE ${WHERE_ORG_ID}`).bind(idByNumber)
			: db.prepare(`${SELECT_ORG_BASE} WHERE ${WHERE_ORG_SLUG}`).bind(normalizedSlug)
		).first();

		if (!existing) {
			return NextResponse.json({ error: "Organization not found" }, { status: 404 });
		}

		const id = (existing as Record<string, unknown>).id as number;
		await db.prepare("DELETE FROM organizations WHERE id = ?").bind(id).run();

		return NextResponse.json({ ok: true });
	} catch (err) {
		console.error("organizations [slug] DELETE error:", err);
		return NextResponse.json(
			{ error: "Failed to delete organization" },
			{ status: 500 }
		);
	}
}
