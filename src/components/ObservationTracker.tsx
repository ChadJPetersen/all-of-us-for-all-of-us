"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { observe } from "@/lib/observe";

/**
 * Tracks page views and link clicks. Mount once in the root layout.
 * Sends events to POST /api/observe (D1); works on Cloudflare.
 */
export default function ObservationTracker() {
	const pathname = usePathname();

	// Page view on mount and when pathname changes
	useEffect(() => {
		if (!pathname) return;
		observe("page_view", { path: pathname });
	}, [pathname]);

	// Global click delegation: track clicks on links (path, href, optional data-observe-context)
	useEffect(() => {
		function handleClick(e: MouseEvent) {
			const target = e.target as HTMLElement;
			const link = target.closest("a[href]") as HTMLAnchorElement | null;
			if (!link) return;
			const href = link.getAttribute("href");
			if (!href || href.startsWith("#")) return;
			const text = (link.textContent ?? "").trim().slice(0, 200);
			const path = link.pathname ?? (href.startsWith("/") ? href : new URL(href, window.location.origin).pathname);
			const payload: Record<string, unknown> = {
				path,
				href: href.slice(0, 500),
				text: text || undefined,
			};
			const ctx = link.getAttribute("data-observe-context");
			if (ctx) {
				try {
					const parsed = JSON.parse(ctx) as Record<string, unknown>;
					Object.assign(payload, parsed);
				} catch {
					// ignore invalid JSON
				}
			}
			observe("click", payload);
		}
		document.addEventListener("click", handleClick, true);
		return () => document.removeEventListener("click", handleClick, true);
	}, []);

	return null;
}
