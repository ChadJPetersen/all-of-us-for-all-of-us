import type { Metadata } from "next";
import { SearchResults } from "./SearchResults";

export const metadata: Metadata = {
	title: "Search | All of Us For All of Us",
	description: "Search calendars, organizations, resources, and volunteer opportunities.",
};

interface PageProps {
	searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: PageProps) {
	const { q } = await searchParams;
	const query = typeof q === "string" ? q.trim() : "";

	return (
		<div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-teal-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/20">
			<main id="main-content" className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12" role="main">
				<h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight mb-2">
					Search
				</h1>
				<p className="text-slate-600 dark:text-slate-400 mb-6">
					Search across calendars, organizations, resources, and volunteer opportunities.
				</p>

				<SearchResults query={query} />
			</main>
		</div>
	);
}
