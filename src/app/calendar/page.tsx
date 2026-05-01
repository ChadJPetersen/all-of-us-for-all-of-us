import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db";
import CalendarContentLoader from "./CalendarContentLoader";

export const metadata: Metadata = {
	title: "Shared Calendar | All of Us For All of Us",
	description: "Events, meetings, and important dates. View organization calendars in one place.",
};

interface OrgCalendar {
	id: number;
	name: string;
	slug: string | null;
	calendar_links: { link: string; name?: string | null }[];
}

async function getOrganizationsWithCalendars(): Promise<OrgCalendar[]> {
	try {
		const db = getDb();
		const result = await db
			.prepare(
				`SELECT o.id, o.name, o.slug, ocl.link, ocl.name AS calendar_name
				 FROM organizations o
				 INNER JOIN organization_calendar_links ocl ON ocl.organization_id = o.id
				 ORDER BY o.name, ocl.sort_order, ocl.id`
			)
			.all();
		const rows = (result.results ?? []) as { id: number; name: string; slug: string | null; link: string; calendar_name?: string | null }[];
		const byId = new Map<number, OrgCalendar>();
		for (const row of rows) {
			const existing = byId.get(row.id);
			const entry = { link: row.link, name: row.calendar_name ?? null };
			if (existing) {
				existing.calendar_links.push(entry);
			} else {
				byId.set(row.id, {
					id: row.id,
					name: row.name,
					slug: row.slug,
					calendar_links: [entry],
				});
			}
		}
		return Array.from(byId.values());
	} catch {
		return [];
	}
}

export default async function CalendarPage() {
	const orgs = await getOrganizationsWithCalendars();

	return (
		<div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-teal-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/20">
			<main id="main-content" className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12" role="main">
				<div className="text-center mb-10">
					<h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
						Shared Calendar
					</h1>
					<p className="mt-2 text-slate-600 dark:text-slate-400">
						Select calendars on the left to see events in the calendar view.
					</p>
				</div>

				{orgs.length === 0 ? (
					<div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-8 text-center">
						<p className="text-slate-600 dark:text-slate-400">
							No organization calendars have been shared yet.
						</p>
						<p className="mt-2 text-sm text-slate-500 dark:text-slate-500">
							Add an organization with a calendar link on the{" "}
							<Link href="/organizations" className="text-teal-600 dark:text-teal-400 hover:underline">
								organizations page
							</Link>
							. Use an <strong>ICS</strong> (.ics) or <strong>webcal</strong> feed URL from Google Calendar, Outlook, or Apple Calendar.
						</p>
					</div>
				) : (
					<CalendarContentLoader orgs={orgs} />
				)}
			</main>
		</div>
	);
}
