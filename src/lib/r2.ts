import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cache } from "react";

/** R2 bucket for organization photos (run `pnpm cf-typegen` after adding R2 to wrangler for full types). */
type EnvWithR2 = { BUCKET_ORG_PHOTOS: R2Bucket };

export const getOrgPhotosBucket = cache(() => {
	const { env } = getCloudflareContext();
	return (env as EnvWithR2).BUCKET_ORG_PHOTOS;
});

/** R2 key prefix for organization photos. */
export const ORG_PHOTOS_PREFIX = "org-photos/";
