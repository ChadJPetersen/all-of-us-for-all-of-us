"use client";

import { useRef, useState, useEffect } from "react";

export default function HeaderVideo() {
	const videoRef = useRef<HTMLVideoElement>(null);
	const containerRef = useRef<HTMLElement>(null);
	const [muted, setMuted] = useState(true);
	const [inView, setInView] = useState(false);

	// Defer loading and playing video until it enters the viewport (saves bandwidth and improves LCP)
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting) setInView(true);
			},
			{ rootMargin: "50px", threshold: 0.1 }
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	const toggleMuted = () => {
		const video = videoRef.current;
		if (!video) return;
		const next = !muted;
		video.muted = next;
		setMuted(next);
	};

	return (
		<section
			className="relative w-full h-full min-h-[200px] overflow-hidden bg-black/20 rounded-lg [&>video]:absolute [&>video]:inset-0 [&>video]:w-full [&>video]:h-full"
			ref={containerRef}
			aria-label="Intro video"
		>
			<video
				ref={videoRef}
				className="absolute inset-0 w-full h-full object-contain"
				playsInline
				muted
				loop
				autoPlay
				preload="metadata"
				aria-label="Intro video"
			>
				{inView && (
					<>
						<source src="/videos/AllForAll/intro.webm" type="video/webm" />
						<source src="/videos/AllForAll/intro.mp4" type="video/mp4" />
					</>
				)}
			</video>
			<button
				type="button"
				onClick={toggleMuted}
				className="absolute bottom-3 right-3 rounded-full bg-black/60 hover:bg-black/80 text-white p-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-transparent"
				aria-label={muted ? "Unmute video" : "Mute video"}
				title={muted ? "Unmute" : "Mute"}
			>
				{muted ? (
					<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
						<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
					</svg>
				) : (
					<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
						<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
					</svg>
				)}
			</button>
		</section>
	);
}
