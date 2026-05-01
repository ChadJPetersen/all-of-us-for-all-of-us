"use client";

import Link from "next/link";
import HeaderVideo from "@/components/HeaderVideo";
import PrincipalCarousel from "@/components/PrincipalCarousel";
import QuiltSection from "@/components/QuiltSection";
import QuiltSquare from "@/components/QuiltSquare";
import { VirtualizedInfiniteList } from "@/components/VirtualizedInfiniteList";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { useCallback, useEffect, useMemo, useState } from "react";

const PRINCIPALS = [
	{ text: "Community-focused/centered", icon: "users" as const },
	{ text: "Council leadership approach (there is no \"I\" in team)", icon: "handshake" as const },
	{ text: "Non-partisan", icon: "scale" as const },
	{ text: "Understand this is long-term, ongoing work", icon: "clock" as const },
	{ text: "Perfection is the enemy of the good", icon: "target" as const },
	{ text: "Action grounded in and informed by knowledge/research/facts", icon: "bookOpen" as const },
	{ text: "An approach based on a mindset of abundance, focused on our shared humanity and well-being, centered on openness, learning, growth, and creativity", icon: "sparkles" as const },
	{ text: "A recognition of our shared interdependence with each other and our environment, grounded in an understanding of, and focus on, the systems within which we operate and the necessity for such systems to be accessible, supportive, and designed to engender health and well-being and improve the human condition for all individuals and the communities of which they are a part", icon: "globe" as const },
	{ text: "A belief that all can contribute positively to the common good, learn from each other, and should be welcomed in and empowered to make their unique positive contribution(s)", icon: "heartHandshake" as const },
	{ text: "A commitment to ethical, respectful engagement, grounded in thoughtful listening and based on the idea of principled struggle", icon: "messageCircle" as const },
	{ text: "A belief in the inherent value, dignity, and worth of ALL human beings and a society that should be structured to provide the most good to all", icon: "heart" as const },
	{ text: "The goal is a grassroots democracy that is truly responsive to the needs of the people", icon: "landmark" as const },
];

interface NearbyOrg {
	id: number;
	name: string;
	slug: string | null;
	distance_km: number | null;
}

interface ResourceTypeOption {
	id: number;
	label: string;
}

interface ResourceItem {
	id: number;
	organization_id: number;
	organization_name: string;
	resource_type_id: number;
	resource_type_ref: { id: number; label: string };
	title: string;
	description: string | null;
	link: string | null;
}

