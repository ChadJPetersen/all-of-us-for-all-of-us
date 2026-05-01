/** Location scope: 0=global, 1=country, 2=state_province, 3=local (from location_types.code). */
export type LocationTypeCode = 0 | 1 | 2 | 3;

export interface LocationTypeRef {
	id: number;
	/** 0=global, 1=country, 2=state_province, 3=local */
	code: LocationTypeCode;
	label: string;
	sort_order: number;
}

export interface PrimaryTypeRef {
	id: number;
	/** Small integer code (0=community, 1=advocacy, etc.). */
	code: number;
	label: string;
	sort_order: number;
}

/** location_type: 0=country, 1=state_province, 2=local. code_int: country 1=US; state 1-51; local=zip number. */
export interface LocationAreaRef {
	id: number;
	location_type: 0 | 1 | 2;
	code_int: number;
	name: string;
	parent_id: number | null;
	/** Geo fence and center (optional in API response). */
	min_lat?: number;
	max_lat?: number;
	min_lng?: number;
	max_lng?: number;
	center_lat?: number;
	center_lng?: number;
}

export interface Organization {
	id: number;
	name: string;
	slug: string | null;
	/** Short description of the organization (required). */
	description: string;
	/** Optional photo/image URL for quilt square and display. */
	photo_url: string | null;
	/** FK to primary_types; resolved in API as primary_type_ref. */
	primary_type_id: number | null;
	/** FK to location_types; resolved in API as location_type_ref. */
	location_type_id: number;
	/** FK to location_areas (null for global); resolved in API as location_area_ref. */
	location_area_id: number | null;
	parent_id: number | null;
	/** Street address or place description for display and geocoding. */
	address: string | null;
	lat: number | null;
	lng: number | null;
	/** Optional iCal/ICS or web calendar URLs for shared calendar view. Each entry may have an optional display name. */
	calendar_links: { id: number; link: string; name?: string | null }[];
	created_at: string;
	updated_at: string;
}

/** As returned from API with joined type/area refs for display. */
export interface OrganizationWithRefs extends Organization {
	location_type_ref: LocationTypeRef | null;
	primary_type_ref: PrimaryTypeRef | null;
	location_area_ref: LocationAreaRef | null;
}

export interface OrganizationWithDistance extends OrganizationWithRefs {
	/** Distance in km from the user's location (null if no user location). */
	distance_km: number | null;
}

export interface VolunteerOpportunity {
	id: number;
	organization_id: number;
	title: string;
	description: string | null;
	link: string | null;
	/** FK to schedule_types; null = legacy/open-ended. */
	schedule_type_id: number | null;
	/** FK to volunteer_role_types. */
	role_type_id: number | null;
	/** Single slot: specific start (ISO datetime). */
	start_at: string | null;
	/** Single slot: specific end (ISO datetime). */
	end_at: string | null;
	/** Task "needed by" date (YYYY-MM-DD). */
	due_date: string | null;
	/** 1 = recurring. */
	is_recurring: number;
	/** e.g. "Every Tuesday 6–8pm". */
	recurrence_description: string | null;
	/** Flexible window start (YYYY-MM-DD). */
	window_start_date: string | null;
	/** Flexible window end (YYYY-MM-DD). */
	window_end_date: string | null;
	/** Number of volunteers needed (optional). */
	volunteers_needed: number | null;
	/** Address/place for this opportunity if different from org. */
	location_override: string | null;
	created_at: string;
	updated_at: string;
	/** Resolved refs when loaded with JOINs. */
	schedule_type_ref?: ScheduleTypeRef | null;
	role_type_ref?: VolunteerRoleTypeRef | null;
	/** Multiple slots (for set-shift with many times). */
	slots?: VolunteerOpportunitySlot[];
}

export interface ScheduleTypeRef {
	id: number;
	label: string;
	sort_order: number;
}

export interface VolunteerRoleTypeRef {
	id: number;
	label: string;
}

export interface VolunteerOpportunitySlot {
	id: number;
	volunteer_opportunity_id: number;
	/** ISO datetime. */
	start_at: string;
	/** ISO datetime, optional. */
	end_at: string | null;
}

export interface OrganizationWithVolunteerOpportunities extends OrganizationWithDistance {
	volunteer_opportunities: VolunteerOpportunity[];
	/** Present when API includes resources (e.g. organizations endpoint). */
	resources?: OrganizationResource[];
	/** Contact info: who to contact, phone/email, and what for. */
	contacts?: OrganizationContact[];
}

export interface ResourceTypeRef {
	id: number;
	label: string;
}

export interface OrganizationResource {
	id: number;
	organization_id: number;
	resource_type_id: number;
	resource_type_ref?: ResourceTypeRef | null;
	title: string;
	description: string | null;
	link: string | null;
	created_at: string;
	updated_at: string;
}

/** Contact entry for an organization: who to contact, how, and what for. */
export interface OrganizationContact {
	id: number;
	organization_id: number;
	entity_name: string;
	phone: string | null;
	email: string | null;
	contact_purpose: string;
	sort_order: number;
}

/** Convenience: location type code for sorting (higher = more local). */
export type LocationType = LocationTypeCode;

export interface UserLocation {
	lat: number;
	lng: number;
	/** Optional label, e.g. from zip lookup */
	label?: string;
}

/** Volunteer opportunity with org and location type info (e.g. /api/volunteer-opportunities). */
export interface VolunteerOpportunityWithOrg {
	id: number;
	organization_id: number;
	organization_name: string;
	location_type_label: string;
	location_type_sort_order: number;
	title: string;
	description: string | null;
	link: string | null;
	schedule_type_id: number | null;
	role_type_id: number | null;
	start_at: string | null;
	end_at: string | null;
	due_date: string | null;
	is_recurring: number;
	recurrence_description: string | null;
	window_start_date: string | null;
	window_end_date: string | null;
	volunteers_needed: number | null;
	location_override: string | null;
	created_at: string;
	updated_at: string;
	schedule_type_ref?: ScheduleTypeRef | null;
	role_type_ref?: VolunteerRoleTypeRef | null;
	slots?: VolunteerOpportunitySlot[];
}

/** Search result shapes (e.g. /api/search). */
export interface SearchOrganizationHit {
	type: "organization";
	id: number;
	name: string;
	slug: string | null;
	href: string;
}

export interface SearchCalendarHit {
	type: "calendar";
	id: number;
	name: string;
	calendar_links: { id: number; link: string; name?: string | null }[];
	href: string;
}

export interface SearchResourceHit {
	type: "resource";
	id: number;
	organization_id: number;
	organization_name: string;
	title: string;
	description: string | null;
	resource_type_label: string;
	href: string;
}

export interface SearchVolunteerHit {
	type: "volunteer";
	id: number;
	organization_id: number;
	organization_name: string;
	title: string;
	description: string | null;
	href: string;
}

export type SearchHit =
	| SearchOrganizationHit
	| SearchCalendarHit
	| SearchResourceHit
	| SearchVolunteerHit;
