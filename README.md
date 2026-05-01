# All of Us For All of Us

**Building community as though the revolution already happened.**

A community-focused web app for the *Beloved Community* initiative: discover organizations, events, resources, and volunteer opportunities; set your location to see what’s near you; and explore a shared calendar built from organization iCal/ICS feeds.

---

## Tech stack

- **Next.js 16** (App Router) with **React 19**, **TypeScript**, **Tailwind CSS**
- **Cloudflare**: deployed via **OpenNext**; data in **D1** (SQLite at the edge) and **R2** (organization photos)
- **FullCalendar** for the aggregated calendar view; **node-ical** for parsing iCal/ICS

---

## Features

### Home

- **What We Do** — Quilt-style links to Calendar, Resources, and Get Involved / Volunteer.
- **Who Are We** — Intro video and rotating carousel of guiding principles (with link to full Mission & Guiding Principles page).
- **Resources by category** — Pick a resource type to see organizations and their resources in that category.
- **Organizations near you** — Location-based list (ZIP or “Use my location” + radius). Virtualized infinite list; “Add your organization” links to the Organizations page.

### Location

- **Location picker** (header) — Set location by **ZIP code** or **Use my location**; optional **radius (miles)**. Stored in a cookie and used for “near you” ordering and filtering.
- **Geocoding** — ZIP/place lookup and geo-fenced areas (country, state, local) for scoping organizations.

### Calendar

- **Aggregated calendar** — Events from all organizations’ iCal/ICS and web calendar URLs.
- **FullCalendar** — Day, week, and list views; time grid for timed events.
- **Calendar picker** — Choose which organization calendars to show; selection persisted in `localStorage`.
- **Event modal** — Click an event for details; supports adding iCal/webcal links to personal calendar.

### Resources

- **Browse by type** — Filter by resource type (e.g. help, art & music, education, news).
- **List view** — Resources with organization name, type, title, description, and optional link.
- **CRUD** — Create, edit, and delete resources (from org context or Resources page where applicable).

### Organizations

- **List** — Paginated, filterable list (location type, primary type, location area, search). Sorted by distance when user location is set.
- **Add organization** — Form: name, slug, description, primary type, location type/area, address, photo upload (R2), calendar links, and optional parent org.
- **Organization detail** (`/organizations/[slug]`) — Profile with description, photo, address, calendar links, volunteer opportunities, resources, and contacts.
- **Edit organization** — Update profile, photo, calendar links, volunteer opportunities, resources, and contacts.
- **Organization photos** — Upload and serve images via Cloudflare R2; optional WebP conversion.

### Volunteer opportunities

- **List** — Filter by schedule type, upcoming vs including past; sort by next start, due date, or created.
- **Fields** — Title, description, link, schedule type, role type, single/multi slot times, due date, recurrence, flexible windows, volunteers needed, location override.
- **Organization link** — Each opportunity links to its organization.

### Search

- **Global search** — Single query across **organizations**, **calendars**, **resources**, and **volunteer opportunities**.
- **Results** — Grouped by type with links to the relevant detail pages.

### Principles

- **Mission & Guiding Principles** (`/principles`) — Beloved Community mission statement and guiding principles (finalized June 3, 2025).

### Accessibility & UX

- **Skip to main content** link; semantic HTML and ARIA where needed.
- **Keyboard** — Logical tab order; focus rings; modals (e.g. calendar) close with Escape.
- **Reduced motion** — `prefers-reduced-motion` respected (e.g. carousel animation disabled). See `docs/ACCESSIBILITY.md`.

### Analytics (optional)

- **ObservationTracker** — Tracks page views and link clicks; sends events to `POST /api/observe` and stores in D1.

---

## Getting started

### Prerequisites

- **Node.js** and **pnpm** (see `package.json` for `packageManager`).
- **Cloudflare account** — for D1 and R2 (and deployment).

### Install

If on windows use subsystem for linux (WSL)
```bash
pnpm install
```

### Database (D1)

1. Create the D1 database: `pnpx wrangler d1 create a4a-db`
2. Put the returned `database_id` into `wrangler.jsonc` (replace `REPLACE_AFTER_D1_CREATE`).
3. Apply migrations: `pnpx wrangler d1 migrations apply a4a-db --remote` (or `--local` for dev).
4. Regenerate types: `pnpm cf-typegen`

