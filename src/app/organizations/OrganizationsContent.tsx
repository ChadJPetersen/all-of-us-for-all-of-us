"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsyncSelect from "react-select/async";
import CalendarModal, { isIcalOrWebcalLink } from "@/components/CalendarModal";
import { VirtualizedInfiniteList } from "@/components/VirtualizedInfiniteList";
import { formatDateTime, toIsoDatetimeWithOffset, getCurrentOffsetMinutes, getTimezoneOptions } from "@/lib/format";
import { usePrefersDark } from "@/lib/hooks";
import { resizeAndConvertToWebP } from "@/lib/image-utils";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import type { OrganizationWithVolunteerOpportunities } from "@/lib/types";

type LocationAreaOption = { value: string; label: string };

interface LocationType {
	id: number;
	label: string;
	sort_order: number;
}
interface PrimaryType {
	id: number;
	label: string;
}
interface LocationArea {
	id: number;
	location_type: number;
	code_int: number;
	name: string;
	parent_id: number | null;
}
interface OrgOption {
	id: number;
	name: string;
	slug: string | null;
}
interface ResourceTypeOption {
	id: number;
	label: string;
}
interface ScheduleTypeOption {
	id: number;
	label: string;
	sort_order: number;
}
interface VolunteerRoleTypeOption {
	id: number;
	label: string;
}

interface FormOptions {
	locationTypes: LocationType[];
	primaryTypes: PrimaryType[];
	locationAreas: LocationArea[];
	organizations: OrgOption[];
	resourceTypes?: ResourceTypeOption[];
	scheduleTypes?: ScheduleTypeOption[];
	volunteerRoleTypes?: VolunteerRoleTypeOption[];
}

// location_types id 1=Local, 2=State, 3=Country, 4=Global
// location_areas.location_type: 0=country, 1=state_province, 2=local
const LOCATION_TYPE_TO_AREA_TYPE: Record<number, number | null> = {
	1: 2, // Local (ZIP) -> areas with location_type 2
	2: 1, // State -> areas with location_type 1
	3: 0, // Country -> areas with location_type 0
	4: null, // Global -> no area
};