export default function HomeContent() {
	const [nearbyOrgs, setNearbyOrgs] = useState<NearbyOrg[]>([]);
	const [nearbyTotalCount, setNearbyTotalCount] = useState(0);
	const [nearbyLoading, setNearbyLoading] = useState(true);
	const [nearbyLoadingMore, setNearbyLoadingMore] = useState(false);
	const [locationSet, setLocationSet] = useState(false);

	const [resourceTypes, setResourceTypes] = useState<ResourceTypeOption[]>([]);
	const [selectedResourceTypeId, setSelectedResourceTypeId] = useState<number | null>(null);
	const [resourcesByType, setResourcesByType] = useState<ResourceItem[]>([]);
	const [resourcesLoading, setResourcesLoading] = useState(false);

	const fetchNearbyOrganizations = useCallback(async (offset = 0) => {
		if (offset === 0) setNearbyLoading(true);
		try {
			const locRes = await fetch("/api/location", { cache: "no-store", credentials: "include" });
			const locData = (await locRes.json()) as { location: { lat: number; lng: number; radiusMiles?: number } | null };
			const location = locData?.location;
			if (!location?.lat || !location?.lng) {
				setLocationSet(false);
				if (offset === 0) setNearbyOrgs([]);
				setNearbyTotalCount(0);
				return;
			}
			setLocationSet(true);
			const radiusMiles = location.radiusMiles ?? 50;
			const params = new URLSearchParams({
				lat: String(location.lat),
				lng: String(location.lng),
				radius_miles: String(radiusMiles),
				limit: String(DEFAULT_PAGE_SIZE),
				offset: String(offset),
			});
			const orgRes = await fetch(`/api/organizations?${params}`, { cache: "no-store", credentials: "include" });
			if (!orgRes.ok) {
				if (offset === 0) setNearbyOrgs([]);
				setNearbyTotalCount(0);
				return;
			}
			const orgData = (await orgRes.json()) as { organizations?: NearbyOrg[]; total_count?: number };
			const list = orgData.organizations ?? [];
			const total = orgData.total_count ?? 0;
			if (offset === 0) {
				setNearbyOrgs(list);
				setNearbyTotalCount(total);
			} else {
				setNearbyOrgs((prev) => [...prev, ...list]);
			}
		} catch {
			if (offset === 0) setNearbyOrgs([]);
		} finally {
			setNearbyLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchNearbyOrganizations(0);
	}, [fetchNearbyOrganizations]);

	// Refetch nearby organizations when user sets location in the header (e.g. ZIP or "Use my location")
	useEffect(() => {
		const handler = () => {
			fetchNearbyOrganizations(0);
		};
		window.addEventListener("a4a-location-set", handler);
		return () => window.removeEventListener("a4a-location-set", handler);
	}, [fetchNearbyOrganizations]);

	// Chunk nearby orgs into rows of 3 for virtualized grid
	const nearbyRows = useMemo(() => {
		const rows: NearbyOrg[][] = [];
		for (let i = 0; i < nearbyOrgs.length; i += 3) {
			rows.push(nearbyOrgs.slice(i, i + 3));
		}
		return rows;
	}, [nearbyOrgs]);

	const fetchResourceTypes = useCallback(async () => {
		try {
			const res = await fetch("/api/form-options");
			if (!res.ok) return;
			const data = (await res.json()) as { resourceTypes?: ResourceTypeOption[] };
			setResourceTypes(data.resourceTypes ?? []);
		} catch {
			setResourceTypes([]);
		}
	}, []);

	const fetchResourcesByType = useCallback(async (typeId: number) => {
		setResourcesLoading(true);
		try {
			const res = await fetch(`/api/resources?type=${encodeURIComponent(typeId)}`);
			if (!res.ok) {
				setResourcesByType([]);
				return;
			}
			const data = (await res.json()) as { resources?: ResourceItem[] };
			setResourcesByType(data.resources ?? []);
		} catch {
			setResourcesByType([]);
		} finally {
			setResourcesLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchResourceTypes();
	}, [fetchResourceTypes]);

	useEffect(() => {
		if (selectedResourceTypeId != null) {
			fetchResourcesByType(selectedResourceTypeId);
		} else {
			setResourcesByType([]);
		}
	}, [selectedResourceTypeId, fetchResourcesByType]);

	// Group resources by organization for display
	const resourcesByOrg = (() => {
		const map = new Map<number, { name: string; resources: ResourceItem[] }>();
		for (const r of resourcesByType) {
			const existing = map.get(r.organization_id);
			if (existing) {
				existing.resources.push(r);
			} else {
				map.set(r.organization_id, { name: r.organization_name, resources: [r] });
			}
		}
		return Array.from(map.entries()).map(([id, { name, resources }]) => ({ organization_id: id, name, resources }));
	})();

	const selectedTypeLabel = selectedResourceTypeId != null
		? resourceTypes.find((t) => t.id === selectedResourceTypeId)?.label ?? "Resources"
		: null;

	const RESOURCE_COLORS = ["bg-rose-500", "bg-violet-500", "bg-indigo-500", "bg-sky-500", "bg-amber-500"];

	return (
		<div className="min-h-screen flex flex-col">
			<main id="main-content" className="flex-1 p-4 sm:p-8" role="main">
				<div className="max-w-7xl mx-auto space-y-2">
					{/* What We Do: calendar, resources, get involved - compact squares, no extra space below */}
					<QuiltSection
						title="What We Do - WE BRING COMMUNITY TOGETHER"
						defaultOpen
						contentClassName="pb-0"
						gridClassName="auto-rows-[minmax(65px,auto)]"
					>
						<Link href="/calendar" className="block h-full min-h-[65px] col-span-4 row-span-3">
							<QuiltSquare
								image="/stitching.svg"
								title="Calendar"
								width={4}
								height={3}
								backgroundClassName="bg-teal-500"
								mediaFit="fill"
								priority
							>
								<div className="text-center">
									<p className="text-lg mb-2">Calendar</p>
									<p className="text-sm text-gray-600">
										Events, meetings, and important dates.
									</p>
								</div>
							</QuiltSquare>
						</Link>
						<Link href="/resources" className="block h-full min-h-[65px] col-span-4 row-span-3">
							<QuiltSquare
								image="/stitching.svg"
								title="Resources"
								width={4}
								height={3}
								backgroundClassName="bg-rose-500"
								mediaFit="fill"
							>
								<div className="text-center">
									<p className="text-lg mb-2">Resources</p>
									<p className="text-sm text-gray-600">
										Help, art & music, education, news, and more by type.
									</p>
								</div>
							</QuiltSquare>
						</Link>
						<Link href="/volunteer" className="block h-full min-h-[65px] col-span-4 row-span-3">
							<QuiltSquare
								image="/stitching.svg"
								title="Get Involved / Volunteer"
								width={4}
								height={3}
								backgroundClassName="bg-amber-500"
								mediaFit="fill"
							>
								<div className="text-center">
									<p className="text-lg mb-2">Get Involved / Volunteer</p>
									<p className="text-sm text-gray-600">
										Take action and find volunteer opportunities.
									</p>
								</div>
							</QuiltSquare>
						</Link>
					</QuiltSection>

					<QuiltSection title="Who Are We?" defaultOpen>
						<div className="col-span-12 h-[80vh] grid grid-cols-12 gap-4 min-h-0">
							<div className="col-span-12 md:col-span-8 min-h-0 rounded-lg overflow-hidden">
								<HeaderVideo />
							</div>
							<Link
								href="/principles"
								className="col-span-12 md:col-span-4 min-h-0 flex items-center justify-center rounded-lg bg-black/20 p-4 sm:p-6 hover:bg-black/30 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 focus:ring-offset-slate-900"
								aria-label="View Beloved Community mission statement and guiding principles"
							>
								<PrincipalCarousel principals={PRINCIPALS} />
							</Link>
						</div>
					</QuiltSection>

					{/* Resources by category: click a type to see orgs with resources of that type */}
					<QuiltSection
						title="Resources by category"
						defaultOpen
						contentClassName="pb-0"
						gridClassName="auto-rows-[minmax(65px,auto)]"
					>
						{selectedResourceTypeId == null ? (
							<>
								{resourceTypes.length === 0 ? (
									<div className="col-span-12 flex items-center justify-center min-h-[100px] text-gray-500 dark:text-gray-400">
										No resource categories yet.
									</div>
								) : (
									resourceTypes.map((rt, i) => (
										<button
											key={rt.id}
											type="button"
											onClick={() => setSelectedResourceTypeId(rt.id)}
											className="block h-full min-h-[65px] col-span-4 row-span-3 text-left rounded-xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900"
										>
											<QuiltSquare
												image="/stitching.svg"
												title={rt.label}
												width={4}
												height={3}
												backgroundClassName={RESOURCE_COLORS[i % RESOURCE_COLORS.length]}
												mediaFit="fill"
											>
												<div className="text-center">
													<p className="text-lg mb-2">{rt.label}</p>
													<p className="text-sm text-gray-600">
														Click to see organizations and resources
													</p>
												</div>
											</QuiltSquare>
										</button>
									))
								)}
							</>
						) : (
							<div className="col-span-12 space-y-4">
								<button
									type="button"
									onClick={() => setSelectedResourceTypeId(null)}
									className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
									aria-label="Back to all resource categories"
								>
									← Back to all categories
								</button>
								<h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
									{selectedTypeLabel}
								</h3>
								{resourcesLoading ? (
									<p className="text-gray-500 dark:text-gray-400" role="status" aria-live="polite">Loading…</p>
								) : resourcesByOrg.length === 0 ? (
									<p className="text-gray-500 dark:text-gray-400">
										No organizations have added resources in this category yet.
									</p>
								) : (
									<ul className="space-y-6">
										{resourcesByOrg.map(({ organization_id, name, resources }) => (
											<li
												key={organization_id}
												className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800/50 p-4 shadow-sm"
											>
												<p className="font-medium text-gray-900 dark:text-gray-100">{name}</p>
												<ul className="mt-2 space-y-2">
													{resources.map((r) => (
														<li key={r.id} className="text-sm text-gray-600 dark:text-gray-400 pl-2 border-l-2 border-rose-200 dark:border-rose-800">
															{r.link ? (
																<a
																	href={r.link}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="text-rose-600 dark:text-rose-400 hover:underline"
																	aria-label={`${r.title} (opens in new window)`}
																>
																	{r.title}
																</a>
															) : (
																<span>{r.title}</span>
															)}
															{r.description && (
																<span className="block text-gray-500 dark:text-gray-500 mt-0.5">
																	{r.description}
																</span>
															)}
														</li>
													))}
												</ul>
											</li>
										))}
									</ul>
								)}
							</div>
						)}
					</QuiltSection>

					{/* Organizations near you (within selected radius) - at bottom */}
					<QuiltSection
						title="Organizations near you"
						defaultOpen
						action={
							<Link
								href="/organizations"
								className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900"
								aria-label="Add your organization"
							>
								Add your organization
							</Link>
						}
					>
						{nearbyLoading ? (
							<div className="col-span-12 flex items-center justify-center min-h-[120px] text-gray-500 dark:text-gray-400" role="status" aria-live="polite">
								Loading…
							</div>
						) : nearbyOrgs.length === 0 ? (
							<div className="col-span-12 flex items-center justify-center min-h-[120px] text-gray-500 dark:text-gray-400 text-center px-4">
								{locationSet ? (
									<>
										No organizations with a set location fall within your radius. Try a larger radius or{" "}
										<Link href="/organizations" className="text-emerald-600 dark:text-emerald-400 underline hover:no-underline">
											browse all organizations
										</Link>
										.
									</>
								) : (
									"Set your location in the header (ZIP or use my location) and radius to see organizations near you."
								)}
							</div>
						) : (
							<div className="col-span-12 max-h-[60vh] min-h-[300px]">
								<VirtualizedInfiniteList<NearbyOrg[]>
									items={nearbyRows}
									totalCount={nearbyTotalCount}
									hasMore={nearbyOrgs.length < nearbyTotalCount}
									loadMore={() => {
										if (nearbyLoadingMore || nearbyOrgs.length >= nearbyTotalCount) return;
										setNearbyLoadingMore(true);
										fetchNearbyOrganizations(nearbyOrgs.length).finally(() => setNearbyLoadingMore(false));
									}}
									isLoadingMore={nearbyLoadingMore}
									estimateSize={120}
									getItemKey={(row, index) => `row-${index}`}
									className="h-full"
									renderItem={(row) => (
										<div className="grid grid-cols-12 gap-4 mb-4">
											{row.map((org) => (
												<Link
													key={org.id}
													href={org.slug ? `/organizations/${org.slug}` : "/organizations"}
													className="block h-full min-h-[100px] col-span-4"
												>
													<QuiltSquare
														image="/stitching.svg"
														title={org.name}
														width={4}
														height={3}
														backgroundClassName="bg-emerald-500"
														mediaFit="fill"
													>
														<div className="text-center">
															<p className="text-lg mb-2">{org.name}</p>
															<p className="text-sm text-gray-600">
																{org.distance_km != null
																	? `~${(org.distance_km / 1.60934).toFixed(0)} mi away`
																	: "View on organizations page"}
															</p>
														</div>
													</QuiltSquare>
												</Link>
											))}
										</div>
									)}
								/>
							</div>
						)}
					</QuiltSection>
				</div>
			</main>

			<footer className="py-8 px-4 text-center" role="contentinfo">
				<p className="mt-2 text-lg sm:text-xl md:text-2xl text-white/95 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] font-medium">
					Building community as though the revolution already happened
				</p>
			</footer>
		</div>
	);
}
