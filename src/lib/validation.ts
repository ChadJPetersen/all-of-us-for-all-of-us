import { NextResponse } from "next/server";

type Body = Record<string, unknown>;

/**
 * Parse a required positive integer from the request body.
 * Returns { value, errorResponse } — if errorResponse is set, return it from the route.
 */
export function requirePositiveInt(
	body: Body,
	key: string,
	message = `Valid ${key} is required`
): { value: number; errorResponse: null } | { value: null; errorResponse: NextResponse } {
	const raw = body[key];
	const n =
		raw != null && Number.isInteger(Number(raw)) ? Number(raw) : null;
	if (n == null || n < 1) {
		return {
			value: null,
			errorResponse: NextResponse.json({ error: message }, { status: 400 }),
		};
	}
	return { value: n, errorResponse: null };
}

/**
 * Parse a positive integer in an inclusive range from the request body.
 * Returns { value, errorResponse } — if errorResponse is set, return it from the route.
 */
export function requirePositiveIntInRange(
	body: Body,
	key: string,
	min: number,
	max: number,
	message = `Valid ${key} must be between ${min} and ${max}`
): { value: number; errorResponse: null } | { value: null; errorResponse: NextResponse } {
	const raw = body[key];
	const n =
		raw != null && Number.isInteger(Number(raw)) ? Number(raw) : null;
	if (n == null || n < min || n > max) {
		return {
			value: null,
			errorResponse: NextResponse.json({ error: message }, { status: 400 }),
		};
	}
	return { value: n, errorResponse: null };
}

/**
 * Parse an optional positive integer from the request body.
 * Returns the number or null if missing/invalid.
 */
export function parseOptionalPositiveInt(body: Body, key: string): number | null {
	const raw = body[key];
	const n =
		raw != null && Number.isInteger(Number(raw)) ? Number(raw) : null;
	return n != null && n >= 1 ? n : null;
}

/**
 * Parse a required non-empty string from the request body (trimmed).
 * Returns { value, errorResponse } — if errorResponse is set, return it from the route.
 */
export function requireNonEmptyString(
	body: Body,
	key: string,
	message = `${key} is required`
): { value: string; errorResponse: null } | { value: null; errorResponse: NextResponse } {
	const raw = body[key];
	const s = typeof raw === "string" ? raw.trim() : "";
	if (!s) {
		return {
			value: null,
			errorResponse: NextResponse.json({ error: message }, { status: 400 }),
		};
	}
	return { value: s, errorResponse: null };
}

/**
 * Parse an optional string from the request body (trimmed). Returns null if missing or empty.
 */
export function parseOptionalString(body: Body, key: string): string | null {
	const raw = body[key];
	if (typeof raw !== "string" || !raw.trim()) return null;
	return raw.trim();
}

/**
 * Returns true if the string is a valid URL (http, https, or webcal).
 */
export function isValidUrl(s: string): boolean {
	const t = s.trim();
	if (!t) return false;
	try {
		const toParse = t.toLowerCase().startsWith("webcal://") ? "https://" + t.slice(9) : t;
		const u = new URL(toParse);
		return u.protocol === "http:" || u.protocol === "https:";
	} catch {
		return false;
	}
}

/** Data URL pattern for images: data:image/<type>;base64,<data> */
const DATA_IMAGE_URL_PATTERN = /^data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+$/;

/**
 * Returns true if the string is a valid photo URL: http, https, webcal, a data URL (data:image/...;base64,...),
 * or a local path (e.g. /api/organization-photo/uuid.webp from uploads).
 */
export function isValidPhotoUrl(s: string): boolean {
	const t = s.trim();
	if (!t) return false;
	if (t.startsWith("data:")) return DATA_IMAGE_URL_PATTERN.test(t);
	// Local path from uploads (e.g. /api/organization-photo/<id>.<ext>)
	if (t.startsWith("/") && !t.includes("//")) return true;
	return isValidUrl(t);
}

/**
 * Parse an optional URL from the request body. If present and non-empty, must be valid (http/https/webcal).
 * Returns { value, errorResponse }; errorResponse only when value was provided but invalid.
 */
export function parseOptionalUrl(
	body: Body,
	key: string,
	message = "Please enter a valid URL (e.g. https://…)"
): { value: string | null; errorResponse: null } | { value: null; errorResponse: NextResponse } {
	const raw = body[key];
	if (raw == null || (typeof raw === "string" && !raw.trim())) {
		return { value: null, errorResponse: null };
	}
	const s = typeof raw === "string" ? raw.trim() : String(raw).trim();
	if (!s) return { value: null, errorResponse: null };
	if (!isValidUrl(s)) {
		return {
			value: null,
			errorResponse: NextResponse.json({ error: message }, { status: 400 }),
		};
	}
	return { value: s, errorResponse: null };
}

/**
 * Parse an optional photo URL from the request body. Accepts http/https/webcal or data:image/...;base64,...
 * Returns { value, errorResponse }; errorResponse only when value was provided but invalid.
 */
