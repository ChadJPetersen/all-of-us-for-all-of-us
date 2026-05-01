"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { observe } from "@/lib/observe";

interface SearchBoxProps {
	/** Pre-fill the search input (e.g. on the search results page). */
	defaultValue?: string;
}

export default function SearchBox({ defaultValue }: SearchBoxProps) {
	const router = useRouter();
	const inputRef = useRef<HTMLInputElement>(null);

	function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const q = (e.currentTarget.elements.namedItem("q") as HTMLInputElement | null)?.value?.trim();
		if (q) {
			observe("search", { q });
			router.push(`/search?q=${encodeURIComponent(q)}`);
		}
	}

	return (
		<form
			onSubmit={handleSubmit}
			className="flex items-center gap-2 w-full max-w-sm"
			role="search"
			aria-label="Search site"
		>
			<label htmlFor="site-search" className="sr-only">
				Search calendars, organizations, resources, and volunteer opportunities
			</label>
			<input
				ref={inputRef}
				id="site-search"
				name="q"
				type="search"
				defaultValue={defaultValue}
				placeholder="Search…"
				className="flex-1 min-w-0 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
				aria-label="Search"
				autoComplete="off"
			/>
			<button
				type="submit"
				className="shrink-0 rounded-lg bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
				aria-label="Submit search"
			>
				Search
			</button>
		</form>
	);
}
