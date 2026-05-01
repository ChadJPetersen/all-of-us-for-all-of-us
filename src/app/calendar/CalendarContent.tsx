"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import type { EventInput } from "@fullcalendar/core";
import CalendarModal from "@/components/CalendarModal";

const STORAGE_KEY_SELECTED = "a4a_calendar_selected";
const STORAGE_KEY_SEEN = "a4a_calendar_seen";

export interface OrgCalendar {
	id: number;
	name: string;
	slug: string | null;
	calendar_links: { link: string; name?: string | null }[];
}

interface CalendarOption {
	id: string;
	label: string;
	url: string;
}

function buildCalendarOptions(orgs: OrgCalendar[]): CalendarOption[] {
	const options: CalendarOption[] = [];
	for (const org of orgs) {
		org.calendar_links.forEach((item, i) => {
			const displayName =
				item.name?.trim() ||
				(org.calendar_links.length > 1 ? `${org.name} (${i + 1})` : org.name);
			options.push({
				id: `${org.id}-${i}`,
				label: displayName,
				url: item.link,
			});
		});
	}
	return options;
}

function loadStoredSelected(): string[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY_SELECTED);
		if (raw == null) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function loadStoredSeen(): Set<string> {
	try {
		const raw = localStorage.getItem(STORAGE_KEY_SEEN);
		if (raw == null) return new Set();
		const parsed = JSON.parse(raw);
		const arr = Array.isArray(parsed) ? parsed : [];
		return new Set(arr);
	} catch {
		return new Set();
	}
}

function saveStoredSelected(ids: string[]): void {
	try {
		localStorage.setItem(STORAGE_KEY_SELECTED, JSON.stringify(ids));
	} catch {
		// ignore
	}
}

function saveStoredSeen(seen: Set<string>): void {
	try {
		localStorage.setItem(STORAGE_KEY_SEEN, JSON.stringify([...seen]));
	} catch {
		// ignore
	}
}

