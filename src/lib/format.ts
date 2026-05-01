/**
 * Convert an ISO 8601 datetime string to UTC seconds and optional offset (minutes from UTC).
 * Used when storing API/form input into the database.
 */
export function isoToUtcAndOffset(iso: string): { utcSeconds: number; offsetMinutes: number | null } | null {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return null;
	const utcSeconds = Math.floor(d.getTime() / 1000);
	const tzMatch = iso.match(/(?:Z|([+-])(\d{2}):?(\d{2})?)$/);
	let offsetMinutes: number | null = null;
	if (tzMatch) {
		if (tzMatch[1] === undefined) {
			offsetMinutes = 0; // Z
		} else {
			const sign = tzMatch[1] === "+" ? 1 : -1;
			const hours = parseInt(tzMatch[2], 10);
			const mins = tzMatch[3] ? parseInt(tzMatch[3], 10) : 0;
			offsetMinutes = sign * (hours * 60 + mins);
		}
	}
	return { utcSeconds, offsetMinutes };
}

/**
 * Build an ISO 8601 datetime string from UTC seconds and optional offset (minutes from UTC).
 * Used when reading from the database for API responses and UI.
 */
export function utcAndOffsetToIso(utcSeconds: number, offsetMinutes: number | null): string {
	if (offsetMinutes == null) {
		return new Date(utcSeconds * 1000).toISOString();
	}
	const localDate = new Date((utcSeconds + offsetMinutes * 60) * 1000);
	const y = localDate.getUTCFullYear();
	const m = String(localDate.getUTCMonth() + 1).padStart(2, "0");
	const day = String(localDate.getUTCDate()).padStart(2, "0");
	const h = String(localDate.getUTCHours()).padStart(2, "0");
	const min = String(localDate.getUTCMinutes()).padStart(2, "0");
	const s = String(localDate.getUTCSeconds()).padStart(2, "0");
	const sign = offsetMinutes >= 0 ? "+" : "-";
	const absOff = Math.abs(offsetMinutes);
	const oh = Math.floor(absOff / 60);
	const om = absOff % 60;
	const offsetStr = `${sign}${String(oh).padStart(2, "0")}:${String(om).padStart(2, "0")}`;
	return `${y}-${m}-${day}T${h}:${min}:${s}${offsetStr}`;
}

/**
 * Format an ISO date string for display (e.g. "Feb 23, 2025").
 */
export function formatDate(iso: string): string {
	try {
		const d = new Date(iso);
		return d.toLocaleDateString(undefined, {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	} catch {
		return "";
	}
}

/**
 * Format an ISO datetime string for display with timezone (e.g. "Feb 23, 2025, 9:00 AM MST").
 */
export function formatDateTime(iso: string): string {
	try {
		const d = new Date(iso);
		return d.toLocaleString(undefined, {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
			timeZoneName: "short",
		});
	} catch {
		return "";
	}
}

/**
 * Convert a datetime-local value (YYYY-MM-DDTHH:mm) to ISO 8601 with timezone (UTC).
 * Use when submitting forms so stored datetimes have an explicit timezone.
 */
export function toIsoDatetime(localDatetime: string): string {
	if (!localDatetime || !localDatetime.trim()) return localDatetime;
	const d = new Date(localDatetime.trim());
	return Number.isNaN(d.getTime()) ? localDatetime : d.toISOString();
}

/** Get the user's current timezone offset in minutes (e.g. -420 for UTC-7). */
export function getCurrentOffsetMinutes(): number {
	return typeof window !== "undefined" ? -new Date().getTimezoneOffset() : 0;
}

/** Format offset minutes as "UTC+5:30" or "UTC-7". */
export function formatOffsetLabel(offsetMinutes: number): string {
	if (offsetMinutes === 0) return "UTC";
	const sign = offsetMinutes >= 0 ? "+" : "-";
	const abs = Math.abs(offsetMinutes);
	const h = Math.floor(abs / 60);
	const m = abs % 60;
	if (m === 0) return `UTC${sign}${h}`;
	return `UTC${sign}${h}:${String(m).padStart(2, "0")}`;
}

/** Common timezone options for dropdowns. First option is "My timezone" when currentOffset is provided. */
export function getTimezoneOptions(currentOffset?: number): { value: number; label: string }[] {
	const options: { value: number; label: string }[] = [];
	if (currentOffset !== undefined) {
		options.push({
			value: currentOffset,
			label: `My timezone (${formatOffsetLabel(currentOffset)})`,
		});
	}
	const common: [number, string][] = [
		[-480, "Pacific (UTC-8)"],
		[-420, "Mountain (UTC-7)"],
		[-360, "Central (UTC-6)"],
		[-300, "Eastern (UTC-5)"],
		[0, "UTC"],
		[60, "Central European (UTC+1)"],
		[330, "India (UTC+5:30)"],
		[480, "China (UTC+8)"],
		[600, "Australia Eastern (UTC+10)"],
	];
	for (const [value, label] of common) {
		if (currentOffset !== undefined && value === currentOffset) continue;
		options.push({ value, label });
	}
	return options;
}

/**
 * Convert a datetime-local value (YYYY-MM-DDTHH:mm) plus an explicit offset (minutes from UTC)
 * to an ISO 8601 string with timezone (e.g. "2025-02-24T14:00:00-07:00").
 */
export function toIsoDatetimeWithOffset(localDatetime: string, offsetMinutes: number): string {
	if (!localDatetime || !localDatetime.trim()) return localDatetime;
	const trimmed = localDatetime.trim();
	const d = new Date(trimmed);
	if (Number.isNaN(d.getTime())) return localDatetime;
	const normalized = trimmed.length <= 16 ? `${trimmed}:00` : trimmed;
	const sign = offsetMinutes >= 0 ? "+" : "-";
	const abs = Math.abs(offsetMinutes);
	const oh = Math.floor(abs / 60);
	const om = abs % 60;
	const offsetStr = `${sign}${String(oh).padStart(2, "0")}:${String(om).padStart(2, "0")}`;
	return `${normalized.slice(0, 19)}${offsetStr}`;
}
