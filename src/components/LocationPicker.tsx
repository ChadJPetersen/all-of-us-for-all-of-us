"use client";

import { useCallback, useEffect, useState } from "react";

interface LocationApiResponse {
	error?: string;
	zip?: string;
	placeName?: string;
}

interface LocationPickerProps {
	onLocationSet?: () => void;
	className?: string;
	/** "default" = dark background (hero), "header" = theme-aware for header bar */
	variant?: "default" | "header";
	/** Optional prefix for input ids (e.g. "header-" when used in layout to avoid duplicate ids) */
	idPrefix?: string;
}

const headerStyles = {
	button:
		"rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 bg-slate-200/80 dark:bg-slate-700/80 text-slate-800 dark:text-slate-100 hover:bg-slate-300/80 dark:hover:bg-slate-600/80 border border-slate-300/80 dark:border-slate-600/80",
	divider: "text-slate-500 dark:text-slate-400",
	input:
		"w-24 rounded-md border px-2 py-1.5 text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100",
	inputRadius:
		"w-16 rounded-md border px-2 py-1.5 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100",
	message: "text-sm text-slate-600 dark:text-slate-300",
	messageError: "text-sm text-red-600 dark:text-red-400",
};

const defaultStyles = {
	button:
		"rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20 disabled:opacity-50",
	divider: "text-white/70",
	input:
		"w-24 rounded-md border border-white/30 bg-white/10 px-2 py-1.5 text-sm text-white placeholder:text-white/50",
	inputRadius:
		"w-16 rounded-md border border-white/30 bg-white/10 px-2 py-1.5 text-sm text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
	message: "text-sm text-white/90",
	messageError: "text-sm text-red-200",
};

