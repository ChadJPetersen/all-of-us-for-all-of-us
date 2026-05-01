"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsyncSelect from "react-select/async";
import { usePrefersDark } from "@/lib/hooks";
import { resizeAndConvertToWebP } from "@/lib/image-utils";
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

interface FormOptions {
	locationTypes: LocationType[];
	primaryTypes: PrimaryType[];
	organizations: OrgOption[];
}

// location_types id 1=Local, 2=State, 3=Country, 4=Global
// location_areas.location_type: 0=country, 1=state_province, 2=local
const LOCATION_TYPE_TO_AREA_TYPE: Record<number, number | null> = {
	1: 2,
	2: 1,
	3: 0,
	4: null,
};

export default function OrganizationEdit({ slug }: { slug: string }) {
	const router = useRouter();
	const prefersDark = usePrefersDark();
	const [org, setOrg] = useState<OrganizationWithVolunteerOpportunities | null>(null);
	const [options, setOptions] = useState<FormOptions | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [name, setName] = useState("");
	const [slugField, setSlugField] = useState("");
	const [description, setDescription] = useState("");
	const [photoUrl, setPhotoUrl] = useState("");
	const [primaryTypeId, setPrimaryTypeId] = useState("");
	const [locationTypeId, setLocationTypeId] = useState("");
	const [locationAreaId, setLocationAreaId] = useState("");
	const [selectedAreaLabel, setSelectedAreaLabel] = useState("");
	const [parentId, setParentId] = useState("");
	const [address, setAddress] = useState("");
	const [lat, setLat] = useState("");
	const [lng, setLng] = useState("");
	const [submitStatus, setSubmitStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
	const [submitMessage, setSubmitMessage] = useState("");
	const [geocodeStatus, setGeocodeStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
	const [geocodeMessage, setGeocodeMessage] = useState("");
	const [photoUploadStatus, setPhotoUploadStatus] = useState<"idle" | "loading" | "error">("idle");
	const [photoUploadMessage, setPhotoUploadMessage] = useState("");

	// Load org and form options
	useEffect(() => {
		let cancelled = false;
		async function load() {
			try {
				const [orgRes, optionsRes] = await Promise.all([
					fetch(`/api/organizations/${encodeURIComponent(slug)}`),
					fetch("/api/form-options"),
				]);
				if (!orgRes.ok) {
					if (orgRes.status === 404) setError("Organization not found.");
					else setError("Failed to load organization.");
					return;
				}
				const orgData = (await orgRes.json()) as OrganizationWithVolunteerOpportunities;
				const optionsData = (await optionsRes.json()) as FormOptions;
				if (cancelled) return;
				setOrg(orgData);
				setOptions(optionsData);
				setName(orgData.name);
				setSlugField(orgData.slug ?? "");
				setDescription(orgData.description ?? "");
				setPhotoUrl(orgData.photo_url ?? "");
				setPrimaryTypeId(orgData.primary_type_id != null ? String(orgData.primary_type_id) : "");
				setLocationTypeId(String(orgData.location_type_id));
				setLocationAreaId(orgData.location_area_id != null ? String(orgData.location_area_id) : "");
				// Match add page format: name, or "name (code_int)" when name doesn't already include code_int
				const areaRef = orgData.location_area_ref;
				const areaLabel =
					areaRef?.name != null
						? areaRef.code_int != null && !areaRef.name.includes(String(areaRef.code_int))
							? `${areaRef.name} (${areaRef.code_int})`
							: areaRef.name
						: "";
				setSelectedAreaLabel(areaLabel);
				setParentId(orgData.parent_id != null ? String(orgData.parent_id) : "");
				setAddress(orgData.address ?? "");
				setLat(orgData.lat != null ? String(orgData.lat) : "");
				setLng(orgData.lng != null ? String(orgData.lng) : "");
			} catch {
				if (!cancelled) setError("Failed to load organization.");
			} finally {
				if (!cancelled) setLoading(false);
			}
		}
		load();
		return () => {
			cancelled = true;
		};
	}, [slug]);

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

	// Parent org options: exclude current org
	const parentOptions = useMemo(() => {
		if (!options?.organizations || !org) return options?.organizations ?? [];
		return options.organizations.filter((o) => o.id !== org.id);
	}, [options?.organizations, org]);

	const handleLookupCoordinates = useCallback(async () => {
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
	}, [address]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!org) return;
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
			const res = await fetch(`/api/organizations/${encodeURIComponent(slug)}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: name.trim(),
					slug: slugField.trim() || undefined,
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
				organization?: { slug?: string | null; id?: number };
			};
			if (!res.ok) {
				setSubmitMessage(data.error ?? "Failed to update organization.");
				setSubmitStatus("error");
				return;
			}
			setSubmitMessage("Saved.");
			setSubmitStatus("success");
			const newSlug = data.organization?.slug ?? data.organization?.id ?? slug;
			router.push(`/organizations/${newSlug}`);
		} catch {
			setSubmitMessage("Network error.");
			setSubmitStatus("error");
		}
	};

	if (loading || !org) {
		return (
			<div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-8 text-center text-slate-500 dark:text-slate-400">
				{error ?? "Loading…"}
			</div>
		);
	}

	if (error) {
		return (
			<div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-8 text-center text-red-600 dark:text-red-400">
				{error}
			</div>
		);
	}

	if (!options) {
		return (
			<div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-8 text-center text-slate-500 dark:text-slate-400">
				Loading form options…
			</div>
		);
	}

	return (
		<div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6 shadow-sm">
			<h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">
				Edit {org.name}
			</h1>
			<form onSubmit={handleSubmit} className="space-y-4">
				<div>
					<label htmlFor="edit-org-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
						Name <span className="text-red-500">*</span>
					</label>
					<input
						id="edit-org-name"
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
					<label htmlFor="edit-org-slug" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
						Slug (optional)
					</label>
					<input
						id="edit-org-slug"
						type="text"
						value={slugField}
						onChange={(e) => setSlugField(e.target.value)}
						pattern="[a-zA-Z0-9\-]+"
						title="Letters, numbers, and hyphens only (e.g. my-org-name). Leave blank to keep current or auto-generate from name."
						className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
						placeholder="url-friendly-id"
					/>
					<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Leave blank to keep current or auto-generate from name.</p>
				</div>
				<div>
					<label htmlFor="edit-org-description" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
						Description <span className="text-red-500">*</span>
					</label>
					<textarea
						id="edit-org-description"
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
									setPhotoUploadMessage("Image uploaded. Save the form to keep it.");
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
					<label htmlFor="edit-org-primary-type" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
						Primary type
					</label>
					<select
						id="edit-org-primary-type"
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
					<label htmlFor="edit-org-location-type" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
						Location type <span className="text-red-500">*</span>
					</label>
					<select
						id="edit-org-location-type"
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
						<label htmlFor="edit-org-location-area" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
							Location area
						</label>
						<div className="location-area-select">
							<AsyncSelect<LocationAreaOption>
								inputId="edit-org-location-area"
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
					<label htmlFor="edit-org-parent" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
						Parent organization
					</label>
					<select
						id="edit-org-parent"
						value={parentId}
						onChange={(e) => setParentId(e.target.value)}
						className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
					>
						<option value="">— None —</option>
						{parentOptions.map((o) => (
							<option key={o.id} value={o.id}>
								{o.name}
							</option>
						))}
					</select>
				</div>
				<div>
					<label htmlFor="edit-org-address" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
						Address / Primary Zip Code
					</label>
					<div className="flex gap-2">
						<input
							id="edit-org-address"
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
						<label htmlFor="edit-org-lat" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
							Latitude
						</label>
						<input
							id="edit-org-lat"
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
						<label htmlFor="edit-org-lng" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
							Longitude
						</label>
						<input
							id="edit-org-lng"
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
				<div className="flex flex-wrap gap-3 pt-2">
					<button
						type="submit"
						disabled={submitStatus === "loading"}
						className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium px-6 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
					>
						{submitStatus === "loading" ? "Saving…" : "Save changes"}
					</button>
					<Link
						href={`/organizations/${slug}`}
						className="inline-flex items-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
					>
						Cancel
					</Link>
				</div>
			</form>
		</div>
	);
}
