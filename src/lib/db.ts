import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cache } from "react";

/** Env with D1 binding (run `pnpm cf-typegen` after adding D1 to wrangler for full types). */
type EnvWithDb = { DB: D1Database };

/**
 * Get D1 database for the current request.
 * Use in Server Components and Route Handlers (non-static).
 */
export const getDb = cache(() => {
	const { env } = getCloudflareContext();
	return (env as EnvWithDb).DB;
});

/**
 * Get D1 for static routes (ISR/SSG) where context is async.
 */
export async function getDbAsync() {
	const { env } = await getCloudflareContext({ async: true });
	return (env as EnvWithDb).DB;
}
