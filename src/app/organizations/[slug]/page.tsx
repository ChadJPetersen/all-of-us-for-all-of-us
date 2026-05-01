import Link from "next/link";
import OrganizationDetail from "./OrganizationDetail";

type Props = { params: Promise<{ slug: string }> };

export default async function OrganizationPage({ params }: Props) {
	const { slug } = await params;

	return (
		<div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20">
			<main id="main-content" className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12" role="main">
				<Link
					href="/organizations"
					className="inline-flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 mb-6"
				>
					← Back to organizations
				</Link>
				<OrganizationDetail slug={slug} />
			</main>
		</div>
	);
}
