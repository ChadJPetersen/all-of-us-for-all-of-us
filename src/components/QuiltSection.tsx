"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_PREFIX = "a4a_quilt_section_";

function storageKeyFromTitle(title: string): string {
	return STORAGE_PREFIX + title.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60);
}

function getStoredOpen(key: string, defaultOpen: boolean): boolean {
	try {
		const stored = localStorage.getItem(key);
		if (stored === null) return defaultOpen;
		return stored === "1";
	} catch {
		return defaultOpen;
	}
}

function setStoredOpen(key: string, open: boolean): void {
	try {
		localStorage.setItem(key, open ? "1" : "0");
	} catch {
		// ignore
	}
}

interface QuiltSectionProps {
	title: string;
	children: React.ReactNode;
	defaultOpen?: boolean;
	/** Optional key for localStorage; derived from title if not provided */
	storageKey?: string;
	/** Optional class for the content wrapper (e.g. reduce padding) */
	contentClassName?: string;
	/** Optional class for the grid (e.g. larger row min-height) */
	gridClassName?: string;
	/** Optional action (e.g. button/link) shown next to the title; click does not toggle section */
	action?: React.ReactNode;
}

export default function QuiltSection({
	title,
	children,
	defaultOpen = true,
	storageKey: propStorageKey,
	contentClassName,
	gridClassName,
	action,
}: QuiltSectionProps) {
	const key = propStorageKey ?? storageKeyFromTitle(title);
	// Always start with defaultOpen so server and client first render match (avoids hydration mismatch)
	const [isOpen, setIsOpen] = useState(defaultOpen);

	// After mount, apply stored preference (client-only)
	useEffect(() => {
		const stored = getStoredOpen(key, defaultOpen);
		setIsOpen(stored);
	}, [key, defaultOpen]);

	const handleToggle = useCallback(
		(e: React.ToggleEvent<HTMLDetailsElement>) => {
			const next = (e.target as HTMLDetailsElement).open;
			setIsOpen(next);
			setStoredOpen(key, next);
		},
		[key]
	);

	return (
		<details
			open={isOpen}
			onToggle={handleToggle}
			className="group border-b border-gray-200 dark:border-gray-700 last:border-b-0"
			aria-expanded={isOpen}
		>
			<summary className="list-none cursor-pointer py-4 px-0 flex items-center justify-between gap-3 text-left select-none" aria-expanded={isOpen}>
				<span className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-gray-200 flex-1 min-w-0">
					{title}
				</span>
				{action ? (
					<span className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
						{action}
					</span>
				) : null}
				<span
					className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 transition-transform group-open:rotate-180"
					aria-hidden
				>
					<svg
						className="w-5 h-5"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M19 9l-7 7-7-7"
						/>
					</svg>
				</span>
			</summary>
			<div className={contentClassName ?? "pb-6"}>
				<div
					className={
						gridClassName
							? `grid grid-cols-12 gap-4 ${gridClassName}`
							: "grid grid-cols-12 gap-4 auto-rows-[minmax(100px,auto)]"
					}
				>
					{children}
				</div>
			</div>
		</details>
	);
}
