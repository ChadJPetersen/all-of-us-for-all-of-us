"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { TURNSTILE_TOKEN_HEADER } from "@/lib/humanVerifyConstants";

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

type HumanVerificationContextValue = {
	enabled: boolean;
	addVerified: boolean;
	sessionLoading: boolean;
	canAddContent: boolean;
	showAddGate: boolean;
	refreshSession: () => Promise<void>;
	deleteWithVerification: (url: string, init?: RequestInit) => Promise<Response>;
};

const HumanVerificationContext = createContext<HumanVerificationContextValue | null>(null);

export function useHumanVerification(): HumanVerificationContextValue {
	const ctx = useContext(HumanVerificationContext);
	if (!ctx) {
		throw new Error("useHumanVerification must be used within HumanVerificationProvider");
	}
	return ctx;
}

export function HumanVerificationProvider({
	children,
	showAddGate = true,
}: {
	children: ReactNode;
	showAddGate?: boolean;
}) {
	const [enabled, setEnabled] = useState(false);
	const [addVerified, setAddVerified] = useState(false);
	const [sessionLoading, setSessionLoading] = useState(true);
	const enabledRef = useRef(false);

	const deleteTurnstileRef = useRef<TurnstileInstance | null>(null);
	const pendingDeleteRef = useRef<((token: string) => void) | null>(null);
	const pendingRejectRef = useRef<((e: Error) => void) | null>(null);

	const loadSession = useCallback(async () => {
		const res = await fetch("/api/human-session", { credentials: "same-origin" });
		if (!res.ok) {
			enabledRef.current = false;
			setEnabled(false);
			setAddVerified(false);
			return;
		}
		const d = (await res.json()) as { enabled?: boolean; addVerified?: boolean };
		const en = Boolean(d.enabled);
		enabledRef.current = en;
		setEnabled(en);
		setAddVerified(Boolean(d.addVerified));
	}, []);

	useEffect(() => {
		loadSession().finally(() => setSessionLoading(false));
	}, [loadSession]);

	const onDeleteTurnstileSuccess = useCallback((token: string) => {
		const run = pendingDeleteRef.current;
		pendingDeleteRef.current = null;
		pendingRejectRef.current = null;
		run?.(token);
	}, []);

	const onDeleteTurnstileError = useCallback(() => {
		const rej = pendingRejectRef.current;
		pendingDeleteRef.current = null;
		pendingRejectRef.current = null;
		rej?.(new Error("Human verification failed."));
	}, []);

	const deleteWithVerification = useCallback(
		async (url: string, init?: RequestInit): Promise<Response> => {
			await loadSession();
			if (!enabledRef.current || !siteKey) {
				return fetch(url, { ...init, method: "DELETE", credentials: "same-origin" });
			}
			return new Promise<Response>((resolve, reject) => {
				pendingDeleteRef.current = (token) => {
					const headers = new Headers(init?.headers as HeadersInit);
					headers.set(TURNSTILE_TOKEN_HEADER, token);
					fetch(url, {
						...init,
						method: "DELETE",
						credentials: "same-origin",
						headers,
					}).then(resolve, reject);
				};
				pendingRejectRef.current = reject;
				queueMicrotask(() => {
					try {
						deleteTurnstileRef.current?.reset();
						deleteTurnstileRef.current?.execute();
					} catch (e) {
						reject(e instanceof Error ? e : new Error("Turnstile failed to start."));
					}
				});
			});
		},
		[loadSession]
	);

	const handleAddVerify = useCallback(
		async (token: string) => {
			const res = await fetch("/api/human-verify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify({ token }),
			});
			if (res.ok) await loadSession();
		},
		[loadSession]
	);

	const canAddContent = !enabled || addVerified;

	const value = useMemo(
		() => ({
			enabled,
			addVerified,
			sessionLoading,
			canAddContent,
			showAddGate,
			refreshSession: loadSession,
			deleteWithVerification,
		}),
		[
			enabled,
			addVerified,
			sessionLoading,
			canAddContent,
			showAddGate,
			loadSession,
			deleteWithVerification,
		]
	);

	return (
		<HumanVerificationContext.Provider value={value}>
			{enabled && siteKey ? (
				<>
					{showAddGate && !addVerified ? (
						<div
							role="region"
							aria-label="Human verification"
							className="mb-4 rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
						>
							<p className="font-medium mb-2">Verify once to add content this session</p>
							<p className="text-amber-900/80 dark:text-amber-200/90 mb-3 text-xs">
								After you complete the check, you can add items until you close the browser. Each delete
								still asks for verification.
							</p>
							<Turnstile siteKey={siteKey} onSuccess={handleAddVerify} options={{ theme: "auto" }} />
						</div>
					) : null}
					<Turnstile
						ref={deleteTurnstileRef}
						siteKey={siteKey}
						options={{ size: "invisible", execution: "execute" }}
						onSuccess={onDeleteTurnstileSuccess}
						onError={onDeleteTurnstileError}
					/>
				</>
			) : null}
			{children}
		</HumanVerificationContext.Provider>
	);
}
