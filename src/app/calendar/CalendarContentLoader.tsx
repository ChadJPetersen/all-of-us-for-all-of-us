"use client";

import dynamic from "next/dynamic";
import type { OrgCalendar } from "./CalendarContent";

const CalendarContent = dynamic(() => import("./CalendarContent"), {
	ssr: false,
	loading: () => (
		<div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-8 flex items-center justify-center min-h-[400px]">
			<div className="h-10 w-10 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" aria-hidden />
			<span className="sr-only">Loading calendar…</span>
		</div>
	),
});

export default function CalendarContentLoader({ orgs }: { orgs: OrgCalendar[] }) {
	return <CalendarContent orgs={orgs} />;
}
