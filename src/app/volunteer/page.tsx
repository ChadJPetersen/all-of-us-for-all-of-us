import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import VolunteerContent from "./VolunteerContent";

export const metadata: Metadata = {
	title: "Get Involved / Volunteer | All of Us For All of Us",
	description: "Volunteer opportunities from community organizations. Filter by schedule type, upcoming, or sort by next start or due date.",
};

async function getScheduleTypes(): Promise<{ id: number; label: string; sort_order: number }[]> {
	try {
		const db = getDb();
		const result = await db
			.prepare("SELECT id, label, sort_order FROM schedule_types ORDER BY sort_order")
			.all();
		return (result.results ?? []) as { id: number; label: string; sort_order: number }[];
	} catch {
		return [];
	}
}

export default async function VolunteerPage({
	searchParams,
}: {
	searchParams: Promise<{ schedule_type_id?: string; due_before?: string; upcoming?: string; sort?: string }>;
}) {
	const params = await searchParams;
	const scheduleTypes = await getScheduleTypes();

	return (
		<VolunteerContent
			initialScheduleTypeId={params.schedule_type_id ?? null}
			initialDueBefore={params.due_before ?? null}
			initialUpcoming={params.upcoming !== "0"}
			initialSort={
				params.sort === "next_start" || params.sort === "due_date" || params.sort === "created"
					? params.sort
					: null
			}
			scheduleTypes={scheduleTypes}
		/>
	);
}
