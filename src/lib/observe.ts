/**
 * Client-side observation helper. Sends events to POST /api/observe (D1).
 * Safe for Cloudflare; no cookies, minimal payload.
 */

const SESSION_KEY = "a4a_sid";

function getSessionId(): string | null {
	if (typeof window === "undefined") return null;
	try {
		let id = sessionStorage.getItem(SESSION_KEY);
		if (!id) {
			id = crypto.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
			sessionStorage.setItem(SESSION_KEY, id);
		}
		return id;
	} catch {
		return null;
	}
}

export type ObserveType = "search" | "click" | "page_view";

export function observe(
	type: ObserveType,
	payload: Record<string, unknown>
): void {
	const sessionId = getSessionId();
	const body = { type, payload, session_id: sessionId };
	fetch("/api/observe", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
		keepalive: true,
	}).catch(() => {});
}
