import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

function faviconContentHash(): string {
	const filePath = join(process.cwd(), "public", "favicon.svg");
	const buf = readFileSync(filePath);
	return createHash("sha256").update(buf).digest("hex").slice(0, 16);
}

/** WSL + repo on /mnt/c/... often misses fs events; set NEXT_DEV_POLL_INTERVAL_MS (e.g. 1000) or use `pnpm dev:wsl`. */
const pollMs = Number(process.env.NEXT_DEV_POLL_INTERVAL_MS);
const watchOptions =
	Number.isFinite(pollMs) && pollMs > 0 ? { pollIntervalMs: pollMs } : undefined;

const nextConfig: NextConfig = {
	/* config options here */
	serverExternalPackages: ["node-ical"],
	...(watchOptions ? { watchOptions } : {}),
	env: {
		NEXT_PUBLIC_FAVICON_HASH: faviconContentHash(),
	},
};

export default nextConfig;

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
