import { utcAndOffsetToIso } from "@/lib/format";
import type {
	OrganizationWithDistance,
	OrganizationResource,
	VolunteerOpportunity,
	VolunteerOpportunitySlot,
	LocationAreaRef,
	LocationTypeRef,
	PrimaryTypeRef,
} from "@/lib/types";

/** Base SELECT for organizations with joined type/area refs (no WHERE clause). */
export const SELECT_ORG_BASE = `
	SELECT
		g.id, g.name, g.slug, g.description, g.photo_url, g.primary_type_id, g.location_type_id, g.location_area_id,
		g.parent_id, g.address, g.lat, g.lng,
		g.created_at_utc, g.created_at_offset_minutes, g.updated_at_utc, g.updated_at_offset_minutes,
		lt.id AS lt_id, lt.id AS lt_code, lt.label AS lt_label, lt.sort_order AS lt_sort_order,
		pt.id AS pt_id, pt.id AS pt_code, pt.label AS pt_label, 0 AS pt_sort_order,
		la.id AS la_id, la.location_type AS la_location_type, la.code_int AS la_code_int, la.name AS la_name, la.parent_id AS la_parent_id,
		la.center_lat AS la_center_lat, la.center_lng AS la_center_lng
	FROM organizations g
	LEFT JOIN location_types lt ON lt.id = g.location_type_id
	LEFT JOIN primary_types pt ON pt.id = g.primary_type_id
	LEFT JOIN location_areas la ON la.id = g.location_area_id
`;

/** WHERE clause for single org by id: use with SELECT_ORG_BASE + " WHERE " + WHERE_ORG_ID */
export const WHERE_ORG_ID = "g.id = ?";
/** WHERE clause for single org by slug: use with SELECT_ORG_BASE + " WHERE " + WHERE_ORG_SLUG */
export const WHERE_ORG_SLUG = "g.slug = ?";

export function rowToOrgWithRefs(row: Record<string, unknown>): OrganizationWithDistance {
	const location_type_ref: LocationTypeRef | null =
		row.lt_id != null
			? {
					id: row.lt_id as number,
					code: row.lt_code as LocationTypeRef["code"],
					label: row.lt_label as string,
					sort_order: row.lt_sort_order as number,
				}
			: null;

	const primary_type_ref: PrimaryTypeRef | null =
		row.pt_id != null
			? {
					id: row.pt_id as number,
					code: row.pt_code as number,
					label: row.pt_label as string,
					sort_order: row.pt_sort_order as number,
				}
			: null;

	const location_area_ref: LocationAreaRef | null =
		row.la_id != null
			? {
					id: row.la_id as number,
					location_type: row.la_location_type as LocationAreaRef["location_type"],
					code_int: row.la_code_int as number,
					name: row.la_name as string,
					parent_id: (row.la_parent_id as number) ?? null,
				}
			: null;

	return {
		id: row.id as number,
		name: row.name as string,
		slug: (row.slug as string) ?? null,
		description: (row.description as string) ?? "",
		photo_url: (row.photo_url as string) ?? null,
		primary_type_id: (row.primary_type_id as number) ?? null,
		location_type_id: row.location_type_id as number,
		location_area_id: (row.location_area_id as number) ?? null,
		parent_id: (row.parent_id as number) ?? null,
		address: (row.address as string) ?? null,
		lat: (row.lat as number) ?? null,
		lng: (row.lng as number) ?? null,
		calendar_links: [],
		created_at: row.created_at_utc != null
			? utcAndOffsetToIso(row.created_at_utc as number, (row.created_at_offset_minutes as number) ?? null)
			: (row.created_at as string),
		updated_at: row.updated_at_utc != null
			? utcAndOffsetToIso(row.updated_at_utc as number, (row.updated_at_offset_minutes as number) ?? null)
			: (row.updated_at as string),
		location_type_ref,
		primary_type_ref,
		location_area_ref,
		distance_km: null,
	};
}

