import type { Metadata } from "next";
import ResourcesContent from "./ResourcesContent";

export const metadata: Metadata = {
	title: "Resources | All of Us For All of Us",
	description: "Community resources by type: help, art & music, education, local news, and more. Added by organizations.",
};

export default function ResourcesPage() {
	return (
		<div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-rose-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-rose-950/20">
			<main id="main-content" className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12" role="main">
				<div className="text-center mb-10">
					<h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
						Resources
					</h1>
					<p className="mt-2 text-slate-600 dark:text-slate-400">
						Community resources by type—help, art & music, education, local news, and more. Added by organizations.
					</p>
				</div>

				<ResourcesContent />
			</main>
		</div>
	);
}
