# Organization images (Cloudflare R2)

Organization photos are stored in **Cloudflare R2** and served through this app. The database only stores the image URL (e.g. `/api/organization-photo/<id>.<ext>`).

## Setup

1. **Create an R2 bucket** (once per environment):

   ```bash
   npx wrangler r2 bucket create org-photos
   ```

   The bucket name must match `bucket_name` in `wrangler.jsonc` (`org-photos`).

2. **Regenerate Cloudflare env types** (so `BUCKET_ORG_PHOTOS` is typed):

   ```bash
   pnpm cf-typegen
   ```

3. **Deploy** as usual. The Worker will have the `BUCKET_ORG_PHOTOS` binding.

## Flow

- **Upload:** User selects an image on the organization edit (or add) page → **browser resizes** the image (longest side max 1200px) and **converts to WebP** (quality 0.85) using the Canvas API → `POST /api/upload-organization-photo` with the WebP blob → file is written to R2 under `org-photos/<uuid>.webp` → API returns `{ url: "/api/organization-photo/<uuid>.webp" }` → form stores that URL in `photo_url` and user saves.
- **Serve:** `<img src="/api/organization-photo/...">` → `GET /api/organization-photo/[...path]` → stream from R2 with correct `Content-Type` and cache headers.

Resize and WebP conversion happen in the browser so no server-side WASM or image libraries are required; the server only validates and stores the uploaded file (max 2MB after conversion).

The R2 bucket is **not** public; images are served only via the app route, so you can add auth or rate limiting later if needed.

## Alternatives

- **Data URLs:** The app still accepts pasted or inline data URLs for `photo_url` (e.g. from the URL field). Good for small images or external URLs; not ideal for large uploads (request/response size limits, DB size).
- **Cloudflare Images:** If you need resizing, format conversion, or a CDN-optimized image pipeline, consider [Cloudflare Images](https://developers.cloudflare.com/images/) and store the returned image ID or URL in `photo_url`.
