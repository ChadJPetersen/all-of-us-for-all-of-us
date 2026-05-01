"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import CalendarModal, { isIcalOrWebcalLink } from "@/components/CalendarModal";
import { HumanVerificationProvider, useHumanVerification } from "@/components/HumanVerificationProvider";
import { formatDateTime, toIsoDatetimeWithOffset, getCurrentOffsetMinutes, getTimezoneOptions } from "@/lib/format";
import type { OrganizationWithVolunteerOpportunities } from "@/lib/types";

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
	resourceTypes?: ResourceTypeOption[];
	scheduleTypes?: ScheduleTypeOption[];
	volunteerRoleTypes?: VolunteerRoleTypeOption[];
}

function OrganizationDetailInner({ slug }: { slug: string }) {
	const { canAddContent, enabled } = useHumanVerification();
	const [org, setOrg] = useState<OrganizationWithVolunteerOpportunities | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [formOptions, setFormOptions] = useState<FormOptions | null>(null);
	const [includePastOpportunities, setIncludePastOpportunities] = useState(false);

	const refetchOrg = useCallback(async (includePast?: boolean) => {
		if (!slug) return;
		const usePast = includePast ?? includePastOpportunities;
		const url =
			usePast
				? `/api/organizations/${encodeURIComponent(slug)}?include_past_opportunities=1`
				: `/api/organizations/${encodeURIComponent(slug)}`;
		const res = await fetch(url);
		if (!res.ok) return;
		const data = (await res.json()) as OrganizationWithVolunteerOpportunities;
		setOrg(data);
	}, [slug, includePastOpportunities]);

	useEffect(() => {
		let cancelled = false;
		async function load() {
			try {
				const res = await fetch(
					`/api/organizations/${encodeURIComponent(slug)}`
				);
				if (!res.ok) {
					if (res.status === 404) setError("Organization not found.");
					else setError("Failed to load organization.");
					return;
				}
				const data = (await res.json()) as OrganizationWithVolunteerOpportunities;
				if (!cancelled) setOrg(data);
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

	useEffect(() => {
		let cancelled = false;
		async function loadOptions() {
			const res = await fetch("/api/form-options");
			if (!res.ok || cancelled) return;
			const data = (await res.json()) as FormOptions;
			if (!cancelled) setFormOptions(data);
		}
		loadOptions();
		return () => {
			cancelled = true;
		};
	}, []);

	// Add calendar link
	const [showAddCalendar, setShowAddCalendar] = useState(false);
	const [addCalLink, setAddCalLink] = useState("");
	const [addCalStatus, setAddCalStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
	const [addCalMessage, setAddCalMessage] = useState("");

	// Calendar modal (for ical/webcal links)
	const [calendarModal, setCalendarModal] = useState<{ url: string; label: string } | null>(null);

	// Add volunteer opportunity
	const [showAddVo, setShowAddVo] = useState(false);
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

	// Add resource
	const [showAddRes, setShowAddRes] = useState(false);
	const [addResTypeId, setAddResTypeId] = useState("");
	const [addResTitle, setAddResTitle] = useState("");
	const [addResDescription, setAddResDescription] = useState("");
	const [addResLink, setAddResLink] = useState("");
	const [addResStatus, setAddResStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
	const [addResMessage, setAddResMessage] = useState("");

	// Add contact
	const [showAddContact, setShowAddContact] = useState(false);
	const [addContactEntity, setAddContactEntity] = useState("");
	const [addContactPhone, setAddContactPhone] = useState("");
	const [addContactEmail, setAddContactEmail] = useState("");
	const [addContactPurpose, setAddContactPurpose] = useState("");
	const [addContactStatus, setAddContactStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
	const [addContactMessage, setAddContactMessage] = useState("");

	const handleAddCalendarLink = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!org || !addCalLink.trim()) {
			setAddCalMessage("Calendar URL is required.");
			setAddCalStatus("error");
			return;
		}
		if (enabled && !canAddContent) {
			setAddCalMessage("Please complete the human verification above first.");
			setAddCalStatus("error");
			return;
		}
		setAddCalStatus("loading");
		setAddCalMessage("");
		try {
			const res = await fetch("/api/organization-calendar-links", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ organization_id: org.id, link: addCalLink.trim() }),
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
			setShowAddCalendar(false);
			await refetchOrg();
		} catch {
			setAddCalMessage("Network error.");
			setAddCalStatus("error");
		}
	};

	const handleAddVolunteerOpportunity = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!org || !addVoTitle.trim()) {
			setAddVoMessage("Title is required.");
			setAddVoStatus("error");
			return;
		}
		if (enabled && !canAddContent) {
			setAddVoMessage("Please complete the human verification above first.");
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
					organization_id: org.id,
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
			setShowAddVo(false);
			await refetchOrg();
		} catch {
			setAddVoMessage("Network error.");
			setAddVoStatus("error");
		}
	};

	const handleAddResource = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!org || !addResTitle.trim()) {
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
		if (enabled && !canAddContent) {
			setAddResMessage("Please complete the human verification above first.");
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
					organization_id: org.id,
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
			setShowAddRes(false);
			await refetchOrg();
		} catch {
			setAddResMessage("Network error.");
			setAddResStatus("error");
		}
	};

	const handleAddContact = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!org || !addContactEntity.trim()) {
			setAddContactMessage("Entity name (who to contact) is required.");
			setAddContactStatus("error");
			return;
		}
		if (!addContactPurpose.trim()) {
			setAddContactMessage("Contact purpose (what to contact about) is required.");
			setAddContactStatus("error");
			return;
		}
		if (enabled && !canAddContent) {
			setAddContactMessage("Please complete the human verification above first.");
			setAddContactStatus("error");
			return;
		}
		setAddContactStatus("loading");
		setAddContactMessage("");
		try {
			const res = await fetch("/api/organization-contacts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					organization_id: org.id,
					entity_name: addContactEntity.trim(),
					contact_purpose: addContactPurpose.trim(),
					phone: addContactPhone.trim() || undefined,
					email: addContactEmail.trim() || undefined,
				}),
			});
			const data = await res.json();
			if (!res.ok) {
				setAddContactMessage((data as { error?: string }).error ?? "Failed to add contact.");
				setAddContactStatus("error");
				return;
			}
			setAddContactMessage("Contact added.");
			setAddContactStatus("success");
			setAddContactEntity("");
			setAddContactPhone("");
			setAddContactEmail("");
			setAddContactPurpose("");
			setShowAddContact(false);
			await refetchOrg();
		} catch {
			setAddContactMessage("Network error.");
			setAddContactStatus("error");
		}
	};

	if (loading) {
		return (
			<div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-8 text-center text-slate-500 dark:text-slate-400" role="status" aria-live="polite">
				Loading…
			</div>
		);
	}

	if (error || !org) {
		return (
			<div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-8 text-center text-red-600 dark:text-red-400" role="alert">
				{error ?? "Organization not found."}
			</div>
		);
	}

	const editHref = `/organizations/${org.slug ?? org.id}/edit`;

	return (
		<>
		<article className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6 shadow-sm">
			{org.photo_url && (
				<div className="mb-4 -mx-6 -mt-6 overflow-hidden rounded-t-lg">
					<img
						src={org.photo_url}
						alt={org.name}
						className="w-full h-48 object-cover bg-slate-100 dark:bg-slate-700"
					/>
				</div>
			)}
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{org.name}</h1>
				<Link
					href={editHref}
					className="inline-flex items-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-800"
					aria-label="Edit organization"
				>
					Edit
				</Link>
			</div>
			<div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
				{org.primary_type_ref && <span>{org.primary_type_ref.label}</span>}
				{org.location_type_ref && <span>{org.location_type_ref.label}</span>}
				{org.location_area_ref && <span>{org.location_area_ref.name}</span>}
			</div>
			{org.address && (
				<p className="mt-3 text-slate-600 dark:text-slate-300">{org.address}</p>
			)}

			{/* Contact information */}
			<div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-600">
				<h2 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
					Contact
				</h2>
				{org.contacts?.length ? (
					<ul className="list-none text-sm text-slate-600 dark:text-slate-400 space-y-2">
						{org.contacts.map((c) => (
							<li key={c.id} className="flex flex-col gap-0.5">
								<span className="font-medium text-slate-700 dark:text-slate-300">{c.entity_name}</span>
								<span className="text-slate-500 dark:text-slate-400">— {c.contact_purpose}</span>
								<div className="flex flex-wrap gap-x-3 gap-y-0.5">
									{c.phone && (
										<a href={`tel:${c.phone.replace(/\s/g, "")}`} className="text-emerald-600 dark:text-emerald-400 hover:underline">
											{c.phone}
										</a>
									)}
									{c.email && (
										<a href={`mailto:${c.email}`} className="text-emerald-600 dark:text-emerald-400 hover:underline">
											{c.email}
										</a>
									)}
								</div>
							</li>
						))}
					</ul>
				) : (
					<p className="text-sm text-slate-500 dark:text-slate-400">None yet.</p>
				)}
				{showAddContact ? (
					<form onSubmit={handleAddContact} className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/80 space-y-2">
						<label htmlFor="add-contact-entity" className="block text-xs font-medium text-slate-600 dark:text-slate-400">Who to contact (entity or name)</label>
						<input
							id="add-contact-entity"
							type="text"
							required
							maxLength={500}
							value={addContactEntity}
							onChange={(e) => setAddContactEntity(e.target.value)}
							placeholder="e.g. Volunteer coordinator, Front desk"
							className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm"
						/>
						<label htmlFor="add-contact-purpose" className="block text-xs font-medium text-slate-600 dark:text-slate-400">What to contact them about</label>
						<input
							id="add-contact-purpose"
							type="text"
							required
							maxLength={500}
							value={addContactPurpose}
							onChange={(e) => setAddContactPurpose(e.target.value)}
							placeholder="e.g. General inquiries, Donations, Volunteer sign-up"
							className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm"
						/>
						<label htmlFor="add-contact-phone" className="block text-xs font-medium text-slate-600 dark:text-slate-400">Phone (optional)</label>
						<input
							id="add-contact-phone"
							type="tel"
							maxLength={100}
							value={addContactPhone}
							onChange={(e) => setAddContactPhone(e.target.value)}
							placeholder="e.g. (307) 555-0123"
							className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm"
						/>
						<label htmlFor="add-contact-email" className="block text-xs font-medium text-slate-600 dark:text-slate-400">Email (optional)</label>
						<input
							id="add-contact-email"
							type="email"
							maxLength={320}
							value={addContactEmail}
							onChange={(e) => setAddContactEmail(e.target.value)}
							placeholder="e.g. contact@example.org"
							className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm"
						/>
						{addContactMessage && (
							<p
								className={`text-xs ${
									addContactStatus === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
								}`}
							>
								{addContactMessage}
							</p>
						)}
						<div className="flex gap-2">
							<button
								type="submit"
								disabled={addContactStatus === "loading"}
								className="rounded bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-medium px-3 py-1.5"
							>
								{addContactStatus === "loading" ? "Adding…" : "Add"}
							</button>
							<button
								type="button"
								onClick={() => setShowAddContact(false)}
								className="rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm px-3 py-1.5"
							>
								Cancel
							</button>
						</div>
					</form>
				) : (
					<button
						type="button"
						onClick={() => setShowAddContact(true)}
						className="mt-2 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
						aria-label="Add contact"
						aria-expanded={showAddContact}
					>
						Add contact
					</button>
				)}
			</div>

			{/* Calendar links */}
			<div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-600">
				<h2 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
					Calendar links
				</h2>
				{org.calendar_links?.length ? (
					<ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-0.5">
						{org.calendar_links.map((item, i) => {
							const displayName = item.name?.trim() || (org.calendar_links!.length > 1 ? `${org.name} (${i + 1})` : org.name);
							return (
								<li key={i}>
									{isIcalOrWebcalLink(item.link) ? (
										<button
											type="button"
											onClick={() => setCalendarModal({
												url: item.link,
												label: displayName,
											})}
											className="text-emerald-600 dark:text-emerald-400 hover:underline text-left"
											aria-label={`View ${displayName} calendar in popup`}
										>
											{displayName}
										</button>
									) : (
										<a
											href={item.link}
											target="_blank"
											rel="noopener noreferrer"
											className="text-emerald-600 dark:text-emerald-400 hover:underline"
											aria-label={`${displayName} (opens in new window)`}
										>
											{displayName}
										</a>
									)}
								</li>
							);
						})}
					</ul>
				) : (
					<p className="text-sm text-slate-500 dark:text-slate-400">None yet.</p>
				)}
				{showAddCalendar ? (
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
						{addCalMessage && (
							<p
								className={`text-xs ${
									addCalStatus === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
								}`}
							>
								{addCalMessage}
							</p>
						)}
						<div className="flex gap-2">
							<button
								type="submit"
								disabled={addCalStatus === "loading"}
								className="rounded bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white text-sm font-medium px-3 py-1.5"
							>
								{addCalStatus === "loading" ? "Adding…" : "Add"}
							</button>
							<button
								type="button"
								onClick={() => setShowAddCalendar(false)}
								className="rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm px-3 py-1.5"
							>
								Cancel
							</button>
						</div>
					</form>
				) : (
					<button
						type="button"
						onClick={() => setShowAddCalendar(true)}
						className="mt-2 text-sm text-teal-600 dark:text-teal-400 hover:underline"
						aria-label="Add calendar link"
						aria-expanded={showAddCalendar}
					>
						Add calendar link
					</button>
				)}
			</div>

			{/* Volunteer opportunities */}
			<div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-600">
				<div className="flex flex-wrap items-center justify-between gap-2 mb-2">
					<h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">
						Volunteer opportunities
					</h2>
					<label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
						<input
							type="checkbox"
							checked={includePastOpportunities}
							onChange={(e) => {
								const v = e.target.checked;
								setIncludePastOpportunities(v);
								refetchOrg(v);
							}}
							className="rounded border-slate-300 dark:border-slate-600"
						/>
						Include past
					</label>
				</div>
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
								<li key={vo.id}>
									{vo.schedule_type_ref && <span className="text-amber-600 dark:text-amber-400">[{vo.schedule_type_ref.label}] </span>}
									{vo.role_type_ref && <span className="text-slate-500 dark:text-slate-400">[{vo.role_type_ref.label}] </span>}
									{vo.link ? (
										<a
											href={vo.link}
											target="_blank"
											rel="noopener noreferrer"
											className="text-emerald-600 dark:text-emerald-400 hover:underline"
											aria-label={`${vo.title} (opens in new window)`}
										>
											{vo.title}
										</a>
									) : (
										<span>{vo.title}</span>
									)}
									{timeLine && <span className="text-slate-500 dark:text-slate-400"> — {timeLine}</span>}
									{vo.description && (
										<span className="text-slate-500 dark:text-slate-400">
											{" — "}{vo.description}
										</span>
									)}
								</li>
							);
						})}
					</ul>
				) : (
					<p className="text-sm text-slate-500 dark:text-slate-400">None yet.</p>
				)}
				{showAddVo ? (
					<form onSubmit={handleAddVolunteerOpportunity} className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/80 space-y-2">
						<label htmlFor="add-vo-title" className="block text-xs font-medium text-slate-600 dark:text-slate-400">Title</label>
						<input
							id="add-vo-title"
							type="text"
							required
							maxLength={500}
							value={addVoTitle}
							onChange={(e) => setAddVoTitle(e.target.value)}
							placeholder="e.g. Event setup crew"
							className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm"
						/>
						<label htmlFor="add-vo-description" className="block text-xs font-medium text-slate-600 dark:text-slate-400">Description (optional)</label>
						<input
							id="add-vo-description"
							type="text"
							value={addVoDescription}
							onChange={(e) => setAddVoDescription(e.target.value)}
							className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm"
						/>
						<label htmlFor="add-vo-link" className="block text-xs font-medium text-slate-600 dark:text-slate-400">Link (optional)</label>
						<input
							id="add-vo-link"
							type="url"
							value={addVoLink}
							onChange={(e) => setAddVoLink(e.target.value)}
							placeholder="https://…"
							className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm"
						/>
						{formOptions?.scheduleTypes?.length ? (
							<>
								<label htmlFor="add-vo-schedule-type" className="block text-xs font-medium text-slate-600 dark:text-slate-400">Schedule type (optional)</label>
								<select id="add-vo-schedule-type" value={addVoScheduleTypeId} onChange={(e) => setAddVoScheduleTypeId(e.target.value)} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm">
									<option value="">— Select —</option>
									{formOptions.scheduleTypes.map((st) => (
										<option key={st.id} value={st.id}>{st.label}</option>
									))}
								</select>
							</>
						) : null}
						{formOptions?.volunteerRoleTypes?.length ? (
							<>
								<label htmlFor="add-vo-role" className="block text-xs font-medium text-slate-600 dark:text-slate-400">Role (optional)</label>
								<select id="add-vo-role" value={addVoRoleTypeId} onChange={(e) => setAddVoRoleTypeId(e.target.value)} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm">
									<option value="">— Select —</option>
									{formOptions.volunteerRoleTypes.map((rt) => (
										<option key={rt.id} value={rt.id}>{rt.label}</option>
									))}
								</select>
							</>
						) : null}
						<div className="grid grid-cols-2 gap-2">
							<div>
								<label htmlFor="add-vo-start" className="block text-xs font-medium text-slate-600 dark:text-slate-400">Start date & time (optional)</label>
								<input id="add-vo-start" type="datetime-local" value={addVoStartAt} onChange={(e) => setAddVoStartAt(e.target.value)} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm" />
							</div>
							<div>
								<label htmlFor="add-vo-end" className="block text-xs font-medium text-slate-600 dark:text-slate-400">End date & time (optional)</label>
								<input id="add-vo-end" type="datetime-local" value={addVoEndAt} onChange={(e) => setAddVoEndAt(e.target.value)} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm" />
							</div>
						</div>
						<div>
							<label htmlFor="add-vo-timezone" className="block text-xs font-medium text-slate-600 dark:text-slate-400">Timezone for dates above</label>
							<select id="add-vo-timezone" value={addVoTimezoneOffset} onChange={(e) => setAddVoTimezoneOffset(Number(e.target.value))} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm">
								{getTimezoneOptions(addVoTimezoneOffset).map((opt, i) => (
									<option key={`${opt.value}-${i}`} value={opt.value}>{opt.label}</option>
								))}
							</select>
						</div>
						<label htmlFor="add-vo-due-date" className="block text-xs font-medium text-slate-600 dark:text-slate-400">Due date (optional)</label>
						<input id="add-vo-due-date" type="date" value={addVoDueDate} onChange={(e) => setAddVoDueDate(e.target.value)} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm" />
						<label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
							<input type="checkbox" checked={addVoIsRecurring} onChange={(e) => setAddVoIsRecurring(e.target.checked)} className="rounded border-slate-300 dark:border-slate-600" />
							Recurring
						</label>
						{addVoIsRecurring ? (
							<>
								<label htmlFor="add-vo-recurrence" className="block text-xs font-medium text-slate-600 dark:text-slate-400">Recurrence description</label>
								<input id="add-vo-recurrence" type="text" value={addVoRecurrenceDescription} onChange={(e) => setAddVoRecurrenceDescription(e.target.value)} placeholder="e.g. Every Tuesday 6–8pm" className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm" />
							</>
						) : null}
						<div className="grid grid-cols-2 gap-2">
							<div>
								<label htmlFor="add-vo-window-start" className="block text-xs font-medium text-slate-600 dark:text-slate-400">Window start (optional)</label>
								<input id="add-vo-window-start" type="date" value={addVoWindowStartDate} onChange={(e) => setAddVoWindowStartDate(e.target.value)} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm" />
							</div>
							<div>
								<label htmlFor="add-vo-window-end" className="block text-xs font-medium text-slate-600 dark:text-slate-400">Window end (optional)</label>
								<input id="add-vo-window-end" type="date" value={addVoWindowEndDate} onChange={(e) => setAddVoWindowEndDate(e.target.value)} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm" />
							</div>
						</div>
						<label htmlFor="add-vo-volunteers-needed" className="block text-xs font-medium text-slate-600 dark:text-slate-400">Volunteers needed (optional)</label>
						<input id="add-vo-volunteers-needed" type="number" min={1} max={999999} value={addVoVolunteersNeeded} onChange={(e) => setAddVoVolunteersNeeded(e.target.value)} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm" />
						<label htmlFor="add-vo-location" className="block text-xs font-medium text-slate-600 dark:text-slate-400">Location for this opportunity (optional)</label>
						<input id="add-vo-location" type="text" value={addVoLocationOverride} onChange={(e) => setAddVoLocationOverride(e.target.value)} placeholder="Address or place name" className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm" />
						{addVoSlots.length > 0 ? (
							<div className="space-y-1">
								<p className="text-xs font-medium text-slate-600 dark:text-slate-400">Additional time slots</p>
								{addVoSlots.map((slot, i) => (
									<div key={i} className="grid grid-cols-2 gap-1">
										<div>
											<label htmlFor={`add-vo-slot-${i}-start`} className="sr-only">Slot {i + 1} start</label>
											<input id={`add-vo-slot-${i}-start`} type="datetime-local" value={slot.start_at} onChange={(e) => setAddVoSlots((prev) => prev.map((s, j) => j === i ? { ...s, start_at: e.target.value } : s))} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1 text-sm" />
										</div>
										<div className="flex gap-1">
											<div className="flex-1">
												<label htmlFor={`add-vo-slot-${i}-end`} className="sr-only">Slot {i + 1} end</label>
												<input id={`add-vo-slot-${i}-end`} type="datetime-local" value={slot.end_at} onChange={(e) => setAddVoSlots((prev) => prev.map((s, j) => j === i ? { ...s, end_at: e.target.value } : s))} className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1 text-sm" />
											</div>
											<button type="button" onClick={() => setAddVoSlots((prev) => prev.filter((_, j) => j !== i))} className="text-slate-500 hover:text-red-600 text-sm px-1" aria-label="Remove slot">×</button>
										</div>
									</div>
								))}
							</div>
						) : null}
						<button type="button" onClick={() => setAddVoSlots((prev) => [...prev, { start_at: "", end_at: "" }])} className="text-sm text-teal-600 dark:text-teal-400 hover:underline">+ Add time slot</button>
						{addVoMessage && (
							<p
								className={`text-xs ${
									addVoStatus === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
								}`}
							>
								{addVoMessage}
							</p>
						)}
						<div className="flex gap-2">
							<button
								type="submit"
								disabled={addVoStatus === "loading"}
								className="rounded bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white text-sm font-medium px-3 py-1.5"
							>
								{addVoStatus === "loading" ? "Adding…" : "Add"}
							</button>
							<button
								type="button"
								onClick={() => setShowAddVo(false)}
								className="rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm px-3 py-1.5"
							>
								Cancel
							</button>
						</div>
					</form>
				) : (
					<button
						type="button"
						onClick={() => setShowAddVo(true)}
						className="mt-2 text-sm text-amber-600 dark:text-amber-400 hover:underline"
						aria-label="Add volunteer opportunity"
						aria-expanded={showAddVo}
					>
						Add volunteer opportunity
					</button>
				)}
			</div>

			{/* Resources */}
			<div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-600">
				<h2 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
					Resources
				</h2>
				{org.resources?.length ? (
					<ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-0.5">
						{org.resources.map((res) => (
							<li key={res.id}>
								{res.resource_type_ref && (
									<span className="text-slate-500 dark:text-slate-400">
										[{res.resource_type_ref.label}]{" "}
									</span>
								)}
								{res.link ? (
									<a
										href={res.link}
										target="_blank"
										rel="noopener noreferrer"
										className="text-emerald-600 dark:text-emerald-400 hover:underline"
										aria-label={`${res.title} (opens in new window)`}
									>
										{res.title}
									</a>
								) : (
									<span>{res.title}</span>
								)}
								{res.description && (
									<span className="text-slate-500 dark:text-slate-400">
										{" — "}{res.description}
									</span>
								)}
							</li>
						))}
					</ul>
				) : (
					<p className="text-sm text-slate-500 dark:text-slate-400">None yet.</p>
				)}
				{formOptions?.resourceTypes?.length ? (
					showAddRes ? (
						<form onSubmit={handleAddResource} className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/80 space-y-2">
							<select
								required
								value={addResTypeId}
								onChange={(e) => setAddResTypeId(e.target.value)}
								className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm"
							>
								<option value="">— Type —</option>
								{formOptions.resourceTypes.map((rt) => (
									<option key={rt.id} value={rt.id}>
										{rt.label}
									</option>
								))}
							</select>
							<input
								type="text"
								required
								maxLength={500}
								value={addResTitle}
								onChange={(e) => setAddResTitle(e.target.value)}
								placeholder="Resource title"
								className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm"
							/>
							<input
								type="text"
								value={addResDescription}
								onChange={(e) => setAddResDescription(e.target.value)}
								placeholder="Description (optional)"
								className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm"
							/>
							<input
								type="url"
								value={addResLink}
								onChange={(e) => setAddResLink(e.target.value)}
								placeholder="Link (optional)"
								className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm"
							/>
							{addResMessage && (
								<p
									className={`text-xs ${
										addResStatus === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
									}`}
								>
									{addResMessage}
								</p>
							)}
							<div className="flex gap-2">
								<button
									type="submit"
									disabled={addResStatus === "loading"}
									className="rounded bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white text-sm font-medium px-3 py-1.5"
								>
									{addResStatus === "loading" ? "Adding…" : "Add"}
								</button>
								<button
									type="button"
									onClick={() => setShowAddRes(false)}
									className="rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm px-3 py-1.5"
								>
									Cancel
								</button>
							</div>
						</form>
					) : (
						<button
							type="button"
							onClick={() => setShowAddRes(true)}
							className="mt-2 text-sm text-rose-600 dark:text-rose-400 hover:underline"
							aria-label="Add resource"
							aria-expanded={showAddRes}
						>
							Add resource
						</button>
					)
				) : null}
			</div>
		</article>
		<CalendarModal
			open={calendarModal != null}
			onClose={() => setCalendarModal(null)}
			url={calendarModal?.url ?? ""}
			label={calendarModal?.label ?? ""}
		/>
		</>
	);
}

export default function OrganizationDetail({ slug }: { slug: string }) {
	return (
		<HumanVerificationProvider showAddGate>
			<OrganizationDetailInner slug={slug} />
		</HumanVerificationProvider>
	);
}