export function parseOptionalPhotoUrl(
	body: Body,
	key: string,
	message = "Photo URL must be a valid URL (e.g. https://…) or an uploaded image."
): { value: string | null; errorResponse: null } | { value: null; errorResponse: NextResponse } {
	const raw = body[key];
	if (raw == null || (typeof raw === "string" && !raw.trim())) {
		return { value: null, errorResponse: null };
	}
	const s = typeof raw === "string" ? raw.trim() : String(raw).trim();
	if (!s) return { value: null, errorResponse: null };
	if (!isValidPhotoUrl(s)) {
		return {
			value: null,
			errorResponse: NextResponse.json({ error: message }, { status: 400 }),
		};
	}
	return { value: s, errorResponse: null };
}

/**
 * Parse a required URL from the request body (http, https, or webcal). Returns { value, errorResponse }.
 */
export function requireUrl(
	body: Body,
	key: string,
	message = "Please enter a valid URL (e.g. https://…)"
): { value: string; errorResponse: null } | { value: null; errorResponse: NextResponse } {
	const raw = body[key];
	const s = typeof raw === "string" ? raw.trim() : "";
	if (!s) {
		return {
			value: null,
			errorResponse: NextResponse.json({ error: "URL is required" }, { status: 400 }),
		};
	}
	if (!isValidUrl(s)) {
		return {
			value: null,
			errorResponse: NextResponse.json({ error: message }, { status: 400 }),
		};
	}
	return { value: s, errorResponse: null };
}

/** Slug pattern: lowercase letters, numbers, hyphens only. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(s: string): boolean {
	const t = s.trim().toLowerCase();
	return t.length > 0 && SLUG_PATTERN.test(t);
}

/**
 * Parse optional latitude from body. If present, must be in [-90, 90]. Returns number or null.
 */
export function parseOptionalLat(body: Body, key: string): number | null {
	const raw = body[key];
	if (raw == null || raw === "") return null;
	const n = Number(raw);
	if (!Number.isFinite(n)) return null;
	if (n < -90 || n > 90) return null;
	return n;
}

/**
 * Parse optional longitude from body. If present, must be in [-180, 180]. Returns number or null.
 */
export function parseOptionalLng(body: Body, key: string): number | null {
	const raw = body[key];
	if (raw == null || raw === "") return null;
	const n = Number(raw);
	if (!Number.isFinite(n)) return null;
	if (n < -180 || n > 180) return null;
	return n;
}

function isIsoDateLike(s: string): boolean {
	const trimmed = s.trim();
	if (!trimmed) return false;
	const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
	const dateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;
	return dateOnly.test(trimmed) || dateTime.test(trimmed) || !Number.isNaN(Date.parse(trimmed));
}

/**
 * Validate that all slot start_at (and end_at when present) are valid ISO date/datetime.
 * Returns error response if any are invalid, else null.
 */
export function validateSlotDatetimes(
	slots: { start_at: string; end_at: string | null }[],
	message = "Each slot must have a valid start date/time (e.g. 2025-02-20T09:00:00)"
): NextResponse | null {
	for (const s of slots) {
		if (!isIsoDateLike(s.start_at)) {
			return NextResponse.json({ error: message }, { status: 400 });
		}
		if (s.end_at != null && s.end_at !== "" && !isIsoDateLike(s.end_at)) {
			return NextResponse.json(
				{ error: "Slot end date/time must be valid (e.g. 2025-02-20T17:00:00)" },
				{ status: 400 }
			);
		}
	}
	return null;
}

/**
 * Parse optional date/datetime string. If present, must be valid ISO date or datetime. Returns trimmed string or null.
 */
export function parseOptionalIsoDate(body: Body, key: string): string | null {
	const raw = body[key];
	if (typeof raw !== "string" || !raw.trim()) return null;
	const s = raw.trim();
	return isIsoDateLike(s) ? s : null;
}

/**
 * If body[key] is present and non-empty, it must be valid ISO date/datetime. Returns error response when invalid, else null.
 */
export function validateOptionalIsoDate(
	body: Body,
	key: string,
	message = "Date/time must be in a valid format (e.g. 2025-02-20 or 2025-02-20T09:00:00)"
): NextResponse | null {
	const raw = body[key];
	if (raw == null || (typeof raw === "string" && !raw.trim())) return null;
	const s = typeof raw === "string" ? raw.trim() : String(raw).trim();
	if (!s) return null;
	if (!isIsoDateLike(s)) {
		return NextResponse.json({ error: message }, { status: 400 });
	}
	return null;
}

/**
 * Validate optional string max length. Returns error response if over max, else null.
 */
export function validateMaxLength(
	value: string,
	max: number,
	fieldName: string,
	message?: string
): NextResponse | null {
	if (value.length <= max) return null;
	return NextResponse.json(
		{ error: message ?? `${fieldName} must be ${max} characters or fewer` },
		{ status: 400 }
	);
}

/**
 * Parse an optional array of objects with start_at (and optional end_at) for slots.
 * Returns array of { start_at: string, end_at: string | null } or empty array.
 */
export function parseOptionalSlots(body: Body, key: string): { start_at: string; end_at: string | null }[] {
	const raw = body[key];
	if (!Array.isArray(raw)) return [];
	return raw
		.filter((item): item is Record<string, unknown> => item != null && typeof item === "object")
		.map((item) => ({
			start_at: typeof item.start_at === "string" && item.start_at.trim() ? item.start_at.trim() : "",
			end_at: typeof item.end_at === "string" && item.end_at.trim() ? item.end_at.trim() : null,
		}))
		.filter((s) => s.start_at.length > 0);
}