export default function CalendarContent({ orgs }: { orgs: OrgCalendar[] }) {
	const calendarOptions = useMemo(() => buildCalendarOptions(orgs), [orgs]);
	const optionIds = useMemo(() => new Set(calendarOptions.map((c) => c.id)), [calendarOptions]);

	const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
	const [initialized, setInitialized] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [events, setEvents] = useState<EventInput[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [calendarModal, setCalendarModal] = useState<{ url: string; label: string } | null>(null);

	// Restore selection from localStorage and auto-select new calendars
	useEffect(() => {
		if (calendarOptions.length === 0) return;
		const saved = loadStoredSelected();
		const seen = loadStoredSeen();
		const validSaved = saved.filter((id) => optionIds.has(id));
		const newIds = calendarOptions.filter((c) => !seen.has(c.id)).map((c) => c.id);
		const nextSelected = new Set<string>([...validSaved, ...newIds]);
		const nextSeen = new Set([...seen, ...newIds]);
		setSelectedIds(nextSelected);
		saveStoredSelected([...nextSelected]);
		saveStoredSeen(nextSeen);
		setInitialized(true);
	}, [calendarOptions, optionIds]);

	// Persist selection when user changes it
	useEffect(() => {
		if (!initialized) return;
		saveStoredSelected([...selectedIds]);
	}, [initialized, selectedIds]);

	const fetchEvents = useCallback(async (ids: Set<string>) => {
		if (ids.size === 0) {
			setEvents([]);
			return;
		}
		const selected = calendarOptions.filter((c) => ids.has(c.id));
		if (selected.length === 0) {
			setEvents([]);
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const from = new Date();
			from.setMonth(from.getMonth() - 1);
			from.setDate(1);
			const to = new Date();
			to.setMonth(to.getMonth() + 5);
			to.setDate(0);
			to.setHours(23, 59, 59, 999);
			const params = new URLSearchParams({
				urls: selected.map((c) => encodeURIComponent(c.url)).join(","),
				labels: selected.map((c) => encodeURIComponent(c.label)).join(","),
				from: from.toISOString(),
				to: to.toISOString(),
			});
			const res = await fetch(`/api/calendar/events?${params}`);
			if (!res.ok) throw new Error("Failed to load events");
			const data = (await res.json()) as { events?: Array<{ id: string; title: string; start: string; end?: string; url?: string; extendedProps?: Record<string, unknown> }> };
			setEvents(
				(data.events ?? []).map((e) => ({
					id: e.id,
					title: e.title,
					start: e.start,
					end: e.end,
					url: e.url,
					extendedProps: e.extendedProps,
				}))
			);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to load events");
			setEvents([]);
		} finally {
			setLoading(false);
		}
	}, [calendarOptions]);

	useEffect(() => {
		if (!initialized) return;
		fetchEvents(selectedIds);
	}, [initialized, selectedIds, fetchEvents]);

	const toggle = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const selectAll = () => {
		setSelectedIds(new Set(calendarOptions.map((c) => c.id)));
	};

	const selectNone = () => {
		setSelectedIds(new Set());
	};

	// Selected first, then unselected; then filter by search
	const sortedOptions = useMemo(
		() =>
			[...calendarOptions].sort((a, b) => {
				const aSel = selectedIds.has(a.id);
				const bSel = selectedIds.has(b.id);
				if (aSel && !bSel) return -1;
				if (!aSel && bSel) return 1;
				return 0;
			}),
		[calendarOptions, selectedIds]
	);
	const filteredOptions = useMemo(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return sortedOptions;
		return sortedOptions.filter((o) => o.label.toLowerCase().includes(q));
	}, [sortedOptions, searchQuery]);

	if (orgs.length === 0) {
		return null;
	}

	return (
		<div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
			{/* Left: selectable list of calendars */}
			<aside className="lg:w-72 shrink-0" aria-label="Calendar list">
				<div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4 shadow-sm">
					<h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
						Calendars
					</h2>
					<p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
						Select which calendars to show on the right. Your choices are saved.
					</p>
					<div className="mb-3">
						<label htmlFor="calendar-search" className="sr-only">
							Search calendars
						</label>
						<input
							id="calendar-search"
							type="search"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search calendars…"
							className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
							aria-label="Search calendars to display"
						/>
					</div>
					<div className="flex gap-2 mb-3" role="group" aria-label="Calendar selection">
						<button
							type="button"
							onClick={selectAll}
							className="text-sm text-teal-600 dark:text-teal-400 hover:underline"
							aria-label="Select all calendars"
						>
							Select all
						</button>
						<span className="text-slate-300 dark:text-slate-600" aria-hidden>|</span>
						<button
							type="button"
							onClick={selectNone}
							className="text-sm text-teal-600 dark:text-teal-400 hover:underline"
							aria-label="Clear calendar selection"
						>
							Clear
						</button>
					</div>
					<ul className="space-y-2 max-h-[40vh] overflow-y-auto">
						{filteredOptions.length === 0 ? (
							<li className="text-sm text-slate-500 dark:text-slate-400 py-2">
								{searchQuery.trim() ? "No calendars match your search." : "No calendars."}
							</li>
						) : (
							filteredOptions.map((opt) => (
								<li key={opt.id} className="flex items-center gap-2 group">
									<input
										type="checkbox"
										id={`cal-${opt.id}`}
										checked={selectedIds.has(opt.id)}
										onChange={() => toggle(opt.id)}
										className="rounded border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500 shrink-0"
									/>
									<label
										htmlFor={`cal-${opt.id}`}
										className="text-sm text-slate-700 dark:text-slate-200 cursor-pointer select-none flex-1 min-w-0"
									>
										{opt.label}
									</label>
									<button
										type="button"
										onClick={() => setCalendarModal({ url: opt.url, label: opt.label })}
										className="shrink-0 rounded p-1.5 text-slate-500 hover:text-teal-600 hover:bg-slate-100 dark:hover:text-slate-400 dark:hover:bg-slate-700 focus:ring-2 focus:ring-teal-500"
										title="View this calendar in a popup"
										aria-label={`View ${opt.label} calendar`}
									>
										<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
										</svg>
									</button>
								</li>
							))
						)}
					</ul>
				</div>
			</aside>

			{/* Right: calendar view */}
			<div className="flex-1 min-w-0">
				<div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4 shadow-sm">
					{loading && (
						<div className="flex items-center justify-center py-8">
							<div className="h-8 w-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" aria-hidden />
							<span className="sr-only">Loading events…</span>
						</div>
					)}
					{error && (
						<p className="text-sm text-red-600 dark:text-red-400 py-2" role="alert">
							{error}
						</p>
					)}
					<div className={loading ? "opacity-50 pointer-events-none" : ""}>
						<FullCalendar
							plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
							initialView="dayGridMonth"
							headerToolbar={{
								left: "prev,next today",
								center: "title",
								right: "dayGridMonth,timeGridWeek,listWeek",
							}}
							events={events}
							eventClick={(info) => {
								if (info.event.url) {
									info.jsEvent.preventDefault();
									window.open(info.event.url);
								}
							}}
							height="auto"
							eventDisplay="block"
							slotMinTime="06:00:00"
							slotMaxTime="22:00:00"
							views={{
								dayGridMonth: { buttonText: "Month" },
								timeGridWeek: { buttonText: "Week" },
								listWeek: { buttonText: "List" },
							}}
						/>
					</div>
				</div>
			</div>
			<CalendarModal
				open={calendarModal != null}
				onClose={() => setCalendarModal(null)}
				url={calendarModal?.url ?? ""}
				label={calendarModal?.label ?? ""}
			/>
		</div>
	);
}
