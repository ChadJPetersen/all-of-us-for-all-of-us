import { getDb } from "@/lib/db";
import { rowToVolunteerOpportunity } from "@/lib/organizations";
import type { VolunteerOpportunity, VolunteerOpportunityWithOrg } from "@/lib/types";
import { parseLimitParam, parseOffsetParam } from "@/lib/pagination";
import {
	requirePositiveInt,
	requireNonEmptyString,
	parseOptionalString,
	parseOptionalPositiveInt,
	parseOptionalUrl,
	parseOptionalIsoDate,
	validateOptionalIsoDate,
	parseOptionalSlots,
	validateSlotDatetimes,
} from "@/lib/validation";
import { isoToUtcAndOffset, utcAndOffsetToIso } from "@/lib/format";
import { requireAddHumanSession } from "@/lib/humanVerify";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/volunteer-opportunities
 * Returns all volunteer opportunities with org, location, schedule/role refs, and slots.
 * By default only current/future opportunities are returned. Use include_past=1 to show past.
 * Query: schedule_type_id?, due_before?, include_past=1?, sort=next_start|due_date|created
 */
export async function GET(request: NextRequest) {
	try {
		const db = getDb();
		const { searchParams } = new URL(request.url);
		const scheduleTypeId = parseOptionalPositiveInt(
			Object.fromEntries(searchParams.entries()) as Record<string, unknown>,
			"schedule_type_id"
		);
		const dueBefore = parseOptionalString(
			Object.fromEntries(searchParams.entries()) as Record<string, unknown>,
			"due_before"
		);
		// Default: only current/future. Set include_past=1 to include past opportunities.
		const includePast = searchParams.get("include_past") === "1";
		const upcoming = !includePast;
		const sort =
			searchParams.get("sort") === "due_date"
				? "due_date"
				: searchParams.get("sort") === "next_start"
					? "next_start"
					: "created";
		const limit = parseLimitParam(searchParams.get("limit"));
		const offset = parseOffsetParam(searchParams.get("offset"));

		let rows: Record<string, unknown>[];
		let slotsByVoId = new Map<number, { id: number; volunteer_opportunity_id: number; start_at_utc: number; start_at_offset_minutes: number | null; end_at_utc: number | null; end_at_offset_minutes: number | null }[]>();
		let total_count = 0;

		const whereParts: string[] = [];
		const params: (number | string)[] = [];

		const currentFutureWhere = upcoming
			? ` (
				(vo.start_at_utc IS NULL OR vo.start_at_utc >= strftime('%s', 'now'))
				OR (vo.due_date IS NOT NULL AND vo.due_date >= date('now'))
				OR (vo.window_end_date IS NOT NULL AND vo.window_end_date >= date('now'))
				OR EXISTS (SELECT 1 FROM volunteer_opportunity_slots s WHERE s.volunteer_opportunity_id = vo.id AND s.start_at_utc >= strftime('%s', 'now'))
			)`
			: "";
		if (currentFutureWhere) {
			whereParts.push(currentFutureWhere);
		}
		if (scheduleTypeId != null) {
			whereParts.push("vo.schedule_type_id = ?");
			params.push(scheduleTypeId);
		}
		if (dueBefore) {
			whereParts.push("vo.due_date IS NOT NULL AND vo.due_date <= ?");
			params.push(dueBefore);
		}
		const whereClause = whereParts.length > 0 ? ` WHERE ${whereParts.join(" AND ")}` : "";
		const orderBy =
			sort === "due_date"
				? "vo.due_date ASC, vo.created_at_utc DESC"
				: "lt.sort_order ASC, vo.created_at_utc DESC";
		// next_start sort requires in-memory sort by next slot start, so we load all matching rows and paginate in JS
		const paginateInSql = sort !== "next_start";
		const limitParam = paginateInSql ? limit : 999999;
		const offsetParam = paginateInSql ? offset : 0;

		try {
			if (paginateInSql) {
				const countResult = await db
					.prepare(
						`SELECT COUNT(*) AS c FROM volunteer_opportunities vo
						 JOIN organizations g ON g.id = vo.organization_id
						 JOIN location_types lt ON lt.id = g.location_type_id ${whereClause}`
					)
					.bind(...params)
					.first();
				total_count = (countResult as { c: number })?.c ?? 0;
			}

			const stmt = db.prepare(`
				SELECT
					vo.id, vo.organization_id, vo.title, vo.description, vo.link,
					vo.schedule_type_id, vo.role_type_id, vo.start_at_utc, vo.start_at_offset_minutes, vo.end_at_utc, vo.end_at_offset_minutes, vo.due_date,
					vo.is_recurring, vo.recurrence_description, vo.window_start_date, vo.window_end_date,
					vo.volunteers_needed, vo.location_override, vo.created_at_utc, vo.created_at_offset_minutes, vo.updated_at_utc, vo.updated_at_offset_minutes,
					g.name AS organization_name,
					lt.label AS location_type_label,
					lt.sort_order AS location_type_sort_order,
					st.id AS st_id, st.label AS st_label, st.sort_order AS st_sort_order,
					vrt.id AS vrt_id, vrt.label AS vrt_label
				FROM volunteer_opportunities vo
				JOIN organizations g ON g.id = vo.organization_id
				JOIN location_types lt ON lt.id = g.location_type_id
				LEFT JOIN schedule_types st ON st.id = vo.schedule_type_id
				LEFT JOIN volunteer_role_types vrt ON vrt.id = vo.role_type_id
				${whereClause}
				ORDER BY ${orderBy}
				LIMIT ? OFFSET ?
			`);
			const result = await stmt.bind(...params, limitParam, offsetParam).all();
			rows = (result.results ?? []) as Record<string, unknown>[];
		} catch {
			// Legacy DB without new columns: use minimal SELECT
			whereParts.length = 0;
			params.length = 0;
			if (currentFutureWhere) whereParts.push(currentFutureWhere);
			if (scheduleTypeId != null) {
				whereParts.push("vo.schedule_type_id = ?");
				params.push(scheduleTypeId);
			}
			if (dueBefore) {
				whereParts.push("vo.due_date IS NOT NULL AND vo.due_date <= ?");
				params.push(dueBefore);
			}
			const whereClauseLegacy = whereParts.length > 0 ? ` WHERE ${whereParts.join(" AND ")}` : "";

			if (paginateInSql) {
				const countResult = await db
					.prepare(
						`SELECT COUNT(*) AS c FROM volunteer_opportunities vo
						 JOIN organizations g ON g.id = vo.organization_id
						 JOIN location_types lt ON lt.id = g.location_type_id ${whereClauseLegacy}`
					)
					.bind(...params)
					.first();
				total_count = (countResult as { c: number })?.c ?? 0;
			}

			const stmt = db.prepare(`
				SELECT
					vo.id, vo.organization_id, vo.title, vo.description, vo.link, vo.created_at_utc, vo.created_at_offset_minutes, vo.updated_at_utc, vo.updated_at_offset_minutes,
					g.name AS organization_name,
					lt.label AS location_type_label,
					lt.sort_order AS location_type_sort_order
				FROM volunteer_opportunities vo
				JOIN organizations g ON g.id = vo.organization_id
				JOIN location_types lt ON lt.id = g.location_type_id
				${whereClauseLegacy}
				ORDER BY lt.sort_order ASC, vo.created_at_utc DESC
				LIMIT ? OFFSET ?
			`);
			const result = await stmt.bind(...params, limitParam, offsetParam).all();
			rows = (result.results ?? []) as Record<string, unknown>[];
		}

		if (rows.length > 0 && rows[0].schedule_type_id !== undefined) {
			const voIds = rows.map((r) => r.id as number);
			const placeholders = voIds.map(() => "?").join(",");
			try {
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

		let opportunities: VolunteerOpportunityWithOrg[] = rows.map((row) => {
			const hasNewColumns = row.schedule_type_id !== undefined;
			const schedule_type_ref =
				hasNewColumns && row.st_id != null
					? { id: row.st_id as number, label: row.st_label as string, sort_order: row.st_sort_order as number }
					: null;
			const role_type_ref =
				hasNewColumns && row.vrt_id != null ? { id: row.vrt_id as number, label: row.vrt_label as string } : null;
			const rawSlots = hasNewColumns ? (slotsByVoId.get(row.id as number) ?? []) : [];
			const slots: { id: number; volunteer_opportunity_id: number; start_at: string; end_at: string | null }[] = rawSlots.map((s) => ({
				id: s.id,
				volunteer_opportunity_id: s.volunteer_opportunity_id,
				start_at: utcAndOffsetToIso(s.start_at_utc, s.start_at_offset_minutes ?? null),
				end_at: s.end_at_utc != null ? utcAndOffsetToIso(s.end_at_utc, s.end_at_offset_minutes ?? null) : null,
			}));
			return {
				id: row.id as number,
				organization_id: row.organization_id as number,
				organization_name: row.organization_name as string,
				location_type_label: row.location_type_label as string,
				location_type_sort_order: row.location_type_sort_order as number,
				title: row.title as string,
				description: (row.description as string) ?? null,
				link: (row.link as string) ?? null,
				schedule_type_id: hasNewColumns && row.schedule_type_id != null ? (row.schedule_type_id as number) : null,
				role_type_id: hasNewColumns && row.role_type_id != null ? (row.role_type_id as number) : null,
				start_at: (hasNewColumns && row.start_at_utc != null)
					? utcAndOffsetToIso(row.start_at_utc as number, (row.start_at_offset_minutes as number) ?? null)
					: ((row.start_at as string) ?? null),
				end_at: (hasNewColumns && row.end_at_utc != null)
					? utcAndOffsetToIso(row.end_at_utc as number, (row.end_at_offset_minutes as number) ?? null)
					: ((row.end_at as string) ?? null),
				due_date: (hasNewColumns && row.due_date) as string | null ?? null,
				is_recurring: hasNewColumns && row.is_recurring != null ? (row.is_recurring as number) : 0,
				recurrence_description: (hasNewColumns && row.recurrence_description) as string | null ?? null,
				window_start_date: (hasNewColumns && row.window_start_date) as string | null ?? null,
				window_end_date: (hasNewColumns && row.window_end_date) as string | null ?? null,
				volunteers_needed: hasNewColumns && row.volunteers_needed != null ? (row.volunteers_needed as number) : null,
				location_override: (hasNewColumns && row.location_override) as string | null ?? null,
				created_at: (row.created_at_utc != null
					? utcAndOffsetToIso(row.created_at_utc as number, (row.created_at_offset_minutes as number) ?? null)
					: row.created_at) as string,
				updated_at: (row.updated_at_utc != null
					? utcAndOffsetToIso(row.updated_at_utc as number, (row.updated_at_offset_minutes as number) ?? null)
					: row.updated_at) as string,
				...(schedule_type_ref && { schedule_type_ref }),
				...(role_type_ref && { role_type_ref }),
				...(slots.length > 0 && { slots }),
			};
		});

		if (scheduleTypeId != null) {
			opportunities = opportunities.filter((o) => o.schedule_type_id === scheduleTypeId);
		}
		if (dueBefore) {
			opportunities = opportunities.filter(
				(o) => o.due_date != null && o.due_date <= dueBefore
			);
		}
		if (upcoming) {
			const now = new Date().toISOString();
			const today = now.slice(0, 10);
			opportunities = opportunities.filter((o) => {
				// No dates set = ongoing, show
				if (!o.start_at && !o.due_date && !o.window_start_date && !o.window_end_date && (o.slots?.length ?? 0) === 0)
					return true;
				if (o.start_at && o.start_at >= now) return true;
				const slots = o.slots ?? [];
				if (slots.some((s) => s.start_at >= now)) return true;
				if (o.due_date && o.due_date >= today) return true;
				if (o.window_end_date && o.window_end_date >= today) return true;
				return false;
			});
		}
		if (sort === "due_date") {
			opportunities = [...opportunities].sort((a, b) => {
				const da = a.due_date ?? "9999-12-31";
				const db = b.due_date ?? "9999-12-31";
				return da.localeCompare(db);
			});
		} else if (sort === "next_start") {
			opportunities = [...opportunities].sort((a, b) => {
				const nextA = getNextStart(a);
				const nextB = getNextStart(b);
				return (nextA ?? "9999-12-31T23:59:59").localeCompare(nextB ?? "9999-12-31T23:59:59");
			});
		}

		if (!paginateInSql) {
			total_count = opportunities.length;
		}
		const paginated = paginateInSql ? opportunities : opportunities.slice(offset, offset + limit);

		return NextResponse.json({ opportunities: paginated, total_count });
	} catch (err) {
		console.error("volunteer-opportunities GET error:", err);
		return NextResponse.json(
			{ error: "Failed to fetch volunteer opportunities" },
			{ status: 500 }
		);
	}
}

function getNextStart(vo: VolunteerOpportunityWithOrg): string | null {
	if (vo.start_at) return vo.start_at;
	const slots = vo.slots ?? [];
	const now = new Date().toISOString();
	for (const s of slots) {
		if (s.start_at >= now) return s.start_at;
	}
	return slots[0]?.start_at ?? null;
}

/**
 * POST /api/volunteer-opportunities
 * Body: organization_id, title, description?, link?, schedule_type_id?, role_type_id?,
 *       start_at?, end_at?, due_date?, is_recurring?, recurrence_description?, window_start_date?, window_end_date?,
 *       volunteers_needed?, location_override?, slots? (array of { start_at, end_at? })
 */
export async function POST(request: NextRequest) {
	try {
		const humanBlock = requireAddHumanSession(request);
		if (humanBlock) return humanBlock;
		const body = (await request.json()) as Record<string, unknown>;
		const orgIdResult = requirePositiveInt(body, "organization_id", "Valid organization_id is required");
		if (orgIdResult.errorResponse) return orgIdResult.errorResponse;
		const organizationId = orgIdResult.value;

		const titleResult = requireNonEmptyString(body, "title", "Title is required");
		if (titleResult.errorResponse) return titleResult.errorResponse;
		const title = titleResult.value;

		const description = parseOptionalString(body, "description");
		const linkResult = parseOptionalUrl(body, "link", "Please enter a valid URL for the opportunity link");
		if (linkResult.errorResponse) return linkResult.errorResponse;
		const link = linkResult.value;

		const schedule_type_id = parseOptionalPositiveInt(body, "schedule_type_id");
		const role_type_id = parseOptionalPositiveInt(body, "role_type_id");
		// When provided, validate type IDs are in valid range (schedule_types 1-3, volunteer_role_types 1-5)
		if (schedule_type_id != null && (schedule_type_id < 1 || schedule_type_id > 3)) {
			return NextResponse.json(
				{ error: "Schedule type must be between 1 and 3" },
				{ status: 400 }
			);
		}
		if (role_type_id != null && (role_type_id < 1 || role_type_id > 5)) {
			return NextResponse.json(
				{ error: "Role type must be between 1 and 5" },
				{ status: 400 }
			);
		}
		const start_at = parseOptionalIsoDate(body, "start_at");
		const end_at = parseOptionalIsoDate(body, "end_at");
		const due_date = parseOptionalIsoDate(body, "due_date");
		const is_recurring = body.is_recurring === true || body.is_recurring === 1 ? 1 : 0;
		const recurrence_description = parseOptionalString(body, "recurrence_description");
		const window_start_date = parseOptionalIsoDate(body, "window_start_date");
		const window_end_date = parseOptionalIsoDate(body, "window_end_date");
		const dateMsg = "Use a valid date or date/time (e.g. 2025-02-20 or 2025-02-20T09:00:00)";
		for (const key of ["start_at", "end_at", "due_date", "window_start_date", "window_end_date"] as const) {
			const err = validateOptionalIsoDate(body, key, dateMsg);
			if (err) return err;
		}
		const startParsed = start_at ? isoToUtcAndOffset(start_at) : null;
		const endParsed = end_at ? isoToUtcAndOffset(end_at) : null;
		const volunteers_needed = parseOptionalPositiveInt(body, "volunteers_needed");
		const location_override = parseOptionalString(body, "location_override");
		const slots = parseOptionalSlots(body, "slots");
		const slotError = validateSlotDatetimes(slots);
		if (slotError) return slotError;

		const db = getDb();
		let lastId: number | undefined;
		try {
			const result = await db
				.prepare(
					`INSERT INTO volunteer_opportunities (
						organization_id, title, description, link,
						schedule_type_id, role_type_id, start_at_utc, start_at_offset_minutes, end_at_utc, end_at_offset_minutes, due_date,
						is_recurring, recurrence_description, window_start_date, window_end_date,
						volunteers_needed, location_override
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.bind(
					organizationId,
					title,
					description,
					link,
					schedule_type_id,
					role_type_id,
					startParsed?.utcSeconds ?? null,
					startParsed?.offsetMinutes ?? null,
					endParsed?.utcSeconds ?? null,
					endParsed?.offsetMinutes ?? null,
					due_date,
					is_recurring,
					recurrence_description,
					window_start_date,
					window_end_date,
					volunteers_needed,
					location_override
				)
				.run();
			lastId = (result as { meta?: { last_row_id?: number } }).meta?.last_row_id;
		} catch {
			const result = await db
				.prepare(
					`INSERT INTO volunteer_opportunities (organization_id, title, description, link) VALUES (?, ?, ?, ?)`
				)
				.bind(organizationId, title, description, link)
				.run();
			lastId = (result as { meta?: { last_row_id?: number } }).meta?.last_row_id;
		}

		if (lastId != null && slots.length > 0) {
			try {
				const insertSlot = db.prepare(
					`INSERT INTO volunteer_opportunity_slots (volunteer_opportunity_id, start_at_utc, start_at_offset_minutes, end_at_utc, end_at_offset_minutes) VALUES (?, ?, ?, ?, ?)`
				);
				for (const s of slots) {
					const startP = isoToUtcAndOffset(s.start_at);
					const endP = s.end_at ? isoToUtcAndOffset(s.end_at) : null;
					if (!startP) continue;
					await insertSlot.bind(lastId, startP.utcSeconds, startP.offsetMinutes ?? null, endP?.utcSeconds ?? null, endP?.offsetMinutes ?? null).run();
				}
			} catch {
				// slots table may not exist
			}
		}

		let row: Record<string, unknown> | null = null;
		if (lastId != null) {
			try {
				row = (await db
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
						 WHERE vo.id = ?`
					)
					.bind(lastId)
					.first()) as Record<string, unknown> | null;
			} catch {
				row = (await db
					.prepare("SELECT id, organization_id, title, description, link, created_at_utc, created_at_offset_minutes, updated_at_utc, updated_at_offset_minutes FROM volunteer_opportunities WHERE id = ?")
					.bind(lastId)
					.first()) as Record<string, unknown> | null;
			}
		}

		let opportunity: VolunteerOpportunity | null = null;
		if (row) {
			const r = row;
			const schedule_type_ref =
				r.st_id != null
					? { id: r.st_id as number, label: r.st_label as string, sort_order: r.st_sort_order as number }
					: null;
			const role_type_ref =
				r.vrt_id != null ? { id: r.vrt_id as number, label: r.vrt_label as string } : null;
			let slotList: { id: number; volunteer_opportunity_id: number; start_at_utc: number; start_at_offset_minutes: number | null; end_at_utc: number | null; end_at_offset_minutes: number | null }[] = [];
			if (lastId != null) {
				try {
					const slotRows = await db
						.prepare(
							"SELECT id, volunteer_opportunity_id, start_at_utc, start_at_offset_minutes, end_at_utc, end_at_offset_minutes FROM volunteer_opportunity_slots WHERE volunteer_opportunity_id = ? ORDER BY start_at_utc"
						)
						.bind(lastId)
						.all();
					slotList = (slotRows.results ?? []) as { id: number; volunteer_opportunity_id: number; start_at_utc: number; start_at_offset_minutes: number | null; end_at_utc: number | null; end_at_offset_minutes: number | null }[];
				} catch {
					// slots table may not exist
				}
			}
			opportunity = rowToVolunteerOpportunity(r, {
				schedule_type_ref: schedule_type_ref ?? undefined,
				role_type_ref: role_type_ref ?? undefined,
				slots: slotList.length ? slotList : undefined,
			});
		}

		return NextResponse.json({
			ok: true,
			volunteer_opportunity: opportunity,
		});
	} catch (err) {
		console.error("volunteer-opportunities POST error:", err);
		return NextResponse.json(
			{ error: "Failed to create volunteer opportunity" },
			{ status: 500 }
		);
	}
}