See **`docs/DATABASE.md`** for schema, location/ordering, and seeding.

### R2 (organization photos)

Configure the `org-photos` R2 bucket in your Cloudflare account; the app uses the `BUCKET_ORG_PHOTOS` binding. See **`docs/IMAGES.md`** if present.

### Run locally

```bash
pnpm dev
```

Runs Next.js with Turbopack at [http://localhost:3000](http://localhost:3000).

### Build & deploy (Cloudflare)

```bash
pnpm run build    # next build
pnpm run deploy   # opennextjs-cloudflare build && opennextjs-cloudflare deploy
# or
pnpm run upload   # build + upload
pnpm run preview  # build + preview
```

### AllOfUsForAllOf.us

The Worker is configured to serve **allofusforallof.us** and **www.allofusforallof.us** via Custom Domains in `wrangler.jsonc`. After you deploy, Cloudflare will create the DNS records and certificates for that domain.

**Requirement:** The domain **AllOfUsForAllOf.us** must be added to your Cloudflare account as a zone (i.e. the site is “active” on Cloudflare with DNS proxied). If the domain is not yet on Cloudflare, add it under **Websites** → **Add a site** and complete the nameserver switch. Then run `pnpm run deploy` again so the Custom Domain is attached to the Worker.

### Deploy on push (GitHub → Cloudflare)

To have Cloudflare update automatically when you push to GitHub, use one of these:

#### Option 1: Cloudflare Workers Builds (recommended)

1. **Create the Worker in Cloudflare** (if you haven’t already): deploy once locally with `pnpm run deploy` so the Worker exists.
2. **Connect GitHub**: [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages) → your Worker → **Settings** → **Builds** → **Manage** under **Git Repository** (or **Create application** → **Workers** → **Connect to Git** for a new Worker).
3. **Authorize**: Install the [Cloudflare Workers & Pages GitHub App](https://github.com/apps/cloudflare-workers-and-pages) and grant access to this repo.
4. **Configure build** in the Worker’s **Settings** → **Build**:
   - **Build command (optional):** `pnpm install`
   - **Deploy command:** `pnpm run deploy`
   - **Root directory:** leave blank (repo root).
5. **Production branch:** set to `main` (or the branch you want to deploy from).
6. **Secrets / env:** if the app or OpenNext need env vars (e.g. `NEXT_PUBLIC_*` or build-time vars), add them under **Build** → **Build variables and secrets**. See [OpenNext env vars](https://opennext.js.org/cloudflare/howtos/env-vars#workers-builds).

After this, each push to the production branch will build and deploy automatically. PRs can get preview deployments if you enable non-production branch builds.

#### Option 2: GitHub Actions

1. In GitHub: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:
   - `CLOUDFLARE_API_TOKEN`: create at [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens) with “Edit Workers Scripts” (and D1/R2 if needed).
   - `CLOUDFLARE_ACCOUNT_ID`: from the Workers & Pages dashboard URL or Overview.
2. A workflow is included at `.github/workflows/deploy.yml`; it runs `pnpm run deploy` on every push to `main`. Ensure the two secrets above are set, then push to trigger a deploy.

---

## Scripts

| Script            | Description                                      |
|-------------------|--------------------------------------------------|
| `pnpm dev`        | Start Next.js dev server (Turbopack)             |
| `pnpm build`      | Next.js production build                         |
| `pnpm start`      | Start production server                          |
| `pnpm lint`       | Run ESLint                                       |
| `pnpm deploy`     | Build with OpenNext and deploy to Cloudflare     |
| `pnpm upload`     | Build and upload (OpenNext + Cloudflare)         |
| `pnpm preview`    | Build and preview (OpenNext + Cloudflare)        |
| `pnpm cf-typegen` | Generate Cloudflare env types (`cloudflare-env.d.ts`) |
| `pnpm update-zip-names` | Update ZIP names in migration (see `scripts/`)   |

---

## Docs

- **`docs/DATABASE.md`** — D1 setup, schema, location types/areas, geo fences, seeding.
- **`docs/ACCESSIBILITY.md`** — Keyboard, focus, contrast, motion, and beyond-ARIA guidance.
- **`docs/IMAGES.md`** — Organization photos and R2 (if present).

---

## License

Private / All rights reserved (or add your chosen license).
