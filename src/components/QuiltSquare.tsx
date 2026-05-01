"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";

interface QuiltSquareProps {
	image?: string;
	video?: string;
	title: string;
	height: number; // 1-12
	width: number; // 1-12
	backgroundClassName?: string;
	mediaFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
	showAudioToggle?: boolean;
	initiallyMuted?: boolean;
	showTitleOverlay?: boolean;
	titleOverlayClassName?: string;
	priority?: boolean;
	children: React.ReactNode;
}

// Grid span class mapping for Tailwind
const colSpanClasses: Record<number, string> = {
	1: "col-span-1",
	2: "col-span-2",
	3: "col-span-3",
	4: "col-span-4",
	5: "col-span-5",
	6: "col-span-6",
	7: "col-span-7",
	8: "col-span-8",
	9: "col-span-9",
	10: "col-span-10",
	11: "col-span-11",
	12: "col-span-12",
};

const rowSpanClasses: Record<number, string> = {
	1: "row-span-1",
	2: "row-span-2",
	3: "row-span-3",
	4: "row-span-4",
	5: "row-span-5",
	6: "row-span-6",
	7: "row-span-7",
	8: "row-span-8",
	9: "row-span-9",
	10: "row-span-10",
	11: "row-span-11",
	12: "row-span-12",
};

export default function QuiltSquare({
	image,
	video,
	title,
	height,
	width,
	backgroundClassName = "bg-gray-200",
	mediaFit = "cover",
	showAudioToggle = true,
	initiallyMuted = true,
	showTitleOverlay = true,
	titleOverlayClassName = "bg-black/40",
	priority = false,
	children,
}: QuiltSquareProps) {
	const [isHovered, setIsHovered] = useState(false);
	const [isMuted, setIsMuted] = useState(initiallyMuted);
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const id = useId().replace(/:/g, "");
	const titleId = `quilt-title-${id}`;

	// Validate height and width are between 1-12
	const validHeight = Math.max(1, Math.min(12, height));
	const validWidth = Math.max(1, Math.min(12, width));

	// Get grid span classes
	const colSpan = colSpanClasses[validWidth] || "col-span-1";
	const rowSpan = rowSpanClasses[validHeight] || "row-span-1";

	const mediaFitClassName =
		mediaFit === "contain"
			? "object-contain"
			: mediaFit === "fill"
				? "object-fill"
				: mediaFit === "none"
					? "object-none"
					: mediaFit === "scale-down"
						? "object-scale-down"
						: "object-cover";

	useEffect(() => {
		// Keep the actual element in sync with React state.
		if (videoRef.current) videoRef.current.muted = isMuted;
	}, [isMuted]);

	return (
		<div
			className={`${colSpan} ${rowSpan} ${backgroundClassName} relative overflow-hidden rounded-lg cursor-pointer transition-all duration-300 ease-in-out min-h-[100px] h-full`}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			role="group"
			aria-labelledby={title ? titleId : undefined}
		>
			{/* Background Image/Video */}
			<div
				className={`absolute inset-0 transition-opacity duration-300 ${
					isHovered ? "opacity-0" : "opacity-100"
				}`}
			>
				{video ? (
					<>
						<video
							ref={videoRef}
							src={video}
							className={`w-full h-full ${mediaFitClassName}`}
							autoPlay
							loop
							muted={isMuted}
							playsInline
						/>
					</>
				) : image ? (
					<Image
						src={image}
						alt={title}
						fill
						className={mediaFitClassName}
						sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
						priority={priority}
						unoptimized={priority}
					/>
				) : (
					<div className={`w-full h-full ${backgroundClassName}`} />
				)}
				{/* Title Overlay */}
				{showTitleOverlay ? (
					<div
						className={`absolute inset-0 ${titleOverlayClassName} flex items-center justify-center`}
					>
						<h3 id={title ? titleId : undefined} className="text-white text-xl font-bold text-center px-4 drop-shadow-lg">
							{title}
						</h3>
					</div>
				) : null}
			</div>

			{/* Children Content (shown on hover) */}
			<div
				className={`absolute inset-0 transition-opacity duration-300 ${
					isHovered ? "opacity-100" : "opacity-0"
				} bg-white/95 p-4 flex items-center justify-center overflow-auto`}
			>
				{children}
			</div>

			{/* Audio toggle (kept above both layers so it's always clickable) */}
			{video && showAudioToggle ? (
				<button
					type="button"
					className="absolute top-2 right-2 z-30 rounded-md bg-black/60 px-2 py-1 text-xs font-semibold text-white backdrop-blur transition hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white/70"
					aria-label={isMuted ? "Unmute video" : "Mute video"}
					onClick={(e) => {
						e.stopPropagation();
						setIsMuted((m) => !m);
					}}
				>
					{isMuted ? "Unmute" : "Mute"}
				</button>
			) : null}
		</div>
	);
}

