import type { Metadata } from "next";
import Link from "next/link";
import { guidingPrincipleTexts } from "@/lib/guidingPrinciples";

export const metadata: Metadata = {
	title: "Mission & Guiding Principles | All of Us For All of Us",
	description: "Beloved Community mission statement and guiding principles, finalized June 3, 2025.",
};

const MISSION_STATEMENT = `Envision and create a welcoming, embodied community and culture in which we want to live, where the dignity, joy, and well-being of all people, and future generations, is the primary goal, such that people can thrive and become their best authentic selves.`;

const GUIDING_PRINCIPLES = [...guidingPrincipleTexts()];

export default function PrinciplesPage() {
	return (
		<div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-violet-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950/20">
			{/* Top bar with back link */}
			<header className="border-b border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
				<div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
					<Link
						href="/"
						className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 font-medium transition-colors"
						aria-label="Back to home"
					>
						<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
						</svg>
						Back to home
					</Link>
					<div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-600 to-violet-400 flex items-center justify-center shadow-md">
						<span className="text-white font-bold text-lg">4</span>
					</div>
				</div>
			</header>

			<main id="main-content" className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-14" role="main">
				{/* Title block */}
				<div className="text-center mb-12">
					<h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
						Beloved Community
					</h1>
					<p className="mt-1 text-lg sm:text-xl text-slate-600 dark:text-slate-400 font-medium">
						Mission Statement & Guiding Principles
					</p>
					<p className="mt-3 text-sm text-slate-500 dark:text-slate-500">
						Finalized & Adopted June 3, 2025
					</p>
				</div>

				{/* Mission statement card */}
				<section className="mb-12">
					<h2 className="text-sm font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400 mb-4">
						Mission Statement
					</h2>
					<div className="relative rounded-2xl bg-white dark:bg-slate-800/80 shadow-lg shadow-slate-200/50 dark:shadow-none ring-1 ring-slate-200/80 dark:ring-slate-700/80 overflow-hidden">
						<div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-violet-500 to-violet-400" aria-hidden />
						<p className="relative pl-6 pr-6 py-6 sm:pl-8 sm:pr-8 sm:py-8 text-slate-700 dark:text-slate-300 text-lg sm:text-xl leading-relaxed">
							{MISSION_STATEMENT}
						</p>
					</div>
				</section>

				{/* Guiding principles */}
				<section>
					<h2 className="text-sm font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400 mb-4">
						Guiding Principles
					</h2>
					<ul className="space-y-4">
						{GUIDING_PRINCIPLES.map((principle, i) => (
							<li key={i} className="flex gap-4 group">
								<span
									className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 flex items-center justify-center text-sm font-semibold group-hover:bg-violet-200 dark:group-hover:bg-violet-800/60 transition-colors"
									aria-hidden
								>
									{i + 1}
								</span>
								<span className="pt-0.5 text-slate-700 dark:text-slate-300 text-base sm:text-lg leading-relaxed">
									{principle}
								</span>
							</li>
						))}
					</ul>
				</section>

				{/* Footer quote */}
				<footer className="mt-16 pt-8 border-t border-slate-200/80 dark:border-slate-700/80 text-center">
					<p className="text-xl sm:text-2xl text-slate-600 dark:text-slate-400 font-script-quote">
						A square may keep you comfortable. But the quilt will keep you warm!
					</p>
				</footer>
			</main>
		</div>
	);
}