export default function LocationPicker({
	onLocationSet,
	className = "",
	variant = "default",
	idPrefix = "",
}: LocationPickerProps) {
	const styles = variant === "header" ? headerStyles : defaultStyles;
	const id = (name: string) => (idPrefix ? `${idPrefix}${name}` : name);
	const [zip, setZip] = useState("");
	const [radiusMiles, setRadiusMiles] = useState(50);
	const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
		"idle"
	);
	const [message, setMessage] = useState("");
	const LOCATION_DENIED_KEY = "a4a_location_denied";

	const setLocationFromCoords = useCallback(
		async (lat: number, lng: number) => {
			try {
				const res = await fetch("/api/location", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ lat, lng, radiusMiles }),
				});
				const data = (await res.json()) as LocationApiResponse;
				if (!res.ok) {
					setMessage(data.error ?? "Failed to set location");
					setStatus("error");
					return;
				}
				if (data.zip) setZip(data.zip);
				setMessage(
					data.placeName
						? `Location set to ${data.placeName}`
						: data.zip
							? `Location set to ${data.zip}`
							: "Location set to your current position"
				);
				setStatus("success");
				onLocationSet?.();
				if (typeof window !== "undefined") {
					window.dispatchEvent(new CustomEvent("a4a-location-set"));
				}
			} catch {
				setMessage("Network error");
				setStatus("error");
			}
		},
		[radiusMiles, onLocationSet]
	);

	const setLocationByZip = useCallback(async () => {
		const trimmed = zip.trim();
		if (!trimmed) {
			setMessage("Enter a ZIP code");
			setStatus("error");
			return;
		}
		setStatus("loading");
		setMessage("");
		try {
			const res = await fetch("/api/location", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ zip: trimmed, radiusMiles }),
			});
			const data = (await res.json()) as LocationApiResponse;
			if (!res.ok) {
				setMessage(data.error ?? "Failed to set location");
				setStatus("error");
				return;
			}
			const display =
				data.placeName != null && data.placeName.trim()
					? `${trimmed} ${data.placeName.trim().replace(/,/g, "")}`
					: trimmed;
			setMessage(`Location set to ${display}`);
			setStatus("success");
			onLocationSet?.();
			if (typeof window !== "undefined") {
				window.dispatchEvent(new CustomEvent("a4a-location-set"));
			}
		} catch {
			setMessage("Network error");
			setStatus("error");
		}
	}, [zip, radiusMiles, onLocationSet]);

	const useMyLocation = useCallback(() => {
		if (!navigator.geolocation) {
			setMessage("Geolocation is not supported");
			setStatus("error");
			return;
		}
		setStatus("loading");
		setMessage("");
		navigator.geolocation.getCurrentPosition(
			(pos) =>
				setLocationFromCoords(pos.coords.latitude, pos.coords.longitude),
			() => {
				setMessage("Could not get your location");
				setStatus("error");
			}
		);
	}, [setLocationFromCoords]);

	// On load: restore saved location into the form (ZIP + radius). If no saved location, optionally try geolocation.
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const res = await fetch("/api/location", { cache: "no-store" });
				const data = (await res.json()) as {
					location?: {
						zip?: string;
						placeName?: string;
						radiusMiles?: number;
					} | null;
				};
				if (cancelled) return;
				const loc = data?.location;
				if (loc != null) {
					if (typeof loc.zip === "string" && loc.zip.trim())
						setZip(loc.zip.trim());
					if (
						typeof loc.radiusMiles === "number" &&
						Number.isFinite(loc.radiusMiles)
					)
						setRadiusMiles(Math.max(1, Math.min(500, loc.radiusMiles)));
					// Show "Location set to ..." so the user sees their saved location is active
					const placePart =
						typeof loc.placeName === "string" && loc.placeName.trim()
							? ` ${loc.placeName.trim().replace(/,/g, "")}`
							: "";
					const zipPart =
						typeof loc.zip === "string" && loc.zip.trim()
							? loc.zip.trim()
							: "your location";
					setMessage(`Location set to ${zipPart}${placePart}`);
					setStatus("success");
					return;
				}
				if (!navigator.geolocation) return;
				try {
					if (sessionStorage.getItem(LOCATION_DENIED_KEY)) return;
				} catch {
					// sessionStorage not available
				}
				setStatus("loading");
				setMessage("");
				navigator.geolocation.getCurrentPosition(
					(pos) => {
						if (cancelled) return;
						void setLocationFromCoords(
							pos.coords.latitude,
							pos.coords.longitude
						);
					},
					() => {
						if (!cancelled) {
							try {
								sessionStorage.setItem(LOCATION_DENIED_KEY, "1");
							} catch {
								// ignore
							}
							setMessage("You can enter a ZIP code below.");
							setStatus("idle");
						}
					}
				);
			} catch {
				if (!cancelled) setStatus("idle");
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [setLocationFromCoords]);

	return (
		<div
			className={`flex flex-wrap items-center gap-2 sm:gap-3 ${className}`}
			role="group"
			aria-label="Set your location for nearby organizations"
		>
			<button
				type="button"
				onClick={useMyLocation}
				disabled={status === "loading"}
				className={styles.button}
				aria-label="Use my current location"
				aria-busy={status === "loading"}
			>
				Use my location
			</button>
			<span className={styles.divider}>or</span>
			<label className="sr-only" htmlFor={id("location-zip")}>
				ZIP code
			</label>
			<input
				id={id("location-zip")}
				type="text"
				inputMode="numeric"
				placeholder="ZIP code"
				value={zip}
				onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 10))}
				onKeyDown={(e) => e.key === "Enter" && setLocationByZip()}
				className={styles.input}
				aria-describedby={id("location-status")}
			/>
			<span className={styles.divider}>within</span>
			<label className="sr-only" htmlFor={id("location-radius")}>
				Radius in miles
			</label>
			<input
				id={id("location-radius")}
				type="number"
				min={1}
				max={500}
				value={radiusMiles}
				onChange={(e) => {
					const raw = e.target.value;
					if (raw === "") {
						setRadiusMiles(50);
						return;
					}
					const v = parseInt(raw, 10);
					if (!Number.isNaN(v)) setRadiusMiles(Math.max(1, Math.min(500, v)));
				}}
				className={styles.inputRadius}
				aria-label="Radius in miles"
			/>
			<span className={`${styles.divider} text-sm`}>miles</span>
			<button
				type="button"
				onClick={setLocationByZip}
				disabled={status === "loading"}
				className={styles.button}
				aria-label="Set location from ZIP code"
				aria-busy={status === "loading"}
			>
				Set location
			</button>
			{message && (
				<span
					id={id("location-status")}
					className={status === "error" ? styles.messageError : styles.message}
					role="status"
				>
					{message}
				</span>
			)}
		</div>
	);
}
