"use client";

import { useCallback, useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import type { EventInput } from "@fullcalendar/core";

/** Normalize feed URL to https for subscription links (Google, Outlook, copy). */
function toSubscriptionUrl(url: string): string {
	const u = url.trim();
	if (u.toLowerCase().startsWith("webcal://")) return "https://" + u.slice(9);
	return u;
}

/** Webcal URL for Apple Calendar (and other apps that support webcal). */
function toWebcalUrl(url: string): string {
	const https = toSubscriptionUrl(url);
	if (https.startsWith("https://")) return "webcal://" + https.slice(8);
	if (https.startsWith("http://")) return "webcal://" + https.slice(7);
	return https;
}

/** Returns true if the link is an ICS or webcal feed we can show in the modal. */
export function isIcalOrWebcalLink(url: string): boolean {
	if (!url || typeof url !== "string") return false;
	const u = url.trim().toLowerCase();
	if (u.startsWith("webcal://")) return true;
	if (u.startsWith("https://") || u.startsWith("http://")) {
		if (u.includes(".ics") || u.includes("/ical/") || u.includes("icalendar")) return true;
	}
	return false;
}

interface CalendarModalProps {
	open: boolean;
	onClose: () => void;
	url: string;
	label: string;
}

export default function CalendarModal({ open, onClose, url, label }: CalendarModalProps) {
	const [events, setEvents] = useState<EventInput[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	const subscriptionUrl = toSubscriptionUrl(url);
	const webcalUrl = toWebcalUrl(url);

	const handleCopyLink = useCallback(() => {
		navigator.clipboard.writeText(subscriptionUrl).then(
			() => {
				setCopied(true);
				setTimeout(() => setCopied(false), 2000);
			},
			() => {}
		);
	}, [subscriptionUrl]);

	const googleCalendarUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(subscriptionUrl)}`;
	const outlookCalendarUrl = "https://outlook.live.com/owa/0/calendar/0/addfromweb";

	const fetchEvents = useCallback(async () => {
		if (!url.trim()) return;
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
				urls: encodeURIComponent(url.trim()),
				labels: encodeURIComponent(label),
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
	}, [url, label]);

	useEffect(() => {
		if (open && url) fetchEvents();
	}, [open, url, fetchEvents]);

	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		if (open) {
			document.addEventListener("keydown", handleEscape);
			document.body.style.overflow = "hidden";
		}
		return () => {
			document.removeEventListener("keydown", handleEscape);
			document.body.style.overflow = "";
		};
	}, [open, onClose]);

	if (!open) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
			role="dialog"
			aria-modal="true"
			aria-labelledby="calendar-modal-title"
			aria-describedby="calendar-modal-desc"
			onClick={(e) => e.target === e.currentTarget && onClose()}
		>
			<div
				className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-between shrink-0 px-4 py-3 border-b border-slate-200 dark:border-slate-600">
					<h2 id="calendar-modal-title" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
						{label}
					</h2>
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-700 focus:ring-2 focus:ring-teal-500"
						aria-label="Close calendar modal"
					>
						<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
				{/* Single scrollable body: calendar + subscribe */}
				<div id="calendar-modal-desc" className="flex-1 min-h-0 overflow-auto">
					<div className="p-4">
						{loading && (
							<div className="flex items-center justify-center py-12">
								<div className="h-8 w-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" aria-hidden />
								<span className="sr-only">Loading calendar…</span>
							</div>
						)}
						{error && (
							<p className="text-sm text-red-600 dark:text-red-400 py-4" role="alert">
								{error}
							</p>
						)}
						{!loading && !error && (
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
						)}
					</div>
					{/* Subscribe to this calendar — Outlook, Google, Apple */}
					<div className="px-4 py-3 border-t border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/80">
					<p id="calendar-subscribe-heading" className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
						Subscribe to this calendar
					</p>
					<div className="flex flex-wrap items-center gap-2" role="group" aria-labelledby="calendar-subscribe-heading">
						<button
							type="button"
							onClick={handleCopyLink}
							className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 focus:ring-2 focus:ring-teal-500"
							aria-label={copied ? "Link copied to clipboard" : "Copy calendar subscription link"}
						>
							{copied ? (
								<>
									<svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
									</svg>
									Copied
								</>
							) : (
								<>
									<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
									</svg>
									Copy link
								</>
							)}
						</button>
						<a
							href={googleCalendarUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 focus:ring-2 focus:ring-teal-500"
							aria-label="Add to Google Calendar (opens in new window)"
						>
							Add to Google Calendar
						</a>
						<a
							href={outlookCalendarUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 focus:ring-2 focus:ring-teal-500"
							aria-label="Add to Outlook calendar (opens in new window)"
						>
							Add to Outlook
						</a>
						<a
							href={webcalUrl}
							className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 focus:ring-2 focus:ring-teal-500"
							aria-label="Add to Apple Calendar"
						>
							Add to Apple Calendar
						</a>
					</div>
					<p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
						Use Copy link first for Outlook, then paste when the page opens. Apple Calendar opens on Mac/iOS.
					</p>
					</div>
				</div>
			</div>
		</div>
	);
}
