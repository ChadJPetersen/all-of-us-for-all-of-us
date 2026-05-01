"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { VirtualizedInfiniteList } from "@/components/VirtualizedInfiniteList";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

interface ResourceTypeRef {
	id: number;
	label: string;
}

interface ResourceItem {
	id: number;
	organization_id: number;
	organization_name: string;
	organization_slug?: string | null;
	resource_type_id: number;
	resource_type_ref: ResourceTypeRef;
	title: string;
	description: string | null;
	link: string | null;
	created_at: string;
	updated_at: string;
}

interface ResourceTypeOption {
	id: number;
	label: string;
}

export default function ResourcesContent() {
	const [resources, setResources] = useState<ResourceItem[]>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [resourceTypes, setResourceTypes] = useState<ResourceTypeOption[]>([]);
	const [filterTypeId, setFilterTypeId] = useState<string>("");
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [deletingId, setDeletingId] = useState<number | null>(null);

	const fetchResourceTypes = useCallback(async () => {
		const res = await fetch("/api/form-options");
		if (!res.ok) return;
		const data = (await res.json()) as { resourceTypes?: ResourceTypeOption[] };
		setResourceTypes(data.resourceTypes ?? []);
	}, []);

	const fetchResources = useCallback(async (offset = 0) => {
		const params = new URLSearchParams({
			limit: String(DEFAULT_PAGE_SIZE),
			offset: String(offset),
		});
		if (filterTypeId) params.set("type", filterTypeId);
		const res = await fetch(`/api/resources?${params}`);
		if (!res.ok) return;
		const data = (await res.json()) as { resources?: ResourceItem[]; total_count?: number };
		const list = data.resources ?? [];
		const total = data.total_count ?? 0;
		if (offset === 0) {
			setResources(list);
			setTotalCount(total);
		} else {
			setResources((prev) => [...prev, ...list]);
		}
	}, [filterTypeId]);

	const handleDelete = async (id: number) => {
		if (deletingId != null) return;
		setDeletingId(id);
		try {
			const res = await fetch(`/api/resources/${id}`, { method: "DELETE" });
			if (!res.ok) {
				const data = (await res.json()) as { error?: string };
				alert(data.error ?? "Failed to delete resource.");
				return;
			}
			setResources((prev) => prev.filter((r) => r.id !== id));
			setTotalCount((c) => Math.max(0, c - 1));
		} finally {
			setDeletingId(null);
		}
	};

	useEffect(() => {
		let cancelled = false;
		(async () => {
			setLoading(true);
			await fetchResourceTypes();
			if (!cancelled) setLoading(false);
		})();
		return () => { cancelled = true; };
	}, [fetchResourceTypes]);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			setLoading(true);
			await fetchResources(0);
			if (!cancelled) setLoading(false);
		})();
		return () => { cancelled = true; };
	}, [fetchResources]);

	if (loading && resources.length === 0) {
		return (
			<div className="flex justify-center py-12">
				<p className="text-slate-500 dark:text-slate-400">Loading…</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{resourceTypes.length > 0 && (
				<div>
					<label htmlFor="filter-type" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
						Filter by type
					</label>
					<select
						id="filter-type"
						value={filterTypeId}
						onChange={(e) => setFilterTypeId(e.target.value)}
						className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 max-w-xs"
					>
						<option value="">All types</option>
						{resourceTypes.map((rt) => (
							<option key={rt.id} value={rt.id}>
								{rt.label}
							</option>
						))}
					</select>
				</div>
			)}

			<section>
				<h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
					Resources ({resources.length}{resources.length < totalCount ? ` of ${totalCount}` : ""})
				</h2>
				{resources.length === 0 ? (
					<p className="text-slate-500 dark:text-slate-400">
						No resources yet. Organizations can add resources with a type on the{" "}
						<Link href="/organizations" className="text-rose-600 dark:text-rose-400 hover:underline">
							organizations
						</Link>{" "}
						page.
					</p>
				) : (
					<VirtualizedInfiniteList<ResourceItem>
						items={resources}
						totalCount={totalCount}
						hasMore={resources.length < totalCount}
						loadMore={() => {
							if (loadingMore || resources.length >= totalCount) return;
							setLoadingMore(true);
							fetchResources(resources.length).finally(() => setLoadingMore(false));
						}}
						isLoadingMore={loadingMore}
						estimateSize={100}
						getItemKey={(r) => r.id}
						className="max-h-[70vh] min-h-[400px]"
						renderItem={(r) => (
							<div className="mb-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4 shadow-sm">
								<div className="flex flex-wrap items-start justify-between gap-2">
									<div className="min-w-0 flex-1">
										{r.resource_type_ref && (
											<span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
												{r.resource_type_ref.label}
											</span>
										)}
										<p className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
											{r.link ? (
												<a
													href={r.link}
													target="_blank"
													rel="noopener noreferrer"
													className="text-rose-600 dark:text-rose-400 hover:underline"
												>
													{r.title}
												</a>
											) : (
												<span>{r.title}</span>
											)}
										</p>
										{r.description && (
											<p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
												{r.description}
											</p>
										)}
										<p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
											—{" "}
											<Link
												href={`/organizations/${r.organization_slug ?? r.organization_id}`}
												className="text-rose-600 dark:text-rose-400 hover:underline"
											>
												{r.organization_name}
											</Link>
										</p>
									</div>
									<button
										type="button"
										onClick={() => handleDelete(r.id)}
										disabled={deletingId === r.id}
										className="shrink-0 rounded p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
										title="Delete resource"
										aria-label={`Delete resource ${r.title}`}
									>
										{deletingId === r.id ? (
											<span className="inline-block h-5 w-5 rounded-full border-2 border-red-500 border-t-transparent animate-spin" aria-hidden />
										) : (
											<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
										)}
									</button>
								</div>
							</div>
						)}
					/>
				)}
			</section>
		</div>
	);
}
