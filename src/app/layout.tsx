import type { Metadata } from "next";
import Link from "next/link";
import { Caveat, Geist_Mono } from "next/font/google";
import "@fontsource/dancing-script/latin.css";
import "./globals.css";
import SearchBox from "@/components/SearchBox";
import LocationPicker from "@/components/LocationPicker";
import ObservationTracker from "@/components/ObservationTracker";

const caveat = Caveat({
	weight: ["400", "500", "600", "700"],
	subsets: ["latin"],
	variable: "--font-caveat",
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "All of Us For All of Us",
	description: "Building community as though the revolution already happened.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<head>
				<link rel="icon" href="/favicon.svg" type="image/svg+xml"></link>
			</head>
			<body className={`${caveat.variable} ${geistMono.variable} font-sans antialiased`}>
			<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-teal-500 focus:text-white focus:rounded-lg">
				Skip to main content
			</a>
			<header role="banner" className="sticky top-0 z-50 flex flex-col border-b border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm px-4 py-2 sm:px-6">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex flex-wrap items-center gap-4 sm:gap-6 min-w-0">
						<Link
							href="/"
							className="flex-shrink-0 flex items-center gap-2 sm:gap-3 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 rounded"
							aria-label="All of Us For All of Us – Home"
						>
							<span className="h-10 sm:h-12 w-auto flex shrink-0">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 512 256"
									role="img"
									aria-hidden
									className="h-full w-auto object-contain"
								>
									<defs>
										<linearGradient id="wing" x1="0" y1="0" x2="1" y2="1">
											<stop offset="0" stopColor="#5B21B6" />
											<stop offset="1" stopColor="#C4B5FD" />
										</linearGradient>
										<filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
											<feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#0f172a" floodOpacity="0.18" />
										</filter>
									</defs>
									<g filter="url(#soft)">
										<g transform="translate(170 128) rotate(90)">
											<path d="M -72,78 L 0,-78 L 72,78 L 40,78 L 24,40 L -24,40 L -40,78 Z" fill="url(#wing)" />
											<path d="M -18,16 L 18,16 L 30,40 L -30,40 Z" fill="#ffffff" opacity="0.75" />
										</g>
										<g transform="translate(342 128) rotate(-90)">
											<path d="M -72,78 L 0,-78 L 72,78 L 40,78 L 24,40 L -24,40 L -40,78 Z" fill="url(#wing)" />
											<path d="M -18,16 L 18,16 L 30,40 L -30,40 Z" fill="#ffffff" opacity="0.75" />
										</g>
										<g transform="translate(256 128)">
											<rect x="-52" y="-56" width="104" height="112" rx="22" fill="#0f172a" />
											<rect x="-52" y="-56" width="104" height="112" rx="22" fill="#ffffff" opacity="0.08" />
											<text x="0" y="34" textAnchor="middle" fontFamily="system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial, sans-serif" fontSize="88" fontWeight="900" fill="#ffffff">4</text>
										</g>
									</g>
								</svg>
							</span>
							<span className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-slate-100 hover:text-teal-600 dark:hover:text-teal-400 transition-colors whitespace-nowrap">
								all of us for all of us
							</span>
						</Link>
						<nav className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm font-medium" aria-label="Main navigation">
							<Link href="/" className="text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
								Home
							</Link>
							<Link href="/calendar" className="text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
								Calendar
							</Link>
							<Link href="/resources" className="text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
								Resources
							</Link>
							<Link href="/organizations" className="text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
								Organizations
							</Link>
							<Link href="/volunteer" className="text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
								Get involved / Volunteer
							</Link>
						</nav>
					</div>
					<div className="min-w-0 max-w-md flex-shrink-0">
						<SearchBox />
					</div>
				</div>
				<div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
					<LocationPicker variant="header" idPrefix="header-" />
				</div>
			</header>
			{children}
			<ObservationTracker />
		</body>
	</html>
	);
}
