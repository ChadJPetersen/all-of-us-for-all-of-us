"use client";

import { useEffect, useState } from "react";

const ROTATE_INTERVAL_MS = 8000;

const iconClass = "w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 text-purple-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] flex-shrink-0";

const icons: Record<string, React.ReactNode> = {
	users: (
		<svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
			<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
			<circle cx="9" cy="7" r="4" />
			<path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
		</svg>
	),
	handshake: (
		<svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
			<path d="m11 17 2 2-1.5-4.5L12 10l2.5 2.5L13 17" />
			<path d="m15 17 2 2 1.5-4.5L12 10 9.5 12.5 11 17" />
			<path d="M8 14.5 6 17 4 14.5" />
			<path d="M16 14.5 18 17 20 14.5" />
			<path d="M12 10V8" />
		</svg>
	),
	scale: (
		<svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
			<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="M7 21h10" /><path d="M12 3v18" /><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
		</svg>
	),
	clock: (
		<svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
			<circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
		</svg>
	),
	target: (
		<svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
			<circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
		</svg>
	),
	bookOpen: (
		<svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
			<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
		</svg>
	),
	sparkles: (
		<svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
			<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /><path d="M5 3v4" /><path d="M3 5h4" /><path d="M19 17v4" /><path d="M17 19h4" />
		</svg>
	),
	globe: (
		<svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
			<circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" />
		</svg>
	),
	heartHandshake: (
		<svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
			<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /><path d="M12 5 9.04 7.96a2.17 2.17 0 0 0 0 3.08V12l3.5-3.5 1.5-1.5" />
		</svg>
	),
	messageCircle: (
		<svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
			<path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" />
		</svg>
	),
	heart: (
		<svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
			<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
		</svg>
	),
	landmark: (
		<svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
			<path d="m3 22 9-10 9 10" /><path d="M12 12v10" /><path d="M2 22h20" />
		</svg>
	),
};

export type PrincipalItem = { text: string; icon: keyof typeof icons };

export default function PrincipalCarousel({
	principals,
}: { principals: readonly PrincipalItem[] }) {
	const [index, setIndex] = useState(0);

	useEffect(() => {
		if (principals.length <= 1) return;
		const id = setInterval(() => {
			setIndex((i) => (i + 1) % principals.length);
		}, ROTATE_INTERVAL_MS);
		return () => clearInterval(id);
	}, [principals.length]);

	const item = principals[index] ?? principals[0];
	const icon = item ? icons[item.icon] ?? null : null;

	return (
		<div
			className="relative w-full h-full min-h-[8rem] flex items-center justify-center overflow-hidden"
			role="region"
			aria-label="Guiding principles"
			aria-live="polite"
		>
			<div
				key={index}
				className="principal-carousel-enter flex flex-col items-center justify-center gap-3 sm:gap-4 px-2"
				aria-atomic="true"
			>
				{icon}
				<p className="text-purple-300 text-base sm:text-lg md:text-xl lg:text-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] text-center">
					{item?.text ?? ""}
				</p>
			</div>
		</div>
	);
}
