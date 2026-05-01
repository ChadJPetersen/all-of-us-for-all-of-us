"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { VirtualizedInfiniteList } from "@/components/VirtualizedInfiniteList";
import { formatDate, formatDateTime } from "@/lib/format";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import type { VolunteerOpportunityWithOrg } from "@/lib/types";

interface VolunteerContentProps {
	initialScheduleTypeId?: string | null;
	initialDueBefore?: string | null;
	initialUpcoming?: boolean;
	initialSort?: "next_start" | "due_date" | "created" | null;
	scheduleTypes?: { id: number; label: string; sort_order: number }[];
}

export default function VolunteerContent({
	initialScheduleTypeId,
	initialDueBefore,
	initialUpcoming,
	initialSort,
	scheduleTypes = [],
}: VolunteerContentProps) {
	const [opportunities, setOpportunities] = useState<VolunteerOpportunityWithOrg[]>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [deletingId, setDeletingId] = useState<number | null>(null);
	const [scheduleTypeId, setScheduleTypeId] = useState(initialScheduleTypeId ?? "");
	const [upcoming, setUpcoming] = useState(initialUpcoming !== false);
	const [sort, setSort] = useState<"next_start" | "due_date" | "created">(
		initialSort === "due_date" || initialSort === "next_start" ? initialSort : "created"
	);

	const fetchOpportunities = useCallback(async (offset = 0) => {
		if (offset === 0) setLoading(true);
		const params = new URLSearchParams({
			limit: String(DEFAULT_PAGE_SIZE),
			offset: String(offset),
		});
		if (scheduleTypeId && scheduleTypeId !== "") params.set("schedule_type_id", scheduleTypeId);
		if (!upcoming) params.set("include_past", "1");
		if (sort !== "created") params.set("sort", sort);
		const res = await fetch(`/api/volunteer-opportunities?${params.toString()}`);
		if (!res.ok) {
			if (offset === 0) setOpportunities([]);
			setLoading(false);
			return;
		}
		const data = (await res.json()) as { opportunities?: VolunteerOpportunityWithOrg[]; total_count?: number };
		const list = data.opportunities ?? [];
		const total = data.total_count ?? 0;
		if (offset === 0) {
			setOpportunities(list);
			setTotalCount(total);
		} else {
			setOpportunities((prev) => [...prev, ...list]);
		}
		setLoading(false);
	}, [scheduleTypeId, upcoming, sort]);

	useEffect(() => {
		fetchOpportunities(0);
	}, [fetchOpportunities]);

	function formatTimeSummary(vo: VolunteerOpportunityWithOrg): string | null {
		if (vo.start_at) {
			const end = vo.end_at ? ` – ${formatDateTime(vo.end_at)}` : "";
			return formatDateTime(vo.start_at) + end;
		}
		const slots = vo.slots ?? [];
		if (slots.length > 0) {
			const next = slots.find((s) => s.start_at >= new Date().toISOString()) ?? slots[0];
			return formatDateTime(next.start_at) + (next.end_at ? ` – ${formatDateTime(next.end_at)}` : "");
		}
		if (vo.due_date) return `Due by ${formatDate(vo.due_date)}`;
		if (vo.window_start_date || vo.window_end_date) {
			const start = vo.window_start_date ? formatDate(vo.window_start_date) : "—";
			const end = vo.window_end_date ? formatDate(vo.window_end_date) : "—";
			return `${start} – ${end}`;
		}
		if (vo.is_recurring && vo.recurrence_description) return vo.recurrence_description;
		return null;
	}

	const handleDelete = async (id: number) => {
		if (deletingId != null) return;
		setDeletingId(id);
		try {
			const res = await fetch(`/api/volunteer-opportunities/${id}`, { method: "DELETE" });
			if (!res.ok) {
				const data = (await res.json()) as { error?: string };
				alert(data.error ?? "Failed to delete opportunity.");
				return;
			}
			setOpportunities((prev) => prev.filter((o) => o.id !== id));
			setTotalCount((c) => Math.max(0, c - 1));
		} finally {
			setDeletingId(null);
		}
	};

	return (
		<div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-amber-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-amber-950/20">
			<main id="main-content" className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12" role="main">
				<div className="text-center mb-10">
					<h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
						Get Involved / Volunteer
					</h1>
					<p className="mt-2 text-slate-600 dark:text-slate-400">
						Volunteer opportunities from community organizations. Filter by schedule type, show upcoming only, or sort by next start or due date.
					</p>
				</div>

				{/* Filters and sort */}
				<div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-3">
					{scheduleTypes.length > 0 && (
						<label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
							<span>Schedule:</span>
							<select
								value={scheduleTypeId}
								onChange={(e) => setScheduleTypeId(e.target.value)}
								className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1 text-sm"
							>
								<option value="">All</option>
								{scheduleTypes.map((st) => (
									<option key={st.id} value={st.id}>
										{st.label}
									</option>
								))}
							</select>
						</label>
					)}
						<label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
							<input
								type="checkbox"
								checked={upcoming}
								onChange={(e) => setUpcoming(e.target.checked)}
								className="rounded border-slate-300 dark:border-slate-600"
							/>
							Current and upcoming only
						</label>
					<label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
						<span>Sort:</span>
						<select
							value={sort}
							onChange={(e) => setSort(e.target.value as "next_start" | "due_date" | "created")}
							className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1 text-sm"
						>
							<option value="created">Date added</option>
							<option value="next_start">Next start</option>
							<option value="due_date">Due date</option>
						</select>
					</label>
				</div>

				{loading ? (
					<div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-8 text-center text-slate-500 dark:text-slate-400">
						Loading…
					</div>
				) : opportunities.length === 0 ? (
					<div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-8 text-center">
						<p className="text-slate-600 dark:text-slate-400">
							No volunteer opportunities match your filters.
						</p>
						<p className="mt-2 text-sm text-slate-500 dark:text-slate-500">
							Organizations can add opportunities on the{" "}
							<Link href="/organizations" className="text-teal-600 dark:text-teal-400 hover:underline">
								Organizations
							</Link>{" "}
							page.
						</p>
					</div>
				) : (
					<VirtualizedInfiniteList<VolunteerOpportunityWithOrg>
						items={opportunities}
						totalCount={totalCount}
						hasMore={opportunities.length < totalCount}
						loadMore={() => {
							if (loadingMore || opportunities.length >= totalCount) return;
							setLoadingMore(true);
							fetchOpportunities(opportunities.length).finally(() => setLoadingMore(false));
						}}
						isLoadingMore={loadingMore}
						estimateSize={140}
						getItemKey={(vo) => vo.id}
						className="max-h-[70vh] min-h-[400px]"
						renderItem={(vo) => {
							const timeSummary = formatTimeSummary(vo);
							return (
								<div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4 shadow-sm">
									<div className="flex flex-wrap items-baseline justify-between gap-2">
										<div className="min-w-0 flex-1">
											<h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
												{vo.link ? (
													<a
														href={vo.link}
														target="_blank"
														rel="noopener noreferrer"
														className="hover:text-teal-600 dark:hover:text-teal-400 underline"
													>
														{vo.title}
													</a>
												) : (
													vo.title
												)}
											</h2>
											{vo.schedule_type_ref && (
												<span className="text-xs text-amber-600 dark:text-amber-400">
													{vo.schedule_type_ref.label}
												</span>
											)}
											{vo.role_type_ref && (
												<span className="text-xs text-slate-500 dark:text-slate-400">
													{vo.role_type_ref.label}
												</span>
											)}
											<span className="text-xs text-slate-500 dark:text-slate-400">
												{vo.location_type_label}
											</span>
										</div>
										<button
											type="button"
											onClick={() => handleDelete(vo.id)}
											disabled={deletingId === vo.id}
											className="shrink-0 rounded p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
											title="Delete volunteer opportunity"
											aria-label={`Delete volunteer opportunity ${vo.title}`}
										>
											{deletingId === vo.id ? (
												<span className="inline-block h-5 w-5 rounded-full border-2 border-red-500 border-t-transparent animate-spin" aria-hidden />
											) : (
												<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
											)}
										</button>
									</div>
									<p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">
										{vo.organization_name}
									</p>
									{timeSummary && (
										<p className="mt-1 text-sm text-teal-700 dark:text-teal-300">
											{timeSummary}
										</p>
									)}
									{vo.location_override && (
										<p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
											Location: {vo.location_override}
										</p>
									)}
									{vo.volunteers_needed != null && vo.volunteers_needed > 0 && (
										<p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
											{vo.volunteers_needed} volunteer{vo.volunteers_needed !== 1 ? "s" : ""} needed
										</p>
									)}
									{vo.description && (
										<p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
											{vo.description}
										</p>
									)}
									<div className="mt-2 flex flex-wrap items-center gap-3">
										<Link
											href="/organizations"
											className="text-sm text-teal-600 dark:text-teal-400 hover:underline"
										>
											View organization
										</Link>
										<span className="text-xs text-slate-400 dark:text-slate-500">
											Added {formatDate(vo.created_at)}
										</span>
									</div>
								</div>
							);
						}}
					/>
				)}
			</main>
		</div>
	);
}
