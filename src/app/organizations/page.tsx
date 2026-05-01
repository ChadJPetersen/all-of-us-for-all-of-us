import type { Metadata } from "next";
import OrganizationsContent from "./OrganizationsContent";

export const metadata: Metadata = {
	title: "Organizations | All of Us For All of Us",
	description: "Find and add community organizations. Add your organization and optional calendar link for the shared calendar.",
};

export default function OrganizationsPage() {
	return (
		<div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20">
			<main id="main-content" className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12" role="main">
				<div className="text-center mb-10">
					<h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
						Organizations
					</h1>
					<p className="mt-2 text-slate-600 dark:text-slate-400">
						Find and connect with organizations in your area. Add your organization and optionally a calendar link, resources, and volunteer opportunities.
					</p>
				</div>

				<OrganizationsContent />
			</main>
		</div>
	);
}
