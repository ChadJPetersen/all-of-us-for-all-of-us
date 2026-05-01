"use client";

import { useEffect, useState } from "react";

/** Whether the user's OS/browser prefers a dark color scheme. */
export function usePrefersDark(): boolean {
	const [dark, setDark] = useState(false);
	useEffect(() => {
		const m = window.matchMedia("(prefers-color-scheme: dark)");
		setDark(m.matches);
		const handler = (e: MediaQueryListEvent) => setDark(e.matches);
		m.addEventListener("change", handler);
		return () => m.removeEventListener("change", handler);
	}, []);
	return dark;
}
