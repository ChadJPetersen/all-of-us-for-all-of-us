/** User-Agent for Nominatim (OpenStreetMap) requests. Required by usage policy. */
export const NOMINATIM_USER_AGENT = "AllOfUsForAllOfUs-Web/1.0 (community site)";

/**
 * Haversine distance in km between two lat/lng points.
 */
export function distanceKm(
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number
): number {
	const R = 6371; // Earth radius in km
	const dLat = toRad(lat2 - lat1);
	const dLng = toRad(lng2 - lng1);
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRad(lat1)) *
			Math.cos(toRad(lat2)) *
			Math.sin(dLng / 2) *
			Math.sin(dLng / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

function toRad(deg: number): number {
	return (deg * Math.PI) / 180;
}

/**
 * US ZIP code approximate center (for fallback when no geolocation).
 * Returns null for invalid/unknown zip; consider using a zip->latlng API for production.
 */
export function zipToLatLng(zip: string): { lat: number; lng: number } | null {
	const trimmed = zip.trim().replace(/\s+/g, "");
	if (!/^\d{5}(-\d{4})?$/.test(trimmed)) return null;
	// Use a simple US center as fallback; for real data use a lookup table or API.
	const z = parseInt(trimmed.slice(0, 5), 10);
	if (z < 1000 || z > 99999) return null;
	// Rough US bounds: 24-49 lat, -125 to -66 lng. Approximate linear mapping.
	const lat = 24 + (49 - 24) * ((z - 1000) / 98999);
	const lng = -125 + (59) * ((z - 1000) / 98999);
	return { lat, lng };
}
