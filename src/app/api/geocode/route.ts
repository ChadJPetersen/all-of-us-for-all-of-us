import { NOMINATIM_USER_AGENT } from "@/lib/geo";
import { NextRequest, NextResponse } from "next/server";

async function fetchNominatim(address: string): Promise<Response> {
	const url = new URL("https://nominatim.openstreetmap.org/search");
	url.searchParams.set("q", address);
	url.searchParams.set("format", "json");
	url.searchParams.set("limit", "1");
	return fetch(url.toString(), {
		headers: { "User-Agent": NOMINATIM_USER_AGENT },
	});
}

/**
 * GET /api/geocode?address=...
 * Geocodes an address using OpenStreetMap Nominatim and returns { lat, lng }.
 * Used to backfill latitude/longitude from an organization address.
 * Nominatim allows ~1 req/s; we retry once on rate limit or temporary errors.
 */
export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const address = searchParams.get("address")?.trim();
		if (!address) {
			return NextResponse.json(
				{ error: "address query parameter is required" },
				{ status: 400 }
			);
		}

		let res = await fetchNominatim(address);
		const retryable = [429, 502, 503].includes(res.status);
		if (!res.ok && retryable) {
			await new Promise((r) => setTimeout(r, 1500));
			res = await fetchNominatim(address);
		}

		if (!res.ok) {
			const message =
				res.status === 429
					? "Too many requests; please wait a moment and try again."
					: res.status >= 500
						? "Geocoding service temporarily unavailable; try again in a moment."
						: "Geocoding service unavailable.";
			return NextResponse.json(
				{ error: message },
				{ status: res.status === 429 ? 429 : 502 }
			);
		}
		const data = (await res.json()) as { lat: string; lon: string }[];
		if (!Array.isArray(data) || data.length === 0) {
			return NextResponse.json(
				{ error: "Address not found" },
				{ status: 404 }
			);
		}
		const first = data[0];
		const lat = parseFloat(first.lat);
		const lng = parseFloat(first.lon);
		if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
			return NextResponse.json(
				{ error: "Invalid geocode result" },
				{ status: 502 }
			);
		}
		return NextResponse.json({ lat, lng });
	} catch (err) {
		console.error("geocode API error:", err);
		return NextResponse.json(
			{ error: "Failed to geocode address" },
			{ status: 500 }
		);
	}
}
