import { getDb } from "@/lib/db";
import { utcAndOffsetToIso } from "@/lib/format";
import { distanceKm, zipToLatLng } from "@/lib/geo";
import {
	rowToOrgWithRefs,
	rowToVolunteerOpportunity,
	rowToOrganizationResource,
	SELECT_ORG_BASE,
} from "@/lib/organizations";
import { parseLimitParam, parseOffsetParam } from "@/lib/pagination";
import { slugify } from "@/lib/strings";
import {
	parseOptionalUrl,
	parseOptionalPhotoUrl,
	parseOptionalLat,
	parseOptionalLng,
	validateMaxLength,
	isValidUrl,
} from "@/lib/validation";
import type {
	OrganizationWithDistance,
	OrganizationWithVolunteerOpportunities,
	OrganizationResource,
	VolunteerOpportunity,
} from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

const MILES_TO_KM = 1.60934;

/**
 * GET /api/organizations
 * Query: lat, lng (optional) - user location for distance sorting.
 *        zip (optional) - US zip code; used to derive lat/lng if lat/lng not provided.
 *        radius_miles (optional) - when lat/lng or zip is set, only return organizations within this radius (miles).
 * Returns organizations with joined type/area refs, optionally sorted by distance (nearest first).
 */
export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const latParam = searchParams.get("lat");
		const lngParam = searchParams.get("lng");
		const zipParam = searchParams.get("zip");
		const radiusMilesParam = searchParams.get("radius_miles");
		const limit = parseLimitParam(searchParams.get("limit"));
		const offset = parseOffsetParam(searchParams.get("offset"));

		let userLat: number | null = null;
		let userLng: number | null = null;

		if (latParam != null && lngParam != null) {
			const lat = parseFloat(latParam);
			const lng = parseFloat(lngParam);
			if (Number.isFinite(lat) && Number.isFinite(lng)) {
				userLat = lat;
				userLng = lng;
			}
		}
		if ((userLat == null || userLng == null) && zipParam) {
			const zip5 = zipParam.trim().slice(0, 5).replace(/\D/g, "");
			const codeInt = zip5.length === 5 ? parseInt(zip5, 10) : NaN;
			if (Number.isFinite(codeInt) && codeInt >= 1000 && codeInt <= 99999) {
				try {
					const dbForZip = getDb();
					const row = (await dbForZip
						.prepare(
							"SELECT center_lat, center_lng FROM location_areas WHERE location_type = 2 AND code_int = ?"
						)
						.bind(codeInt)
						.first()) as { center_lat: number; center_lng: number } | null;
					if (row && Number.isFinite(row.center_lat) && Number.isFinite(row.center_lng)) {
						userLat = row.center_lat;
						userLng = row.center_lng;
					}
				} catch {
					// fall through to zipToLatLng
				}
			}
			if (userLat == null || userLng == null) {
				const coords = zipToLatLng(zipParam);
				if (coords) {
					userLat = coords.lat;
					userLng = coords.lng;
				}
			}
		}

		const radiusMiles =
			radiusMilesParam != null && radiusMilesParam !== ""
				? parseFloat(radiusMilesParam)
				: null;
		const radiusKm =
			radiusMiles != null && Number.isFinite(radiusMiles) && radiusMiles > 0
				? radiusMiles * MILES_TO_KM
				: null;

		const db = getDb();
		const hasLocation = userLat != null && userLng != null;

		let total_count: number;
		let paginatedOrgs: OrganizationWithDistance[];

		if (!hasLocation) {
			// No user location: paginate at DB level to avoid loading all orgs.
			total_count = ((await db.prepare("SELECT COUNT(*) AS c FROM organizations").first()) as { c: number })?.c ?? 0;
			const orderByLimitOffset = ` ORDER BY lt.sort_order DESC, g.id LIMIT ? OFFSET ?`;
			const stmt = db.prepare(`${SELECT_ORG_BASE}${orderByLimitOffset}`);
			const result = await stmt.bind(limit, offset).all();
			const rows = (result.results ?? []) as Record<string, unknown>[];
			paginatedOrgs = rows.map((row) => rowToOrgWithRefs(row));
		} else {
			// User location set: load all orgs to compute distance, filter by radius, then paginate (VOs/resources only for page).
			const stmt = db.prepare(`${SELECT_ORG_BASE} ORDER BY g.id`);
			const result = await stmt.all();
			const rows = (result.results ?? []) as Record<string, unknown>[];
			const organizations: OrganizationWithDistance[] = rows.map((row) => {
				const g = rowToOrgWithRefs(row);
				const effectiveLat =
					g.lat ??
					(row.la_center_lat != null && Number.isFinite(Number(row.la_center_lat))
						? Number(row.la_center_lat)
						: null);
				const effectiveLng =
					g.lng ??
					(row.la_center_lng != null && Number.isFinite(Number(row.la_center_lng))
						? Number(row.la_center_lng)
						: null);
				if (effectiveLat != null && effectiveLng != null) {
					g.distance_km = distanceKm(userLat!, userLng!, effectiveLat, effectiveLng);
				}
				return g;
			});

			organizations.sort((a, b) => {
				const aDist = a.distance_km;
				const bDist = b.distance_km;
				if (aDist != null && bDist != null) return aDist - bDist;
				if (aDist != null) return -1;
				if (bDist != null) return 1;
				const aCode = a.location_type_ref?.code ?? 0;
				const bCode = b.location_type_ref?.code ?? 0;
				return bCode - aCode;
			});

			let filtered = organizations;
			if (radiusKm != null) {
				filtered = organizations.filter(
					(o) => o.distance_km != null && o.distance_km <= radiusKm
				);
			}
			total_count = filtered.length;
			paginatedOrgs = filtered.slice(offset, offset + limit);
		}

		// By default only current/future volunteer opportunities. Set include_past_opportunities=1 to include past.
		const includePastOpportunities = searchParams.get("include_past_opportunities") === "1";
		const currentFutureVoWhere = includePastOpportunities
			? ""
			: ` AND (
(vo.start_at_utc IS NULL OR vo.start_at_utc >= strftime('%s', 'now'))
									OR (vo.due_date IS NOT NULL AND vo.due_date >= date('now'))
									OR (vo.window_end_date IS NOT NULL AND vo.window_end_date >= date('now'))
									OR EXISTS (SELECT 1 FROM volunteer_opportunity_slots s WHERE s.volunteer_opportunity_id = vo.id AND s.start_at_utc >= strftime('%s', 'now'))
			)`;

		const orgIds = paginatedOrgs.map((o) => o.id);
		const opportunitiesByOrg = new Map<number, VolunteerOpportunity[]>();
		const resourcesByOrg = new Map<number, OrganizationResource[]>();
		const contactsByOrg = new Map<number, { id: number; organization_id: number; entity_name: string; phone: string | null; email: string | null; contact_purpose: string; sort_order: number }[]>();

		const linksByOrg = new Map<number, { id: number; link: string; name?: string | null }[]>();
		if (orgIds.length > 0) {
			const placeholders = orgIds.map(() => "?").join(",");

			const [voResult, resResult, linksResult, contactsResult] = await Promise.all([
				// Volunteer opportunities (with schedule/role refs; fallback to legacy columns)
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
								 WHERE vo.organization_id IN (${placeholders})${currentFutureVoWhere} ORDER BY vo.created_at_utc DESC`
							)
							.bind(...orgIds)
							.all();
					} catch {
						return await db
							.prepare(
								`SELECT id, organization_id, title, description, link, created_at_utc, created_at_offset_minutes, updated_at_utc, updated_at_offset_minutes
								 FROM volunteer_opportunities WHERE organization_id IN (${placeholders}) ORDER BY created_at_utc DESC`
							)
							.bind(...orgIds)
							.all();
					}
				})(),
				// Organization resources
				(async () => {
					try {
						return await db
							.prepare(
								`SELECT r.id, r.organization_id, r.resource_type_id, r.title, r.description, r.link, r.created_at_utc, r.created_at_offset_minutes, r.updated_at_utc, r.updated_at_offset_minutes,
								        rt.label AS resource_type_label
								 FROM organization_resources r
								 JOIN resource_types rt ON rt.id = r.resource_type_id
								 WHERE r.organization_id IN (${placeholders}) ORDER BY r.created_at_utc DESC`
							)
							.bind(...orgIds)
							.all();
					} catch {
						return { results: [] };
					}
				})(),
				// Calendar links
				(async () => {
					try {
						return await db
							.prepare(
								`SELECT id, organization_id, link, name FROM organization_calendar_links
								 WHERE organization_id IN (${placeholders}) ORDER BY organization_id, sort_order, id`
							)
							.bind(...orgIds)
							.all();
					} catch {
						return { results: [] };
					}
				})(),
				// Organization contacts
				(async () => {
					try {
						return await db
							.prepare(
								`SELECT id, organization_id, entity_name, phone, email, contact_purpose, sort_order FROM organization_contacts
								 WHERE organization_id IN (${placeholders}) ORDER BY organization_id, sort_order, id`
							)
							.bind(...orgIds)
							.all();
					} catch {
						return { results: [] };
					}
				})(),
			]);

			const linkRows = (linksResult.results ?? []) as { id: number; organization_id: number; link: string; name?: string | null }[];
			for (const row of linkRows) {
				const list = linksByOrg.get(row.organization_id) ?? [];
				list.push({ id: row.id, link: row.link, name: row.name ?? null });
				linksByOrg.set(row.organization_id, list);
			}

			const contactRows = (contactsResult.results ?? []) as { id: number; organization_id: number; entity_name: string; phone: string | null; email: string | null; contact_purpose: string; sort_order: number }[];
			for (const row of contactRows) {
				const list = contactsByOrg.get(row.organization_id) ?? [];
				list.push({ ...row, phone: row.phone ?? null, email: row.email ?? null });
				contactsByOrg.set(row.organization_id, list);
			}

			const voRows = (voResult.results ?? []) as Record<string, unknown>[];
			const voIdsForSlots = voRows.map((r) => r.id as number);
			let slotsByVoId = new Map<number, { id: number; volunteer_opportunity_id: number; start_at_utc: number; start_at_offset_minutes: number | null; end_at_utc: number | null; end_at_offset_minutes: number | null }[]>();
			if (voIdsForSlots.length > 0 && voRows[0]?.schedule_type_id !== undefined) {
				try {
					const slotPlaceholders = voIdsForSlots.map(() => "?").join(",");
					const slotsResult = await db
						.prepare(
							`SELECT id, volunteer_opportunity_id, start_at_utc, start_at_offset_minutes, end_at_utc, end_at_offset_minutes FROM volunteer_opportunity_slots WHERE volunteer_opportunity_id IN (${slotPlaceholders}) ORDER BY start_at_utc`
						)
						.bind(...voIdsForSlots)
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
			for (const row of voRows) {
				const hasNew = row.schedule_type_id !== undefined;
				const schedule_type_ref =
					hasNew && row.st_id != null
						? { id: row.st_id as number, label: row.st_label as string, sort_order: row.st_sort_order as number }
						: null;
				const role_type_ref =
					hasNew && row.vrt_id != null ? { id: row.vrt_id as number, label: row.vrt_label as string } : null;
				const slots = hasNew ? (slotsByVoId.get(row.id as number) ?? []) : [];
				const vo = rowToVolunteerOpportunity(row, {
					schedule_type_ref: schedule_type_ref ?? undefined,
					role_type_ref: role_type_ref ?? undefined,
					slots: slots.length ? (slots as Parameters<typeof rowToVolunteerOpportunity>[1] extends { slots?: infer S } ? S : never) : undefined,
				});
				const list = opportunitiesByOrg.get(vo.organization_id) ?? [];
				list.push(vo);
				opportunitiesByOrg.set(vo.organization_id, list);
			}

			const resRows = (resResult.results ?? []) as Record<string, unknown>[];
			for (const row of resRows) {
				const res = rowToOrganizationResource(row);
				const list = resourcesByOrg.get(res.organization_id) ?? [];
				list.push(res);
				resourcesByOrg.set(res.organization_id, list);
			}
		}

		const organizationsWithVo: OrganizationWithVolunteerOpportunities[] = paginatedOrgs.map((o) => ({
			...o,
			calendar_links: linksByOrg.get(o.id) ?? [],
			volunteer_opportunities: opportunitiesByOrg.get(o.id) ?? [],
			resources: resourcesByOrg.get(o.id) ?? [],
			contacts: contactsByOrg.get(o.id) ?? [],
		}));

		return NextResponse.json({ organizations: organizationsWithVo, total_count });
	} catch (err) {
		console.error("organizations API error:", err);
		return NextResponse.json(
			{ error: "Failed to fetch organizations" },
			{ status: 500 }
		);
	}
}

/**
 * POST /api/organizations
 * Body: name, location_type_id, slug?, primary_type_id?, location_area_id?, parent_id?, address?, lat?, lng?, calendar_links?
 * Creates an organization. Slug is optional (derived from name if empty). calendar_links is an array of URLs.
 */
export async function POST(request: NextRequest) {
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const name = typeof body.name === "string" ? body.name.trim() : "";
		if (!name) {
			return NextResponse.json(
				{ error: "Name is required" },
				{ status: 400 }
			);
		}
		const nameLenErr = validateMaxLength(name, 500, "Name");
		if (nameLenErr) return nameLenErr;

		const description =
			typeof body.description === "string" ? body.description.trim() : "";
		if (!description) {
			return NextResponse.json(
				{ error: "Description is required" },
				{ status: 400 }
			);
		}
		const descLenErr = validateMaxLength(description, 10000, "Description");
		if (descLenErr) return descLenErr;

		const photoUrlResult = parseOptionalPhotoUrl(body, "photo_url", "Photo URL must be a valid URL (e.g. https://…) or an uploaded image.");
		if (photoUrlResult.errorResponse) return photoUrlResult.errorResponse;
		const photoUrl = photoUrlResult.value;

		const locationTypeId =
			typeof body.location_type_id === "number" &&
			Number.isInteger(body.location_type_id)
				? body.location_type_id
				: null;
		if (locationTypeId == null || locationTypeId < 1 || locationTypeId > 4) {
			return NextResponse.json(
				{ error: "Valid location_type_id is required (1–4)" },
				{ status: 400 }
			);
		}
		let slug: string | null =
			typeof body.slug === "string" && body.slug.trim()
				? slugify(body.slug.trim())
				: slugify(name);
		slug = (slug || "").trim().toLowerCase() || null;
		const primaryTypeId =
			body.primary_type_id != null && Number.isInteger(Number(body.primary_type_id))
				? Number(body.primary_type_id)
				: null;
		if (primaryTypeId != null && (primaryTypeId < 1 || primaryTypeId > 5)) {
			return NextResponse.json(
				{ error: "Primary type must be between 1 and 5" },
				{ status: 400 }
			);
		}
		const locationAreaId =
			body.location_area_id != null && Number.isInteger(Number(body.location_area_id))
				? Number(body.location_area_id)
				: null;
		const parentId =
			body.parent_id != null && Number.isInteger(Number(body.parent_id))
				? Number(body.parent_id)
				: null;
		const address =
			typeof body.address === "string" && body.address.trim()
				? body.address.trim()
				: null;
		const lat = parseOptionalLat(body, "lat");
		const lng = parseOptionalLng(body, "lng");
		if (body.lat != null && body.lat !== "" && lat === null) {
			return NextResponse.json(
				{ error: "Latitude must be between -90 and 90" },
				{ status: 400 }
			);
		}
		if (body.lng != null && body.lng !== "" && lng === null) {
			return NextResponse.json(
				{ error: "Longitude must be between -180 and 180" },
				{ status: 400 }
			);
		}
		const rawLinks = Array.isArray(body.calendar_links) ? body.calendar_links : [];
		const calendarLinks: string[] = [];
		for (let i = 0; i < rawLinks.length; i++) {
			const l = rawLinks[i];
			const s = typeof l === "string" ? l.trim() : "";
			if (!s) continue;
			if (!isValidUrl(s)) {
				return NextResponse.json(
					{ error: `Calendar link ${i + 1} must be a valid URL (e.g. https://… or webcal://…)` },
					{ status: 400 }
				);
			}
			calendarLinks.push(s);
		}

		const db = getDb();
		const result = await db.prepare(`
			INSERT INTO organizations (name, slug, description, photo_url, primary_type_id, location_type_id, location_area_id, parent_id, address, lat, lng)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`)
			.bind(
				name,
				slug || null,
				description,
				photoUrl,
				primaryTypeId,
				locationTypeId,
				locationAreaId,
				parentId,
				address,
				lat,
				lng
			)
			.run();
		const lastId = (result as { meta?: { last_row_id?: number } }).meta?.last_row_id;
		if (lastId != null && calendarLinks.length > 0) {
			const insertLink = db.prepare(
				"INSERT INTO organization_calendar_links (organization_id, link, name, sort_order) VALUES (?, ?, ?, ?)"
			);
			for (let i = 0; i < calendarLinks.length; i++) {
				insertLink.bind(lastId, calendarLinks[i], null, i).run();
			}
		}
		const row =
			lastId != null
				? await db.prepare("SELECT id, name, slug, created_at_utc, created_at_offset_minutes FROM organizations WHERE id = ?").bind(lastId).first()
				: null;
		const orgRow = row as { id: number; name: string; slug: string | null; created_at_utc: number; created_at_offset_minutes: number | null } | null;
		return NextResponse.json({
			ok: true,
			organization: orgRow
				? {
						id: orgRow.id,
						name: orgRow.name,
						slug: orgRow.slug,
						created_at: utcAndOffsetToIso(orgRow.created_at_utc, orgRow.created_at_offset_minutes),
					}
				: null,
		});
	} catch (err) {
		console.error("organizations POST error:", err);
		return NextResponse.json(
			{ error: "Failed to create organization" },
			{ status: 500 }
		);
	}
}
