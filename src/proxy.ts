import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkApiRateLimit, getRateLimitClientKey } from "@/lib/rateLimit";

export function proxy(request: NextRequest) {
	const clientKey = getRateLimitClientKey(request);
	const result = checkApiRateLimit(clientKey);

	if (!result.ok) {
		return NextResponse.json(
			{ error: "Too many requests" },
			{
				status: 429,
				headers: {
					"Retry-After": String(result.retryAfterSec),
				},
			}
		);
	}

	const res = NextResponse.next();
	res.headers.set("RateLimit-Remaining", String(result.remaining));
	res.headers.set("RateLimit-Reset", String(Math.ceil(result.resetMs / 1000)));
	return res;
}

export const config = {
	matcher: "/api/:path*",
};
