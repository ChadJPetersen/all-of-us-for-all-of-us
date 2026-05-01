import type ical from "node-ical";
import { NextRequest, NextResponse } from "next/server";

/** fromURL(url, options) returns a Promise at runtime; node-ical typings only declare the callback overload. */
async function fetchCalendarFromUrl(
	icalModule: typeof import("node-ical"),
	url: string,
	signal: AbortSignal
): Promise<ical.CalendarResponse> {
	return icalModule.async.fromURL(url, { signal }) as unknown as Promise<ical.CalendarResponse>;
}
/** Normalize webcal:// to https:// for fetching. */
function normalizeCalendarUrl(url: string): string {
	const u = url.trim();
	if (u.toLowerCase().startsWith("webcal://")) {
		return "https://" + u.slice(9);
	}
	return u;
}

/** FullCalendar event shape. */
export interface CalendarEvent {
	id: string;
	title: string;
	start: string; // ISO
	end?: string;
	url?: string;
	extendedProps?: { description?: string; location?: string; sourceName?: string };
}

/** Coerce node-ical DateWithTimeZone (Date or legacy string) to Date. */
function toDate(d: ical.DateWithTimeZone): Date {
	return d instanceof Date ? d : new Date(String(d));
}

/** Expand a single VEVENT (recurring or not) into calendar events for the date range. */
function eventToFullCalendar(
	icalModule: Pick<typeof import("node-ical"), "expandRecurringEvent" | "async">,
	ev: ical.VEvent,
	from: Date,
	to: Date,
	sourceName: string
): CalendarEvent[] {
	const title = ev.summary != null
		? (typeof ev.summary === "string" ? ev.summary : (ev.summary as { val?: string }).val ?? "Untitled")
		: "Untitled";
	const desc = ev.description != null
		? (typeof ev.description === "string" ? ev.description : (ev.description as { val?: string }).val ?? "")
		: "";
	const loc = ev.location != null
		? (typeof ev.location === "string" ? ev.location : (ev.location as { val?: string }).val ?? "")
		: "";
	const uid = ev.uid ?? `ev-${Math.random().toString(36).slice(2)}`;

	if (ev.rrule) {
		try {
			const instances = icalModule.expandRecurringEvent(ev, { from, to, expandOngoing: true });
			return instances.map((inst) => {
				const start = toDate(inst.start);
				const end = toDate(inst.end);
				return {
					id: `${uid}-${start.getTime()}`,
					title,
					start: start.toISOString(),
					end: end.toISOString(),
					url: ev.url != null ? (typeof ev.url === "string" ? ev.url : (ev.url as { val?: string }).val) : undefined,
					extendedProps: { description: desc, location: loc, sourceName },
				};
			});
		} catch {
			// Fallback: single occurrence from start/end
		}
	}

	const start = toDate(ev.start);
	const end = ev.end != null ? toDate(ev.end) : new Date(start.getTime() + 3600000);
	if (start < to && end > from) {
		return [{
			id: uid,
			title,
			start: start.toISOString(),
			end: end.toISOString(),
			url: ev.url != null ? (typeof ev.url === "string" ? ev.url : (ev.url as { val?: string }).val) : undefined,
			extendedProps: { description: desc, location: loc, sourceName },
		}];
	}
	return [];
}

export async function GET(request: NextRequest) {
	try {
		const icalModule = (await import("node-ical")).default;

		const { searchParams } = new URL(request.url);
		const urlsParam = searchParams.get("urls");
		const fromParam = searchParams.get("from");
		const toParam = searchParams.get("to");

		const urls = urlsParam
			? urlsParam.split(",").map((u) => u.trim()).filter(Boolean)
			: [];
		if (urls.length === 0) {
			return NextResponse.json({ events: [] });
		}

		const labelsParam = searchParams.get("labels");
		const rawLabels = labelsParam ? labelsParam.split(",").map((l) => l.trim()) : [];
		const labels = urls.map((_, i) => rawLabels[i] ?? `Calendar ${i + 1}`);

		const now = new Date();
		const from = fromParam ? new Date(fromParam) : new Date(now.getFullYear(), now.getMonth() - 1, 1);
		const to = toParam ? new Date(toParam) : new Date(now.getFullYear(), now.getMonth() + 4, 0, 23, 59, 59);

		const allEvents: CalendarEvent[] = [];
		const controller = new AbortController();
		setTimeout(() => controller.abort(), 15000);

		// Fetch all calendar URLs in parallel instead of sequentially
		const fetchPromises = urls.map(async (encodedUrl, i) => {
			const rawUrl = decodeURIComponent(encodedUrl.trim());
			const url = normalizeCalendarUrl(rawUrl);
			if (!url.startsWith("https://") && !url.startsWith("http://")) {
				return [] as CalendarEvent[];
			}
			const sourceName = labels[i] ?? `Calendar ${i + 1}`;
			try {
				const data = await fetchCalendarFromUrl(icalModule, url, controller.signal);
				if (!data) return [];
				const events: CalendarEvent[] = [];
				for (const key of Object.keys(data)) {
					if (key === "vcalendar") continue;
					const comp = data[key];
					if (comp && typeof comp === "object" && (comp as { type?: string }).type === "VEVENT") {
						const ev = comp as ical.VEvent;
						if (ev.start) {
							events.push(...eventToFullCalendar(icalModule, ev, from, to, sourceName));
						}
					}
				}
				return events;
			} catch (err) {
				console.warn("Calendar fetch failed for", url, err);
				return [];
			}
		});

		const results = await Promise.all(fetchPromises);
		for (const events of results) {
			allEvents.push(...events);
		}

		allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
		return NextResponse.json({ events: allEvents });
	} catch (err) {
		console.error("Calendar events API error:", err);
		return NextResponse.json(
			{ error: "Failed to load calendar events" },
			{ status: 500 }
		);
	}
}