export function rowToVolunteerOpportunity(
	row: Record<string, unknown>,
	opts?: {
		schedule_type_ref?: { id: number; label: string; sort_order: number } | null;
		role_type_ref?: { id: number; label: string } | null;
		slots?: (
			| { id: number; volunteer_opportunity_id: number; start_at: string; end_at: string | null }
			| { id: number; volunteer_opportunity_id: number; start_at_utc: number; start_at_offset_minutes: number | null; end_at_utc: number | null; end_at_offset_minutes: number | null }
		)[];
	}
): VolunteerOpportunity {
	const slotToIso = (s: { start_at_utc?: number; start_at_offset_minutes?: number | null; end_at_utc?: number | null; end_at_offset_minutes?: number | null; start_at?: string; end_at?: string | null }) =>
		s.start_at_utc != null
			? { start_at: utcAndOffsetToIso(s.start_at_utc, s.start_at_offset_minutes ?? null), end_at: s.end_at_utc != null ? utcAndOffsetToIso(s.end_at_utc, s.end_at_offset_minutes ?? null) : (s.end_at ?? null) }
			: { start_at: s.start_at as string, end_at: (s.end_at as string) ?? null };
	const slotsNormalized = opts?.slots?.map((s) => ({ ...s, ...slotToIso(s as Record<string, unknown>) })) ?? opts?.slots;
	const vo: VolunteerOpportunity = {
		id: row.id as number,
		organization_id: row.organization_id as number,
		title: row.title as string,
		description: (row.description as string) ?? null,
		link: (row.link as string) ?? null,
		schedule_type_id: row.schedule_type_id != null ? (row.schedule_type_id as number) : null,
		role_type_id: row.role_type_id != null ? (row.role_type_id as number) : null,
		start_at: row.start_at_utc != null
			? utcAndOffsetToIso(row.start_at_utc as number, (row.start_at_offset_minutes as number) ?? null)
			: ((row.start_at as string) ?? null),
		end_at: row.end_at_utc != null
			? utcAndOffsetToIso(row.end_at_utc as number, (row.end_at_offset_minutes as number) ?? null)
			: ((row.end_at as string) ?? null),
		due_date: (row.due_date as string) ?? null,
		is_recurring: row.is_recurring != null ? (row.is_recurring as number) : 0,
		recurrence_description: (row.recurrence_description as string) ?? null,
		window_start_date: (row.window_start_date as string) ?? null,
		window_end_date: (row.window_end_date as string) ?? null,
		volunteers_needed: row.volunteers_needed != null ? (row.volunteers_needed as number) : null,
		location_override: (row.location_override as string) ?? null,
		created_at: row.created_at_utc != null
			? utcAndOffsetToIso(row.created_at_utc as number, (row.created_at_offset_minutes as number) ?? null)
			: (row.created_at as string),
		updated_at: row.updated_at_utc != null
			? utcAndOffsetToIso(row.updated_at_utc as number, (row.updated_at_offset_minutes as number) ?? null)
			: (row.updated_at as string),
	};
	if (opts?.schedule_type_ref)
		vo.schedule_type_ref = opts.schedule_type_ref;
	if (opts?.role_type_ref)
		vo.role_type_ref = opts.role_type_ref;
	if (slotsNormalized?.length)
		vo.slots = slotsNormalized as VolunteerOpportunitySlot[];
	return vo;
}

export function rowToOrganizationResource(row: Record<string, unknown>): OrganizationResource {
	return {
		id: row.id as number,
		organization_id: row.organization_id as number,
		resource_type_id: row.resource_type_id as number,
		resource_type_ref:
			row.resource_type_id != null && row.resource_type_label != null
				? { id: row.resource_type_id as number, label: row.resource_type_label as string }
				: null,
		title: row.title as string,
		description: (row.description as string) ?? null,
		link: (row.link as string) ?? null,
		created_at: row.created_at_utc != null
			? utcAndOffsetToIso(row.created_at_utc as number, (row.created_at_offset_minutes as number) ?? null)
			: (row.created_at as string),
		updated_at: row.updated_at_utc != null
			? utcAndOffsetToIso(row.updated_at_utc as number, (row.updated_at_offset_minutes as number) ?? null)
			: (row.updated_at as string),
	};
}