export default function OrganizationsContent() {
	const router = useRouter();
	const prefersDark = usePrefersDark();
	const [options, setOptions] = useState<FormOptions | null>(null);
	const [organizations, setOrganizations] = useState<OrganizationWithVolunteerOpportunities[]>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [submitStatus, setSubmitStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
	const [submitMessage, setSubmitMessage] = useState("");

	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [description, setDescription] = useState("");
	const [photoUrl, setPhotoUrl] = useState("");
	const [primaryTypeId, setPrimaryTypeId] = useState<string>("");
	const [locationTypeId, setLocationTypeId] = useState<string>("");
	const [locationAreaId, setLocationAreaId] = useState<string>("");
	const [selectedAreaLabel, setSelectedAreaLabel] = useState<string>("");
	const [parentId, setParentId] = useState<string>("");
	const [address, setAddress] = useState("");
	const [lat, setLat] = useState("");
	const [lng, setLng] = useState("");
	const [geocodeStatus, setGeocodeStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
	const [geocodeMessage, setGeocodeMessage] = useState("");
	const [photoUploadStatus, setPhotoUploadStatus] = useState<"idle" | "loading" | "error">("idle");
	const [photoUploadMessage, setPhotoUploadMessage] = useState("");

	const [showAddOrgForm, setShowAddOrgForm] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [expandedOrgId, setExpandedOrgId] = useState<number | null>(null);
	const [includePastOpportunities, setIncludePastOpportunities] = useState(false);

	// Add calendar link (per-org inline form)
	const [addCalOrgId, setAddCalOrgId] = useState<number | null>(null);
	const [addCalLink, setAddCalLink] = useState("");
	const [addCalName, setAddCalName] = useState("");
	const [addCalStatus, setAddCalStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
	const [addCalMessage, setAddCalMessage] = useState("");

	// Add volunteer opportunity (per-org inline form)
	const [addVoOrgId, setAddVoOrgId] = useState<number | null>(null);
	const [addVoTitle, setAddVoTitle] = useState("");
	const [addVoDescription, setAddVoDescription] = useState("");
	const [addVoLink, setAddVoLink] = useState("");
	const [addVoScheduleTypeId, setAddVoScheduleTypeId] = useState("");
	const [addVoRoleTypeId, setAddVoRoleTypeId] = useState("");
	const [addVoStartAt, setAddVoStartAt] = useState("");
	const [addVoEndAt, setAddVoEndAt] = useState("");
	const [addVoDueDate, setAddVoDueDate] = useState("");
	const [addVoIsRecurring, setAddVoIsRecurring] = useState(false);
	const [addVoRecurrenceDescription, setAddVoRecurrenceDescription] = useState("");
	const [addVoWindowStartDate, setAddVoWindowStartDate] = useState("");
	const [addVoWindowEndDate, setAddVoWindowEndDate] = useState("");
	const [addVoVolunteersNeeded, setAddVoVolunteersNeeded] = useState("");
	const [addVoLocationOverride, setAddVoLocationOverride] = useState("");
	const [addVoSlots, setAddVoSlots] = useState<{ start_at: string; end_at: string }[]>([]);
	const [addVoTimezoneOffset, setAddVoTimezoneOffset] = useState(() => getCurrentOffsetMinutes());
	const [addVoStatus, setAddVoStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
	const [addVoMessage, setAddVoMessage] = useState("");

	// Add resource (per-org inline form)
	const [addResOrgId, setAddResOrgId] = useState<number | null>(null);
	const [addResTypeId, setAddResTypeId] = useState<string>("");
	const [addResTitle, setAddResTitle] = useState("");
	const [addResDescription, setAddResDescription] = useState("");
	const [addResLink, setAddResLink] = useState("");
	const [addResStatus, setAddResStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
	const [addResMessage, setAddResMessage] = useState("");

	// Calendar modal (for ical/webcal links)
	const [calendarModal, setCalendarModal] = useState<{ url: string; label: string } | null>(null);

	// Delete in progress (by id) to show loading and prevent double submit
	const [deletingCalLinkId, setDeletingCalLinkId] = useState<number | null>(null);
	const [deletingVoId, setDeletingVoId] = useState<number | null>(null);
	const [deletingResId, setDeletingResId] = useState<number | null>(null);
	const [deletingOrgId, setDeletingOrgId] = useState<number | null>(null);

	const fetchOptions = useCallback(async () => {
		const res = await fetch("/api/form-options");
		if (!res.ok) return;
		const data = await res.json();
		setOptions(data as FormOptions);
	}, []);

	const fetchOrganizations = useCallback(async (includePast?: boolean, offset = 0) => {
		const params = new URLSearchParams({
			limit: String(DEFAULT_PAGE_SIZE),
			offset: String(offset),
		});
		if (includePast ?? false) params.set("include_past_opportunities", "1");
		const res = await fetch(`/api/organizations?${params}`);
		if (!res.ok) return;
		const data = (await res.json()) as {
			organizations?: OrganizationWithVolunteerOpportunities[];
			total_count?: number;
		};
		const list = data.organizations ?? [];
		const total = data.total_count ?? 0;
		if (offset === 0) {
			setOrganizations(list);
			setTotalCount(total);
		} else {
			setOrganizations((prev) => [...prev, ...list]);
		}
	}, []);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			setLoading(true);
			await Promise.all([fetchOptions(), fetchOrganizations(includePastOpportunities, 0)]);
			if (!cancelled) setLoading(false);
		})();
		return () => {
			cancelled = true;
		};
	}, [fetchOptions, fetchOrganizations]);

	const loadLocationAreaOptions = useCallback(
		(inputValue: string): Promise<LocationAreaOption[]> => {
			const lid = locationTypeId ? parseInt(locationTypeId, 10) : 0;
			const areaType = lid ? LOCATION_TYPE_TO_AREA_TYPE[lid] : null;
			const query = inputValue.trim();
			if (areaType == null || query.length < 1) return Promise.resolve([]);
			const params = new URLSearchParams({ location_type: String(areaType), q: query });
			return fetch(`/api/location-areas?${params}`)
				.then(
					(res) =>
						(res.ok ? res.json() : Promise.resolve({ areas: [] })) as Promise<{
							areas?: LocationArea[];
						}>
				)
				.then((data) =>
					(data.areas ?? []).map((la) => {
						const zipStr = String(la.code_int);
						const label = la.name.includes(zipStr)
							? la.name
							: `${la.name} (${la.code_int})`;
						return { value: String(la.id), label };
					})
				);
		},
		[locationTypeId]
	);

	const areaSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const areaSearchInputRef = useRef("");
	const loadLocationAreaOptionsDebounced = useCallback(
		(inputValue: string): Promise<LocationAreaOption[]> => {
			areaSearchInputRef.current = inputValue;
			if (areaSearchTimeoutRef.current) clearTimeout(areaSearchTimeoutRef.current);
			return new Promise((resolve) => {
				areaSearchTimeoutRef.current = setTimeout(() => {
					areaSearchTimeoutRef.current = null;
					const current = areaSearchInputRef.current;
					loadLocationAreaOptions(current).then((opts) => {
						if (areaSearchInputRef.current === current) resolve(opts);
					});
				}, 300);
			});
		},
		[loadLocationAreaOptions]
	);

	const locationAreaSelectValue = useMemo<LocationAreaOption | null>(() => {
		if (!locationAreaId || !selectedAreaLabel) return null;
		return { value: locationAreaId, label: selectedAreaLabel };
	}, [locationAreaId, selectedAreaLabel]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) {
			setSubmitMessage("Name is required.");
			setSubmitStatus("error");
			return;
		}
		if (!description.trim()) {
			setSubmitMessage("Description is required.");
			setSubmitStatus("error");
			return;
		}
		const locId = locationTypeId ? parseInt(locationTypeId, 10) : 0;
		if (!locId || locId < 1 || locId > 255) {
			setSubmitMessage("Please select a location type.");
			setSubmitStatus("error");
			return;
		}
		setSubmitStatus("loading");
		setSubmitMessage("");
		try {
			const res = await fetch("/api/organizations", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: name.trim(),
					slug: slug.trim() || undefined,
					description: description.trim(),
					photo_url: photoUrl.trim() || null,
					primary_type_id: primaryTypeId ? parseInt(primaryTypeId, 10) : null,
					location_type_id: locId,
					location_area_id: locationAreaId ? parseInt(locationAreaId, 10) : null,
					parent_id: parentId ? parseInt(parentId, 10) : null,
					address: address.trim() || null,
					lat: lat.trim() && !Number.isNaN(Number(lat)) ? Number(lat) : null,
					lng: lng.trim() && !Number.isNaN(Number(lng)) ? Number(lng) : null,
				}),
			});
			const data = (await res.json()) as {
				error?: string;
				organization?: { id: number; slug?: string | null };
			};
			if (!res.ok) {
				setSubmitMessage(data.error ?? "Failed to create organization.");
				setSubmitStatus("error");
				return;
			}
			if (data.organization?.id) {
				router.push(`/organizations/${data.organization.slug ?? data.organization.id}`);
				return;
			}
			setSubmitMessage("Organization added successfully.");
			setSubmitStatus("success");
			setName("");
			setSlug("");
			setDescription("");
			setPhotoUrl("");
			setPrimaryTypeId("");
			setLocationTypeId("");
			setLocationAreaId("");
			setSelectedAreaLabel("");
			setParentId("");
			setAddress("");
			setLat("");
			setLng("");
			await fetchOrganizations(includePastOpportunities);
		} catch {
			setSubmitMessage("Network error.");
			setSubmitStatus("error");
		}
	};

	const handleAddVolunteerOpportunity = async (e: React.FormEvent) => {
		e.preventDefault();
		if (addVoOrgId == null || !addVoTitle.trim()) {
			setAddVoMessage("Title is required.");
			setAddVoStatus("error");
			return;
		}
		setAddVoStatus("loading");
		setAddVoMessage("");
		try {
			const slots = addVoSlots
				.filter((s) => s.start_at.trim())
				.map((s) => ({
					start_at: toIsoDatetimeWithOffset(s.start_at, addVoTimezoneOffset),
					end_at: s.end_at.trim() ? toIsoDatetimeWithOffset(s.end_at, addVoTimezoneOffset) : null,
				}));
			const res = await fetch("/api/volunteer-opportunities", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					organization_id: addVoOrgId,
					title: addVoTitle.trim(),
					description: addVoDescription.trim() || undefined,
					link: addVoLink.trim() || undefined,
					schedule_type_id: addVoScheduleTypeId ? parseInt(addVoScheduleTypeId, 10) : undefined,
					role_type_id: addVoRoleTypeId ? parseInt(addVoRoleTypeId, 10) : undefined,
					start_at: addVoStartAt.trim() ? toIsoDatetimeWithOffset(addVoStartAt, addVoTimezoneOffset) : undefined,
					end_at: addVoEndAt.trim() ? toIsoDatetimeWithOffset(addVoEndAt, addVoTimezoneOffset) : undefined,
					due_date: addVoDueDate.trim() || undefined,
					is_recurring: addVoIsRecurring,
					recurrence_description: addVoRecurrenceDescription.trim() || undefined,
					window_start_date: addVoWindowStartDate.trim() || undefined,
					window_end_date: addVoWindowEndDate.trim() || undefined,
					volunteers_needed: addVoVolunteersNeeded.trim() ? parseInt(addVoVolunteersNeeded, 10) : undefined,
					location_override: addVoLocationOverride.trim() || undefined,
					slots: slots.length ? slots : undefined,
				}),
			});
			const data = await res.json();
			if (!res.ok) {
				setAddVoMessage((data as { error?: string }).error ?? "Failed to add volunteer opportunity.");
				setAddVoStatus("error");
				return;
			}
			setAddVoMessage("Volunteer opportunity added.");
			setAddVoStatus("success");
			setAddVoTitle("");
			setAddVoDescription("");
			setAddVoLink("");
			setAddVoScheduleTypeId("");
			setAddVoRoleTypeId("");
			setAddVoStartAt("");
			setAddVoEndAt("");
			setAddVoDueDate("");
			setAddVoIsRecurring(false);
			setAddVoRecurrenceDescription("");
			setAddVoWindowStartDate("");
			setAddVoWindowEndDate("");
			setAddVoVolunteersNeeded("");
			setAddVoLocationOverride("");
			setAddVoSlots([]);
			setAddVoOrgId(null);
			await fetchOrganizations(includePastOpportunities);
		} catch {
			setAddVoMessage("Network error.");
			setAddVoStatus("error");
		}
	};

	const openAddVoForm = (orgId: number) => {
		setAddVoOrgId(orgId);
		setAddVoTitle("");
		setAddVoDescription("");
		setAddVoLink("");
		setAddVoStatus("idle");
		setAddVoMessage("");
		setExpandedOrgId(orgId);
	};

	const handleAddResource = async (e: React.FormEvent) => {
		e.preventDefault();
		if (addResOrgId == null || !addResTitle.trim()) {
			setAddResMessage("Title is required.");
			setAddResStatus("error");
			return;
		}
		const typeId = addResTypeId ? parseInt(addResTypeId, 10) : 0;
		if (!typeId || typeId < 1) {
			setAddResMessage("Please select a resource type.");
			setAddResStatus("error");
			return;
		}
		setAddResStatus("loading");
		setAddResMessage("");
		try {
			const res = await fetch("/api/resources", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					organization_id: addResOrgId,
					resource_type_id: typeId,
					title: addResTitle.trim(),
					description: addResDescription.trim() || undefined,
					link: addResLink.trim() || undefined,
				}),
			});
			const data = await res.json();
			if (!res.ok) {
				setAddResMessage((data as { error?: string }).error ?? "Failed to add resource.");
				setAddResStatus("error");
				return;
			}
			setAddResMessage("Resource added.");
			setAddResStatus("success");
			setAddResTitle("");
			setAddResDescription("");
			setAddResLink("");
			setAddResTypeId("");
			setAddResOrgId(null);
			await fetchOrganizations(includePastOpportunities);
		} catch {
			setAddResMessage("Network error.");
			setAddResStatus("error");
		}
	};

	const openAddResourceForm = (orgId: number) => {
		setAddResOrgId(orgId);
		setAddResTypeId("");
		setAddResTitle("");
		setAddResDescription("");
		setAddResLink("");
		setAddResStatus("idle");
		setAddResMessage("");
		setExpandedOrgId(orgId);
	};

	const handleAddCalendarLink = async (e: React.FormEvent) => {
		e.preventDefault();
		if (addCalOrgId == null || !addCalLink.trim()) {
			setAddCalMessage("Calendar URL is required.");
			setAddCalStatus("error");
			return;
		}
		setAddCalStatus("loading");
		setAddCalMessage("");
		try {
			const res = await fetch("/api/organization-calendar-links", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					organization_id: addCalOrgId,
					link: addCalLink.trim(),
					...(addCalName.trim() && { name: addCalName.trim() }),
				}),
			});
			const data = await res.json();
			if (!res.ok) {
				setAddCalMessage((data as { error?: string }).error ?? "Failed to add calendar link.");
				setAddCalStatus("error");
				return;
			}
			setAddCalMessage("Calendar link added.");
			setAddCalStatus("success");
			setAddCalLink("");
			setAddCalName("");
			setAddCalOrgId(null);
			await fetchOrganizations(includePastOpportunities);
		} catch {
			setAddCalMessage("Network error.");
			setAddCalStatus("error");
		}
	};

	const openAddCalForm = (orgId: number) => {
		setAddCalOrgId(orgId);
		setAddCalLink("");
		setAddCalName("");
		setAddCalStatus("idle");
		setAddCalMessage("");
		setExpandedOrgId(orgId);
	};

	const handleDeleteCalendarLink = async (linkId: number) => {
		if (deletingCalLinkId != null) return;
		setDeletingCalLinkId(linkId);
		try {
			const res = await fetch(`/api/organization-calendar-links/${linkId}`, { method: "DELETE" });
			if (!res.ok) {
				const data = (await res.json()) as { error?: string };
				setAddCalMessage(data.error ?? "Failed to delete calendar link.");
				setAddCalStatus("error");
				return;
			}
			await fetchOrganizations(includePastOpportunities);
		} catch {
			setAddCalMessage("Network error.");
			setAddCalStatus("error");
		} finally {
			setDeletingCalLinkId(null);
		}
	};

	const handleDeleteVolunteerOpportunity = async (voId: number) => {
		if (deletingVoId != null) return;
		setDeletingVoId(voId);
		try {
			const res = await fetch(`/api/volunteer-opportunities/${voId}`, { method: "DELETE" });
			if (!res.ok) {
				const data = (await res.json()) as { error?: string };
				setAddVoMessage(data.error ?? "Failed to delete opportunity.");
				setAddVoStatus("error");
				return;
			}
			await fetchOrganizations(includePastOpportunities);
		} catch {
			setAddVoMessage("Network error.");
			setAddVoStatus("error");
		} finally {
			setDeletingVoId(null);
		}
	};

	const handleDeleteResource = async (resId: number) => {
		if (deletingResId != null) return;
		setDeletingResId(resId);
		try {
			const res = await fetch(`/api/resources/${resId}`, { method: "DELETE" });
			if (!res.ok) {
				const data = (await res.json()) as { error?: string };
				setAddResMessage(data.error ?? "Failed to delete resource.");
				setAddResStatus("error");
				return;
			}
			await fetchOrganizations(includePastOpportunities);
		} catch {
			setAddResMessage("Network error.");
			setAddResStatus("error");
		} finally {
			setDeletingResId(null);
		}
	};

	const handleDeleteOrganization = async (org: OrganizationWithVolunteerOpportunities) => {
		if (deletingOrgId != null) return;
		if (!confirm(`Delete "${org.name}"? This will remove all its calendar links, resources, and volunteer opportunities. This cannot be undone.`)) return;
		setDeletingOrgId(org.id);
		try {
			const slugOrId = org.slug ?? org.id;
			const res = await fetch(`/api/organizations/${slugOrId}`, { method: "DELETE" });
			if (!res.ok) {
				const data = (await res.json()) as { error?: string };
				setSubmitMessage(data.error ?? "Failed to delete organization.");
				setSubmitStatus("error");
				return;
			}
			setExpandedOrgId(null);
			await fetchOrganizations(includePastOpportunities);
		} catch {
			setSubmitMessage("Network error.");
			setSubmitStatus("error");
		} finally {
			setDeletingOrgId(null);
		}
	};

	const handleLookupCoordinates = async () => {
		const q = address.trim();
		if (!q) {
			setGeocodeMessage("Enter an address first.");
			setGeocodeStatus("error");
			return;
		}
		setGeocodeStatus("loading");
		setGeocodeMessage("");
		try {
			const res = await fetch(`/api/geocode?${new URLSearchParams({ address: q })}`);
			const data = (await res.json()) as { lat?: number; lng?: number; error?: string };
			if (!res.ok) {
				setGeocodeMessage(data.error ?? "Could not find coordinates.");
				setGeocodeStatus("error");
				return;
			}
			if (data.lat != null && data.lng != null) {
				setLat(String(data.lat));
				setLng(String(data.lng));
				setGeocodeMessage("Coordinates updated.");
				setGeocodeStatus("success");
			} else {
				setGeocodeMessage("Invalid response.");
				setGeocodeStatus("error");
			}
		} catch {
			setGeocodeMessage("Network error.");
			setGeocodeStatus("error");
		}
	};

	// Auto-clear success messages after a short delay
	useEffect(() => {
		if (submitStatus !== "success" && addCalStatus !== "success" && addVoStatus !== "success" && addResStatus !== "success") return;
		const t = setTimeout(() => {
			if (submitStatus === "success") setSubmitStatus("idle");
			if (addCalStatus === "success") setAddCalStatus("idle");
			if (addVoStatus === "success") setAddVoStatus("idle");
			if (addResStatus === "success") setAddResStatus("idle");
		}, 4000);
		return () => clearTimeout(t);
	}, [submitStatus, addCalStatus, addVoStatus, addResStatus]);

	const filteredOrganizations = useMemo(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return organizations;
		return organizations.filter(
			(org) =>
				org.name.toLowerCase().includes(q) ||
				(org.description && org.description.toLowerCase().includes(q)) ||
				org.primary_type_ref?.label.toLowerCase().includes(q) ||
				org.location_type_ref?.label.toLowerCase().includes(q) ||
				org.location_area_ref?.name.toLowerCase().includes(q) ||
				(org.address && org.address.toLowerCase().includes(q))
		);
	}, [organizations, searchQuery]);

	const loadMore = useCallback(() => {
		if (loadingMore || organizations.length >= totalCount || organizations.length === 0) return;
		setLoadingMore(true);
		fetchOrganizations(includePastOpportunities, organizations.length)
			.finally(() => setLoadingMore(false));
	}, [loadingMore, organizations.length, totalCount, includePastOpportunities, fetchOrganizations]);

	if (loading || !options) {
		return (
			<div className="flex flex-col items-center justify-center py-16 gap-4" role="status" aria-live="polite">
				<div className="h-10 w-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" aria-hidden />
				<p className="text-slate-500 dark:text-slate-400">Loading organizations…</p>
			</div>
		);
	}

	return (
		<div className="space-y-12">
			{/* Add organization form (only when open) */}
			{showAddOrgForm && (
				<section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 shadow-sm overflow-hidden">
					<h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-800/80 px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
						<span>Add an organization</span>
						<button
							type="button"
							onClick={() => setShowAddOrgForm(false)}
							className="text-sm font-normal text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
							aria-label="Cancel adding organization"
						>
							Cancel
						</button>
					</h2>
					<form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
					<div>
						<label htmlFor="org-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
							Name <span className="text-red-500">*</span>
						</label>
						<input
							id="org-name"
							type="text"
							required
							maxLength={500}
							value={name}
							onChange={(e) => setName(e.target.value)}
							className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
							placeholder="Organization name"
						/>
					</div>
					<div>
						<label htmlFor="org-slug" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
							Slug (optional)
						</label>
						<input
							id="org-slug"
							type="text"
							value={slug}
							onChange={(e) => setSlug(e.target.value)}
							pattern="[a-zA-Z0-9\-]+"
							title="Letters, numbers, and hyphens only (e.g. my-org-name). Leave blank to auto-generate from name."
							className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
							placeholder="url-friendly-id"
						/>
						<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Leave blank to auto-generate from name.</p>
					</div>
					<div>
						<label htmlFor="org-description" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
							Description <span className="text-red-500">*</span>
						</label>
						<textarea
							id="org-description"
							required
							rows={3}
							maxLength={10000}
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
							placeholder="What does this organization do? Who is it for?"
						/>
					</div>
					<div>
						<label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
							Photo (optional)
						</label>
						<p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
							Paste a URL or upload an image (max 10MB). Uploaded images are resized and converted to WebP.
						</p>
						<input
							type="text"
							value={photoUrl}
							onChange={(e) => {
								setPhotoUrl(e.target.value);
								setPhotoUploadMessage("");
							}}
							className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 mb-2"
							placeholder="https://… or /api/organization-photo/… (or upload below)"
						/>
						<input
							type="file"
							accept="image/*"
							disabled={photoUploadStatus === "loading"}
							className="block w-full text-sm text-slate-500 dark:text-slate-400 file:mr-2 file:rounded file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-emerald-700 dark:file:bg-emerald-900/30 dark:file:text-emerald-300 disabled:opacity-70"
							onChange={async (e) => {
								const file = e.target.files?.[0];
								e.target.value = "";
								if (!file) return;
								if (file.size > 10 * 1024 * 1024) {
									setPhotoUploadMessage("Image must be under 10MB.");
									setPhotoUploadStatus("error");
									return;
								}
								setPhotoUploadStatus("loading");
								setPhotoUploadMessage("");
								try {
									const blob = await resizeAndConvertToWebP(file, 1200, 0.85);
									const toUpload = blob ? new File([blob], "image.webp", { type: "image/webp" }) : file;
									const formData = new FormData();
									formData.set("file", toUpload);
									const res = await fetch("/api/upload-organization-photo", {
										method: "POST",
										body: formData,
									});
									const data = (await res.json()) as { url?: string; error?: string };
									if (!res.ok) {
										setPhotoUploadMessage(data.error ?? "Upload failed.");
										setPhotoUploadStatus("error");
										return;
									}
									if (data.url) {
										setPhotoUrl(data.url);
										setPhotoUploadMessage("Image uploaded.");
										setPhotoUploadStatus("idle");
									} else {
										setPhotoUploadMessage("Upload failed.");
										setPhotoUploadStatus("error");
									}
								} catch {
									setPhotoUploadMessage("Upload failed.");
									setPhotoUploadStatus("error");
								}
							}}
						/>
						{(photoUploadStatus === "loading" || photoUploadMessage) ? (
							<p
								className={`mt-1 text-xs ${photoUploadStatus === "error" ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`}
								role="status"
							>
								{photoUploadStatus === "loading" ? "Uploading…" : photoUploadMessage}
							</p>
						) : null}
					</div>
					<div>
						<label htmlFor="org-primary-type" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
							Primary type
						</label>
						<select
							id="org-primary-type"
							value={primaryTypeId}
							onChange={(e) => setPrimaryTypeId(e.target.value)}
							className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
						>
							<option value="">— Select —</option>
							{options.primaryTypes.map((pt) => (
								<option key={pt.id} value={pt.id}>
									{pt.label}
								</option>
							))}
						</select>
					</div>
					<div>
						<label htmlFor="org-location-type" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
							Location type <span className="text-red-500">*</span>
						</label>
						<select
							id="org-location-type"
							required
							value={locationTypeId}
							onChange={(e) => {
								setLocationTypeId(e.target.value);
								setLocationAreaId("");
								setSelectedAreaLabel("");
							}}
							className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
						>
							<option value="">— Select —</option>
							{options.locationTypes.map((lt) => (
								<option key={lt.id} value={lt.id}>
									{lt.label}
								</option>
							))}
						</select>
					</div>
					{locationTypeId && LOCATION_TYPE_TO_AREA_TYPE[parseInt(locationTypeId, 10)] != null && (
						<div>
							<label htmlFor="org-location-area" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
								Location area
							</label>
							<div className="location-area-select">
								<AsyncSelect<LocationAreaOption>
									inputId="org-location-area"
									placeholder="Type at least 1 character to search…"
									value={locationAreaSelectValue}
									loadOptions={loadLocationAreaOptionsDebounced}
									defaultOptions={false}
									cacheOptions
									onChange={(option) => {
										setLocationAreaId(option?.value ?? "");
										setSelectedAreaLabel(option?.label ?? "");
									}}
									noOptionsMessage={({ inputValue }) =>
										!inputValue.trim() ? "Type to search…" : "No matches."
									}
									loadingMessage={() => "Loading…"}
									classNamePrefix="location-area"
									styles={{
										singleValue: (base) => ({
											...base,
											color: prefersDark ? "#ffffff" : "rgb(15 23 42)",
										}),
										input: (base) => ({
											...base,
											color: prefersDark ? "#ffffff" : "rgb(15 23 42)",
										}),
									}}
									classNames={{
										control: () =>
											"!min-h-[42px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500",
										valueContainer: () => "px-3 py-2",
										input: () => "location-area-input",
										placeholder: () => "text-slate-500 dark:text-slate-400",
										menu: () => "!rounded-lg !border !border-slate-300 dark:!border-slate-600 !bg-white dark:!bg-slate-800 !shadow-lg",
										menuList: () => "py-1",
										option: (state) =>
											state.isFocused
												? "!bg-slate-100 dark:!bg-slate-700 !text-slate-900 dark:!text-slate-100"
												: "!bg-transparent !text-slate-900 dark:!text-slate-100",
										singleValue: () => "location-area-value",
										indicatorSeparator: () => "!bg-slate-300 dark:!bg-slate-600",
										dropdownIndicator: () => "!text-slate-500 dark:!text-slate-400",
										loadingIndicator: () => "!text-slate-500 dark:!text-slate-400",
									}}
								/>
							</div>
							<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
								Type to search (e.g. zip code or state/country name), then pick from the list.
							</p>
						</div>
					)}
					<div>
						<label htmlFor="org-parent" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
							Parent organization
						</label>
						<select
							id="org-parent"
							value={parentId}
							onChange={(e) => setParentId(e.target.value)}
							className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
						>
							<option value="">— None —</option>
							{options.organizations.map((o) => (
								<option key={o.id} value={o.id}>
									{o.name}
								</option>
							))}
						</select>
					</div>
					<div>
						<label htmlFor="org-address" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
							Address
						</label>
						<div className="flex gap-2">
							<input
								id="org-address"
								type="text"
								value={address}
								onChange={(e) => setAddress(e.target.value)}
								className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
								placeholder="Street, city, state, ZIP"
							/>
							<button
								type="button"
								onClick={handleLookupCoordinates}
								disabled={geocodeStatus === "loading"}
								className="rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-70"
								aria-label="Look up coordinates from address"
								aria-busy={geocodeStatus === "loading"}
							>
								{geocodeStatus === "loading" ? "Looking up…" : "Look up coordinates"}
							</button>
						</div>
						{geocodeMessage && (
							<p
								className={`mt-1 text-xs ${
									geocodeStatus === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
								}`}
								role="status"
							>
								{geocodeMessage}
							</p>
						)}
						<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
							Address is stored for display. Use &quot;Look up coordinates&quot; to fill latitude/longitude for distance sorting.
						</p>
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<label htmlFor="org-lat" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
								Latitude
							</label>
							<input
								id="org-lat"
								type="number"
								step="any"
								min={-90}
								max={90}
								value={lat}
								onChange={(e) => setLat(e.target.value)}
								className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
								placeholder="e.g. 41.31"
							/>
						</div>
						<div>
							<label htmlFor="org-lng" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
								Longitude
							</label>
							<input
								id="org-lng"
								type="number"
								step="any"
								min={-180}
								max={180}
								value={lng}
								onChange={(e) => setLng(e.target.value)}
								className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
								placeholder="e.g. -105.59"
							/>
						</div>
					</div>
					{submitMessage && (
						<p
							className={`text-sm ${
								submitStatus === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
							}`}
							role="status"
							aria-live="polite"
						>
							{submitMessage}
						</p>
					)}
					<button
						type="submit"
						disabled={submitStatus === "loading"}
						className="w-full sm:w-auto rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium px-6 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
						aria-busy={submitStatus === "loading"}
					>
						{submitStatus === "loading" ? "Adding…" : "Add organization"}
					</button>
				</form>
				</section>
			)}

			{/* List of organizations */}
			<section>
				<div className="flex flex-wrap items-center justify-between gap-3 mb-4">
					<h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
						{organizations.length === 0
							? "Organizations"
							: searchQuery.trim()
								? `Organizations (${filteredOrganizations.length} of ${organizations.length})`
								: totalCount > 0 && organizations.length < totalCount
									? `Organizations (${organizations.length} of ${totalCount})`
									: `Organizations (${organizations.length})`}
					</h2>
					<button
						type="button"
						onClick={() => setShowAddOrgForm(true)}
						className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-5 py-2 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
						aria-label="Add new organization"
					>
						Add organization
					</button>
				</div>
				{organizations.length > 3 && (
					<div className="mb-4">
						<label htmlFor="org-search" className="sr-only">
							Search organizations
						</label>
						<input
							id="org-search"
							type="search"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search by name, description, type, location, or address…"
							className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
							aria-describedby={searchQuery.trim() ? "org-search-hint" : undefined}
						/>
						{searchQuery.trim() && (
							<p id="org-search-hint" className="mt-1 text-sm text-slate-500 dark:text-slate-400">
								Showing {filteredOrganizations.length} matching {filteredOrganizations.length === 1 ? "organization" : "organizations"}.
							</p>
						)}
					</div>
				)}
				{organizations.length > 0 && (
					<div className="mb-4">
						<label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
							<input
								type="checkbox"
								checked={includePastOpportunities}
							onChange={(e) => {
								const v = e.target.checked;
								setIncludePastOpportunities(v);
								fetchOrganizations(v, 0);
							}}
								className="rounded border-slate-300 dark:border-slate-600"
							/>
							Include past volunteer opportunities
						</label>
					</div>
				)}
				{organizations.length === 0 ? (
					<div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/30 p-8 sm:p-12 text-center">
						<p className="text-slate-600 dark:text-slate-300 text-lg font-medium">No organizations yet</p>
						<p className="mt-2 text-slate-500 dark:text-slate-400 max-w-md mx-auto">
							Be the first to add one. You can include a calendar link, volunteer opportunities, and resources so others can find and connect.
						</p>
						<button
							type="button"
							onClick={() => setShowAddOrgForm(true)}
							className="mt-6 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-3 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
							aria-label="Add your first organization"
						>
							Add your first organization
						</button>
					</div>
				) : filteredOrganizations.length === 0 ? (
					<div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/30 p-6 text-center">
						<p className="text-slate-600 dark:text-slate-300">No organizations match &quot;{searchQuery}&quot;</p>
						<button
							type="button"
							onClick={() => setSearchQuery("")}
							className="mt-3 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
							aria-label="Clear search and show all organizations"
						>
							Clear search
						</button>
					</div>
				) : (
					<VirtualizedInfiniteList<OrganizationWithVolunteerOpportunities>
						items={filteredOrganizations}
						totalCount={totalCount}
						hasMore={organizations.length < totalCount}
						loadMore={loadMore}
						isLoadingMore={loadingMore}
						estimateSize={120}
						getItemKey={(org) => org.id}
						className="max-h-[70vh] min-h-[400px]"
						renderItem={(org) => {
							const isExpanded = expandedOrgId === org.id;
							return (
								<div
									className="mb-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 shadow-sm overflow-hidden"
								>
										<div
										className="flex flex-wrap items-center gap-2 p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
										onClick={() => setExpandedOrgId(isExpanded ? null : org.id)}
										onKeyDown={(e) => {
											if (e.key === "Enter" || e.key === " ") {
												e.preventDefault();
												setExpandedOrgId(isExpanded ? null : org.id);
											}
										}}
										role="button"
										tabIndex={0}
										aria-expanded={isExpanded}
										aria-controls={`org-details-${org.id}`}
										id={`org-summary-${org.id}`}
										aria-label={isExpanded ? `Collapse ${org.name} details` : `Expand ${org.name} details`}
									>
										<span
											className={`inline-flex shrink-0 text-slate-400 dark:text-slate-500 transition-transform ${isExpanded ? "rotate-90" : ""}`}
											aria-hidden
										>
											▶
										</span>
										<div className="min-w-0 flex-1">
											<p className="font-medium text-slate-900 dark:text-slate-100">
												<Link
													href={`/organizations/${org.slug ?? org.id}`}
													className="text-rose-600 dark:text-rose-400 hover:underline"
													onClick={(e) => e.stopPropagation()}
												>
													{org.name}
												</Link>
											</p>
											<div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0 text-sm text-slate-500 dark:text-slate-400">
												{org.primary_type_ref && <span>{org.primary_type_ref.label}</span>}
												{org.location_type_ref && <span>{org.location_type_ref.label}</span>}
												{org.location_area_ref && <span>{org.location_area_ref.name}</span>}
												{org.distance_km != null && (
													<span>~{(org.distance_km / 1.60934).toFixed(0)} mi away</span>
												)}
											</div>
											{org.address && (
												<p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{org.address}</p>
											)}
										</div>
										{org.photo_url?.trim() ? (
											<div className="shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700">
												<img
													src={org.photo_url.trim()}
													alt=""
													className="w-full h-full object-cover"
												/>
											</div>
										) : null}
									</div>
									<div
										id={`org-details-${org.id}`}
										role="region"
										aria-labelledby={`org-summary-${org.id}`}
										className={isExpanded ? "border-t border-slate-200 dark:border-slate-600" : "hidden"}
									>
										<div className="p-4 pt-3 bg-slate-50/50 dark:bg-slate-800/30 space-y-0">
											{org.description && (
												<p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{org.description}</p>
											)}
											<div className="pt-3 border-t border-slate-200 dark:border-slate-600 first:border-t-0 first:pt-0">
												<p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Calendar links</p>
												{org.calendar_links?.length ? (
													<ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-0.5">
														{org.calendar_links.map((item, i) => {
															const displayName = item.name?.trim() || (org.calendar_links!.length > 1 ? `${org.name} (${i + 1})` : org.name);
															return (
																<li key={item.id} className="flex items-center gap-1 flex-wrap">
																	<span>
																		{isIcalOrWebcalLink(item.link) ? (
																			<button
																				type="button"
																				onClick={() => setCalendarModal({
																					url: item.link,
																					label: displayName,
																				})}
																				className="text-emerald-600 dark:text-emerald-400 hover:underline text-left"
																			>
																				{displayName}
																			</button>
																		) : (
																			<a href={item.link} target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline">
																				{displayName}
																			</a>
																		)}
																	</span>
																	<button
																		type="button"
																		onClick={() => handleDeleteCalendarLink(item.id)}
																		disabled={deletingCalLinkId === item.id}
																		className="shrink-0 rounded p-0.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
																		title="Delete calendar link"
																		aria-label={`Delete calendar link ${displayName}`}
																	>
																		{deletingCalLinkId === item.id ? (
																			<span className="inline-block h-4 w-4 rounded-full border-2 border-red-500 border-t-transparent animate-spin" aria-hidden />
																		) : (
																			<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
																		)}
																	</button>
																</li>
															);
														})}
													</ul>
												) : (
													<p className="text-sm text-slate-500 dark:text-slate-400">None yet.</p>
												)}
												{addCalOrgId === org.id ? (
													<form onSubmit={handleAddCalendarLink} className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/80 space-y-2">
														<details open className="text-xs text-slate-600 dark:text-slate-400">
															<summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-300">What calendar format?</summary>
															<p className="mt-2">
																Use an <strong>ICS</strong> (.ics) or <strong>webcal</strong> feed URL. These are standard subscription links: Google Calendar (Settings → Integrate calendar → Secret address), Outlook (Share → Publish calendar), and Apple Calendar (File → New → Calendar Subscription) all provide them. <em>webcal://</em> is the same as <em>https://</em> but tells apps to subscribe; we accept both.
															</p>
														</details>
														<input
															type="url"
															required
															value={addCalLink}
															onChange={(e) => setAddCalLink(e.target.value)}
															placeholder="https://… or webcal://… (calendar URL)"
															className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm"
														/>
														<label htmlFor="add-cal-name" className="block text-xs font-medium text-slate-600 dark:text-slate-400">Calendar name (optional)</label>
														<input
															id="add-cal-name"
															type="text"
															value={addCalName}
															onChange={(e) => setAddCalName(e.target.value)}
															placeholder="e.g. Main events"
															className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm"
														/>
														{addCalMessage && (
															<p className={`text-xs ${addCalStatus === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>{addCalMessage}</p>
														)}
														<div className="flex gap-2">
															<button type="submit" disabled={addCalStatus === "loading"} className="rounded bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white text-sm font-medium px-3 py-1.5">{addCalStatus === "loading" ? "Adding…" : "Add"}</button>
															<button type="button" onClick={() => setAddCalOrgId(null)} className="rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm px-3 py-1.5">Cancel</button>
														</div>
													</form>
												) : (
													<button type="button" onClick={() => openAddCalForm(org.id)} className="mt-1 text-sm text-teal-600 dark:text-teal-400 hover:underline">Add calendar link</button>
												)}
											</div>
											<div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
												<p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Contact</p>
												{org.contacts?.length ? (
													<>
														<ul className="list-none text-sm text-slate-600 dark:text-slate-400 space-y-1">
															{org.contacts.map((c) => (
																<li key={c.id}>
																	<span className="font-medium text-slate-700 dark:text-slate-300">{c.entity_name}</span>
																	<span className="text-slate-500 dark:text-slate-400"> — {c.contact_purpose}</span>
																	{(c.phone || c.email) && (
																		<span className="text-slate-500 dark:text-slate-400">
																			{c.phone && <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="text-emerald-600 dark:text-emerald-400 hover:underline" onClick={(e) => e.stopPropagation()}>{c.phone}</a>}
																			{c.phone && c.email && " · "}
																			{c.email && <a href={`mailto:${c.email}`} className="text-emerald-600 dark:text-emerald-400 hover:underline" onClick={(e) => e.stopPropagation()}>{c.email}</a>}
																		</span>
																	)}
																</li>
															))}
														</ul>
														<Link href={`/organizations/${org.slug ?? org.id}`} className="mt-1 inline-block text-sm text-emerald-600 dark:text-emerald-400 hover:underline" onClick={(e) => e.stopPropagation()}>View full details and add contacts</Link>
													</>
												) : (
													<p className="text-sm text-slate-500 dark:text-slate-400">
														None yet. <Link href={`/organizations/${org.slug ?? org.id}`} className="text-emerald-600 dark:text-emerald-400 hover:underline" onClick={(e) => e.stopPropagation()}>Add contacts on organization page</Link>
													</p>
												)}
											</div>
											<div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
												<p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Volunteer opportunities</p>
												{org.volunteer_opportunities?.length ? (
													<ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-0.5">
														{org.volunteer_opportunities.map((vo) => {
															let timeLine = "";
															if (vo.start_at) timeLine = formatDateTime(vo.start_at);
															else if ((vo.slots?.length ?? 0) > 0) timeLine = formatDateTime(vo.slots![0].start_at);
															else if (vo.due_date) timeLine = `Due ${vo.due_date}`;
															else if (vo.is_recurring && vo.recurrence_description) timeLine = vo.recurrence_description;
															else if (vo.window_start_date || vo.window_end_date) timeLine = [vo.window_start_date, vo.window_end_date].filter(Boolean).join(" – ");
															return (
																<li key={vo.id} className="flex items-center gap-1 flex-wrap">
																	<span>
																		{vo.schedule_type_ref && <span className="text-amber-600 dark:text-amber-400">[{vo.schedule_type_ref.label}] </span>}
																		{vo.role_type_ref && <span className="text-slate-500 dark:text-slate-400">[{vo.role_type_ref.label}] </span>}
																		{vo.link ? (
																			<a href={vo.link} target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline">{vo.title}</a>
																		) : (
																			<span>{vo.title}</span>
																		)}
																		{timeLine && <span className="text-slate-500 dark:text-slate-400"> — {timeLine}</span>}
																		{vo.description && <span className="text-slate-500 dark:text-slate-400">{" — "}{vo.description}</span>}
																	</span>
																	<button
																		type="button"
																		onClick={() => handleDeleteVolunteerOpportunity(vo.id)}
																		disabled={deletingVoId === vo.id}
																		className="shrink-0 rounded p-0.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
																		title="Delete volunteer opportunity"
																		aria-label={`Delete volunteer opportunity ${vo.title}`}
																	>
																		{deletingVoId === vo.id ? (
																			<span className="inline-block h-4 w-4 rounded-full border-2 border-red-500 border-t-transparent animate-spin" aria-hidden />
																		) : (
																			<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
																		)}
																	</button>
																</li>
															);
														})}
													</ul>
												) : (
													<p className="text-sm text-slate-500 dark:text-slate-400">None yet.</p>
												)}
												{addVoOrgId === org.id ? (
													<form onSubmit={handleAddVolunteerOpportunity} className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/80 space-y-2">
														<label htmlFor={`add-vo-${org.id}-title`} className="block text-xs font-medium text-slate-600 dark:text-slate-400">Title</label>
														<input id={`add-vo-${org.id}-title`} type="text" required maxLength={500} value={addVoTitle} onChange={(e) => setAddVoTitle(e.target.value)} placeholder="e.g. Event setup crew" className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm" />
														<label htmlFor={`add-vo-${org.id}-description`} className="block text-xs font-medium text-slate-600 dark:text-slate-400">Description (optional)</label>
														<input id={`add-vo-${org.id}-description`} type="text" value={addVoDescription} onChange={(e) => setAddVoDescription(e.target.value)} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm" />
														<label htmlFor={`add-vo-${org.id}-link`} className="block text-xs font-medium text-slate-600 dark:text-slate-400">Link (optional)</label>
														<input id={`add-vo-${org.id}-link`} type="url" value={addVoLink} onChange={(e) => setAddVoLink(e.target.value)} placeholder="https://…" className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm" />
														{options?.scheduleTypes?.length ? (
															<>
																<label htmlFor={`add-vo-${org.id}-schedule-type`} className="block text-xs font-medium text-slate-600 dark:text-slate-400">Schedule type (optional)</label>
																<select id={`add-vo-${org.id}-schedule-type`} value={addVoScheduleTypeId} onChange={(e) => setAddVoScheduleTypeId(e.target.value)} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm">
																	<option value="">— Select —</option>
																	{options.scheduleTypes.map((st) => (
																		<option key={st.id} value={st.id}>{st.label}</option>
																	))}
																</select>
															</>
														) : null}
														{options?.volunteerRoleTypes?.length ? (
															<>
																<label htmlFor={`add-vo-${org.id}-role`} className="block text-xs font-medium text-slate-600 dark:text-slate-400">Role (optional)</label>
																<select id={`add-vo-${org.id}-role`} value={addVoRoleTypeId} onChange={(e) => setAddVoRoleTypeId(e.target.value)} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm">
																	<option value="">— Select —</option>
																	{options.volunteerRoleTypes.map((rt) => (
																		<option key={rt.id} value={rt.id}>{rt.label}</option>
																	))}
																</select>
															</>
														) : null}
														<div className="grid grid-cols-2 gap-2">
															<div>
																<label htmlFor={`add-vo-${org.id}-start`} className="block text-xs font-medium text-slate-600 dark:text-slate-400">Start date & time (optional)</label>
																<input id={`add-vo-${org.id}-start`} type="datetime-local" value={addVoStartAt} onChange={(e) => setAddVoStartAt(e.target.value)} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm" />
															</div>
															<div>
																<label htmlFor={`add-vo-${org.id}-end`} className="block text-xs font-medium text-slate-600 dark:text-slate-400">End date & time (optional)</label>
																<input id={`add-vo-${org.id}-end`} type="datetime-local" value={addVoEndAt} onChange={(e) => setAddVoEndAt(e.target.value)} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm" />
															</div>
														</div>
														<div>
															<label htmlFor={`add-vo-${org.id}-timezone`} className="block text-xs font-medium text-slate-600 dark:text-slate-400">Timezone for dates above</label>
															<select id={`add-vo-${org.id}-timezone`} value={addVoTimezoneOffset} onChange={(e) => setAddVoTimezoneOffset(Number(e.target.value))} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm">
																{getTimezoneOptions(addVoTimezoneOffset).map((opt, i) => (
																	<option key={`${opt.value}-${i}`} value={opt.value}>{opt.label}</option>
																))}
															</select>
														</div>
														<label htmlFor={`add-vo-${org.id}-due-date`} className="block text-xs font-medium text-slate-600 dark:text-slate-400">Due date (optional)</label>
														<input id={`add-vo-${org.id}-due-date`} type="date" value={addVoDueDate} onChange={(e) => setAddVoDueDate(e.target.value)} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm" />
														<label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
															<input type="checkbox" checked={addVoIsRecurring} onChange={(e) => setAddVoIsRecurring(e.target.checked)} className="rounded border-slate-300 dark:border-slate-600" />
															Recurring
														</label>
														{addVoIsRecurring ? (
															<>
																<label htmlFor={`add-vo-${org.id}-recurrence`} className="block text-xs font-medium text-slate-600 dark:text-slate-400">Recurrence description</label>
																<input id={`add-vo-${org.id}-recurrence`} type="text" value={addVoRecurrenceDescription} onChange={(e) => setAddVoRecurrenceDescription(e.target.value)} placeholder="e.g. Every Tuesday 6–8pm" className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm" />
															</>
														) : null}
														<div className="grid grid-cols-2 gap-2">
															<div>
																<label htmlFor={`add-vo-${org.id}-window-start`} className="block text-xs font-medium text-slate-600 dark:text-slate-400">Window start (optional)</label>
																<input id={`add-vo-${org.id}-window-start`} type="date" value={addVoWindowStartDate} onChange={(e) => setAddVoWindowStartDate(e.target.value)} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm" />
															</div>
															<div>
																<label htmlFor={`add-vo-${org.id}-window-end`} className="block text-xs font-medium text-slate-600 dark:text-slate-400">Window end (optional)</label>
																<input id={`add-vo-${org.id}-window-end`} type="date" value={addVoWindowEndDate} onChange={(e) => setAddVoWindowEndDate(e.target.value)} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm" />
															</div>
														</div>
														<label htmlFor={`add-vo-${org.id}-volunteers-needed`} className="block text-xs font-medium text-slate-600 dark:text-slate-400">Volunteers needed (optional)</label>
														<input id={`add-vo-${org.id}-volunteers-needed`} type="number" min={1} max={999999} value={addVoVolunteersNeeded} onChange={(e) => setAddVoVolunteersNeeded(e.target.value)} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm" />
														<label htmlFor={`add-vo-${org.id}-location`} className="block text-xs font-medium text-slate-600 dark:text-slate-400">Location for this opportunity (optional)</label>
														<input id={`add-vo-${org.id}-location`} type="text" value={addVoLocationOverride} onChange={(e) => setAddVoLocationOverride(e.target.value)} placeholder="Address or place name" className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm" />
														{addVoSlots.length > 0 ? (
															<div className="space-y-1">
																<p className="text-xs font-medium text-slate-600 dark:text-slate-400">Additional time slots</p>
																{addVoSlots.map((slot, i) => (
																	<div key={i} className="grid grid-cols-2 gap-1">
																		<div>
																			<label htmlFor={`add-vo-${org.id}-slot-${i}-start`} className="sr-only">Slot {i + 1} start</label>
																			<input id={`add-vo-${org.id}-slot-${i}-start`} type="datetime-local" value={slot.start_at} onChange={(e) => setAddVoSlots((prev) => prev.map((s, j) => j === i ? { ...s, start_at: e.target.value } : s))} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1 text-sm" />
																		</div>
																		<div className="flex gap-1">
																			<div className="flex-1">
																				<label htmlFor={`add-vo-${org.id}-slot-${i}-end`} className="sr-only">Slot {i + 1} end</label>
																				<input id={`add-vo-${org.id}-slot-${i}-end`} type="datetime-local" value={slot.end_at} onChange={(e) => setAddVoSlots((prev) => prev.map((s, j) => j === i ? { ...s, end_at: e.target.value } : s))} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1 text-sm" />
																			</div>
																			<button type="button" onClick={() => setAddVoSlots((prev) => prev.filter((_, j) => j !== i))} className="text-slate-500 hover:text-red-600 text-sm px-1" aria-label="Remove slot">×</button>
																		</div>
																	</div>
																))}
															</div>
														) : null}
														<button type="button" onClick={() => setAddVoSlots((prev) => [...prev, { start_at: "", end_at: "" }])} className="text-sm text-teal-600 dark:text-teal-400 hover:underline">+ Add time slot</button>
														{addVoMessage && <p className={`text-xs ${addVoStatus === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>{addVoMessage}</p>}
														<div className="flex gap-2">
															<button type="submit" disabled={addVoStatus === "loading"} className="rounded bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white text-sm font-medium px-3 py-1.5">{addVoStatus === "loading" ? "Adding…" : "Add"}</button>
															<button type="button" onClick={() => setAddVoOrgId(null)} className="rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm px-3 py-1.5">Cancel</button>
														</div>
													</form>
												) : (
													<button type="button" onClick={() => openAddVoForm(org.id)} className="mt-1 text-sm text-amber-600 dark:text-amber-400 hover:underline">Add volunteer opportunity</button>
												)}
											</div>
											{options?.resourceTypes?.length ? (
												<div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
													<p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Resources</p>
													{org.resources?.length ? (
														<ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-0.5">
															{org.resources.map((res) => (
																<li key={res.id} className="flex items-center gap-1 flex-wrap">
																	<span>
																		{res.resource_type_ref && <span className="text-slate-500 dark:text-slate-400">[{res.resource_type_ref.label}]{" "}</span>}
																		{res.link ? (
																			<a href={res.link} target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline">{res.title}</a>
																		) : (
																			<span>{res.title}</span>
																		)}
																		{res.description && <span className="text-slate-500 dark:text-slate-400">{" — "}{res.description}</span>}
																	</span>
																	<button
																		type="button"
																		onClick={() => handleDeleteResource(res.id)}
																		disabled={deletingResId === res.id}
																		className="shrink-0 rounded p-0.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
																		title="Delete resource"
																		aria-label={`Delete resource ${res.title}`}
																	>
																		{deletingResId === res.id ? (
																			<span className="inline-block h-4 w-4 rounded-full border-2 border-red-500 border-t-transparent animate-spin" aria-hidden />
																		) : (
																			<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
																		)}
																	</button>
																</li>
															))}
														</ul>
													) : (
														<p className="text-sm text-slate-500 dark:text-slate-400">None yet.</p>
													)}
													{addResOrgId === org.id ? (
														<form onSubmit={handleAddResource} className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/80 space-y-2">
															<select required value={addResTypeId} onChange={(e) => setAddResTypeId(e.target.value)} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm">
																<option value="">— Type —</option>
																{options.resourceTypes.map((rt) => (
																	<option key={rt.id} value={rt.id}>{rt.label}</option>
																))}
															</select>
															<input type="text" required maxLength={500} value={addResTitle} onChange={(e) => setAddResTitle(e.target.value)} placeholder="Resource title" className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm" />
															<input type="text" value={addResDescription} onChange={(e) => setAddResDescription(e.target.value)} placeholder="Description (optional)" className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm" />
															<input type="url" value={addResLink} onChange={(e) => setAddResLink(e.target.value)} placeholder="Link (optional)" className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm" />
															{addResMessage && <p className={`text-xs ${addResStatus === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>{addResMessage}</p>}
															<div className="flex gap-2">
																<button type="submit" disabled={addResStatus === "loading"} className="rounded bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white text-sm font-medium px-3 py-1.5">{addResStatus === "loading" ? "Adding…" : "Add"}</button>
																<button type="button" onClick={() => setAddResOrgId(null)} className="rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm px-3 py-1.5">Cancel</button>
															</div>
														</form>
													) : (
														<button type="button" onClick={() => openAddResourceForm(org.id)} className="mt-1 text-sm text-rose-600 dark:text-rose-400 hover:underline">Add resource</button>
													)}
												</div>
											) : null}
											<div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
												<button
													type="button"
													onClick={() => handleDeleteOrganization(org)}
													disabled={deletingOrgId === org.id}
													className="text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
													aria-label={`Delete organization ${org.name}`}
												>
													{deletingOrgId === org.id ? "Deleting…" : "Delete organization"}
												</button>
											</div>
										</div>
									</div>
								</div>
							);
						}}
					/>
				)}
			</section>
			<CalendarModal
				open={calendarModal != null}
				onClose={() => setCalendarModal(null)}
				url={calendarModal?.url ?? ""}
				label={calendarModal?.label ?? ""}
			/>
		</div>
	);
}
