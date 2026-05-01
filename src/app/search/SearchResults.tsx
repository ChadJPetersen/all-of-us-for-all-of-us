"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type {
	SearchOrganizationHit,
	SearchCalendarHit,
	SearchResourceHit,
	SearchVolunteerHit,
} from "@/lib/types";

interface SearchResponse {
	organizations: SearchOrganizationHit[];
	calendars: SearchCalendarHit[];
	resources: SearchResourceHit[];
	volunteerOpportunities: SearchVolunteerHit[];
}

interface SearchResultsProps {
	query: string;
}

function Section({
	title,
	href,
	items,
	children,
}: {
	title: string;
	href: string;
	items: unknown[];
	children: React.ReactNode;
}) {
	if (items.length === 0) return null;
	const sectionId = `search-section-${title.toLowerCase().replace(/\s+/g, "-")}`;
	return (
		<section className="mb-10" aria-labelledby={sectionId}>
			<h2 id={sectionId} className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
				{title}
				<Link
					href={href}
					className="text-sm font-normal text-teal-600 dark:text-teal-400 hover:underline"
					aria-label={`View all ${title}`}
				>
					View all →
				</Link>
			</h2>
			<ul className="space-y-3">{children}</ul>
		</section>
	);
}

export function SearchResults({ query }: SearchResultsProps) {
	const [data, setData] = useState<SearchResponse | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!query) {
			setData(null);
			setLoading(false);
			setError(null);
			return;
		}
		let cancelled = false;
		const controller = new AbortController();
		setLoading(true);
		setError(null);
		fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
			.then((res) => {
				if (!res.ok) throw new Error("Search failed");
				return res.json();
			})
			.then((json: unknown) => {
				if (!cancelled) setData(json as SearchResponse);
			})
			.catch((err) => {
				if (cancelled || err?.name === "AbortError") return;
				setError("Search failed. Please try again.");
				setData(null);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
			controller.abort();
		};
	}, [query]);

	if (!query) {
		return (
			<div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-8 text-center" role="status">
				<p className="text-slate-600 dark:text-slate-400">
					Enter a search term above to find calendars, organizations, resources, and volunteer opportunities.
				</p>
			</div>
		);
	}

	if (loading) {
		return (
			<div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-8 text-center" role="status" aria-live="polite">
				<p className="text-slate-600 dark:text-slate-400">Searching…</p>
			</div>
		);
	}

	if (error) {
		return (
			<div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-6 text-center" role="alert">
				<p className="text-red-700 dark:text-red-300">{error}</p>
			</div>
		);
	}

	if (!data) return null;

	const hasAny =
		data.organizations.length > 0 ||
		data.calendars.length > 0 ||
		data.resources.length > 0 ||
		data.volunteerOpportunities.length > 0;

	if (!hasAny) {
		return (
			<div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-8 text-center" role="status">
				<p className="text-slate-600 dark:text-slate-400">
					No results for &quot;{query}&quot;. Try different words or browse Calendar, Resources, or Organizations.
				</p>
			</div>
		);
	}

	return (
		<div>
			<Section title="Organizations" href="/organizations" items={data.organizations}>
				{data.organizations.map((org) => (
					<li
						key={`org-${org.id}`}
						className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4 shadow-sm"
					>
						<Link
							href="/organizations"
							className="font-medium text-slate-900 dark:text-slate-100 hover:text-teal-600 dark:hover:text-teal-400"
							data-observe-context={JSON.stringify({ source: "search_results", resultType: "organization", resultId: org.id, query })}
						>
							{org.name}
						</Link>
						<p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Organization</p>
					</li>
				))}
			</Section>

			<Section title="Calendars" href="/calendar" items={data.calendars}>
				{data.calendars.map((cal) => (
					<li
						key={`cal-${cal.id}`}
						className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4 shadow-sm"
					>
						<span className="font-medium text-slate-900 dark:text-slate-100">{cal.name}</span>
						<p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Calendar</p>
						<div className="mt-2 flex flex-wrap gap-2">
							{cal.calendar_links.map((item, i) => {
								const displayName = item.name?.trim() || (cal.calendar_links.length > 1 ? `${cal.name} (${i + 1})` : cal.name);
								return (
									<a
										key={i}
										href={item.link}
										target="_blank"
										rel="noopener noreferrer"
										className="inline-flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 hover:underline"
										data-observe-context={JSON.stringify({ source: "search_results", resultType: "calendar", resultId: cal.id, query })}
										aria-label={`${displayName} (opens in new window)`}
									>
										{displayName}
									</a>
								);
							})}
						</div>
					</li>
				))}
			</Section>

			<Section title="Resources" href="/resources" items={data.resources}>
				{data.resources.map((res) => (
					<li
						key={`res-${res.id}`}
						className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4 shadow-sm"
					>
						<span className="font-medium text-slate-900 dark:text-slate-100">{res.title}</span>
						<p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
							{res.resource_type_label} · {res.organization_name}
						</p>
						{res.description && (
							<p className="text-sm text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
								{res.description}
							</p>
						)}
						<Link
							href="/resources"
							className="mt-2 inline-block text-sm text-teal-600 dark:text-teal-400 hover:underline"
							data-observe-context={JSON.stringify({ source: "search_results", resultType: "resource", resultId: res.id, query })}
						>
							View on Resources
						</Link>
					</li>
				))}
			</Section>

			<Section title="Volunteer opportunities" href="/volunteer" items={data.volunteerOpportunities}>
				{data.volunteerOpportunities.map((vo) => (
					<li
						key={`vo-${vo.id}`}
						className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4 shadow-sm"
					>
						<span className="font-medium text-slate-900 dark:text-slate-100">{vo.title}</span>
						<p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{vo.organization_name}</p>
						{vo.description && (
							<p className="text-sm text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
								{vo.description}
							</p>
						)}
						<Link
							href="/volunteer"
							className="mt-2 inline-block text-sm text-teal-600 dark:text-teal-400 hover:underline"
							data-observe-context={JSON.stringify({ source: "search_results", resultType: "volunteer", resultId: vo.id, query })}
						>
							View on Get involved / Volunteer
						</Link>
					</li>
				))}
			</Section>
		</div>
	);
}
