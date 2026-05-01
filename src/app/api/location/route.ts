import { getDb } from "@/lib/db";
import { NOMINATIM_USER_AGENT } from "@/lib/geo";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "a4a_location";
const MAX_AGE = 15 * 60; // 15 minutes

/** Reverse geocode lat/lng via Nominatim; returns postcode and short place name. */
async function reverseGeocode(
	lat: number,
	lng: number
): Promise<{ postcode?: string; placeName?: string } | null> {
	try {
		const url = new URL("https://nominatim.openstreetmap.org/reverse");
		url.searchParams.set("lat", String(lat));
		url.searchParams.set("lon", String(lng));
		url.searchParams.set("format", "jsonv2");
		url.searchParams.set("addressdetails", "1");
		const res = await fetch(url.toString(), {
			headers: {
				"User-Agent": NOMINATIM_USER_AGENT,
				Accept: "application/json",
			},
		});
		if (!res.ok) return null;
		const data = (await res.json()) as {
			address?: { postcode?: string; city?: string; town?: string; village?: string; state?: string; county?: string };
			display_name?: string;
		};
		const addr = data?.address;
		const postcode = addr?.postcode?.trim().replace(/\s+/g, "").slice(0, 10) ?? undefined;
		const city = addr?.city ?? addr?.town ?? addr?.village ?? addr?.county;
		const state = addr?.state;
		const placeName =
			city && state ? `${city}, ${state}` : data?.display_name ?? undefined;
		return { postcode: postcode || undefined, placeName: placeName || undefined };
	} catch {
		return null;
	}
}

/**
 * GET /api/location - read current location from cookie (for client hydration).
 */
export async function GET() {
	const cookieStore = await cookies();
	const value = cookieStore.get(COOKIE_NAME)?.value;
	if (!value) return NextResponse.json({ location: null });
	try {
		const location = JSON.parse(value) as {
			lat: number;
			lng: number;
			zip?: string;
			placeName?: string;
			radiusMiles?: number;
		};
		if (
			typeof location.lat === "number" &&
			typeof location.lng === "number" &&
			Number.isFinite(location.lat) &&
			Number.isFinite(location.lng)
		) {
			return NextResponse.json({ location });
		}
	} catch {
		// ignore
	}
	return NextResponse.json({ location: null });
}

/** Expected shape of POST body for /api/location */
type LocationBody = { zip?: string; lat?: number; lng?: number; radiusMiles?: number };

/**
 * POST /api/location - set user location (zip or lat/lng), stored in cookie.
 * Body: { zip?: string } | { lat: number, lng: number }
 */
export async function POST(request: NextRequest) {
	try {
		const body = (await request.json()) as LocationBody;
		let lat = NaN;
		let lng = NaN;
		let zip: string | undefined;
		let placeNameFromReverse: string | undefined;
		const radiusMiles =
			typeof body.radiusMiles === "number" && Number.isFinite(body.radiusMiles)
				? Math.max(1, Math.min(500, body.radiusMiles))
				: 50;

		if (typeof body.zip === "string" && body.zip.trim()) {
			const trimmed = body.zip.trim();
			const zip5 = trimmed.slice(0, 5).replace(/\D/g, "");
			const codeInt = zip5.length === 5 ? parseInt(zip5, 10) : NaN;

			// Prefer our DB (location_areas) for correct US ZIP → lat/lng and place name (e.g. Laramie Wyoming)
			if (Number.isFinite(codeInt) && codeInt >= 1000 && codeInt <= 99999) {
				try {
					const db = getDb();
					const row = (await db
						.prepare(
							`SELECT la.center_lat AS lat, la.center_lng AS lng, la.name, p.name AS state_name
							 FROM location_areas la
							 LEFT JOIN location_areas p ON p.id = la.parent_id
							 WHERE la.location_type = 2 AND la.code_int = ?`
						)
						.bind(codeInt)
						.first()) as { lat: number; lng: number; name: string; state_name: string | null } | null;
					if (row && Number.isFinite(row.lat) && Number.isFinite(row.lng)) {
						lat = row.lat;
						lng = row.lng;
						zip = trimmed;
						const city = (row.name ?? "").trim();
						const state = (row.state_name ?? "").trim();
						placeNameFromReverse =
							city && state ? `${city}, ${state}` : city || state || undefined;
					}
				} catch {
					// DB unavailable or query failed; fall through to geo + Nominatim
				}
			}

			// Fallback: formula in geo.ts + reverse geocode (can be wrong for high ZIPs, e.g. Ontario)
			if (placeNameFromReverse === undefined) {
				const { zipToLatLng } = await import("@/lib/geo");
				const coords = zipToLatLng(trimmed);
				if (!coords) {
					return NextResponse.json(
						{ error: "Invalid or unsupported ZIP code" },
						{ status: 400 }
					);
				}
				lat = coords.lat;
				lng = coords.lng;
				zip = trimmed;
				const reverse = await reverseGeocode(lat, lng);
				placeNameFromReverse = reverse?.placeName;
			}
		} else if (
			Number.isFinite(Number(body.lat)) &&
			Number.isFinite(Number(body.lng))
		) {
			lat = Number(body.lat);
			lng = Number(body.lng);
			const reverse = await reverseGeocode(lat, lng);
			if (reverse?.postcode) zip = reverse.postcode;
			placeNameFromReverse = reverse?.placeName;
		} else {
			return NextResponse.json(
				{ error: "Provide zip or lat/lng" },
				{ status: 400 }
			);
		}

		if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
			return NextResponse.json(
				{ error: "Provide zip or lat/lng" },
				{ status: 400 }
			);
		}

		const payload = JSON.stringify({
			lat,
			lng,
			...(zip && { zip }),
			...(placeNameFromReverse && { placeName: placeNameFromReverse }),
			radiusMiles,
		});
		const res = NextResponse.json({
			ok: true,
			...(zip && { zip }),
			...(placeNameFromReverse && { placeName: placeNameFromReverse }),
		});
		res.cookies.set(COOKIE_NAME, payload, {
			path: "/",
			maxAge: MAX_AGE,
			httpOnly: false,
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production",
		});
		return res;
	} catch {
		return NextResponse.json(
			{ error: "Invalid request body" },
			{ status: 400 }
		);
	}
}
