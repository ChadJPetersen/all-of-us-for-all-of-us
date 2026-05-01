# Database (Cloudflare D1) Setup

This app uses **Cloudflare D1** (SQLite at the edge) so the site stays cost-effective and fast on Cloudflare.

## 1. Create the D1 database

From the project root:

```bash
npx wrangler d1 create a4a-db
```

Copy the `database_id` from the output (a UUID).

## 2. Wire the database into Wrangler

Open `wrangler.jsonc` and replace `REPLACE_AFTER_D1_CREATE` in the `d1_databases` entry with your `database_id`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "a4a-db",
    "database_id": "<paste-your-database_id-here>",
    "migrations_dir": "migrations"
  }
]
```

## 3. Apply migrations

Run migrations against the **remote** database:

```bash
npx wrangler d1 migrations apply a4a-db --remote
```

For **local** development (optional):

```bash
npx wrangler d1 migrations apply a4a-db --local
```

## 4. Regenerate TypeScript types

So that `env.DB` is typed in your code:

```bash
pnpm cf-typegen
# or: npx wrangler types --env-interface CloudflareEnv ./cloudflare-env.d.ts
```

## Schema: Organizations

Everything in the app is scoped to an **Organization**. The `organizations` table links to type tables via foreign keys:

| Column               | Description |
|----------------------|-------------|
| `location_type_id`   | FK to `location_types.id` (global, country, state_province, local) |
| `primary_type_id`    | FK to `primary_types.id` (e.g. community, advocacy, education); nullable |
| `location_area_id`   | FK to `location_areas.id` (country/state/ZIP area); NULL for global |
| `parent_id`          | Optional parent group (e.g. local chapter of a national group) |
| `lat`, `lng`         | Geo coordinates for “nearest to user” sorting |

Reference tables: **`location_types`**, **`primary_types`**, **`location_areas`** (all in the initial migration).

## Location and ordering

- **GET /api/organizations** accepts query params: `lat`, `lng`, and/or `zip`.  
  Results are ordered by distance (nearest first when lat/lng are given), then by locality (local before state/province before country before global).
- Users can set location via **Use my location** (browser geolocation) or **ZIP code** in the header; the choice is stored in a cookie and used when calling the API.

## Location reference data and geo fences

The initial migration `0000_initial_schema.sql` creates:

- **`location_types`** – Small integer codes to save space (SQLite stores 0–255 in 1 byte). Pre-filled: `code` 0=global, 1=country, 2=state_province, 3=local; fixed `id` 1–4.
- **`primary_types`** – Same idea: `code` 0–4 (community, advocacy, education, civic, other), fixed `id` 1–5.
- **`location_areas`** – Geo-fenced areas; **numeric only** for type and code:
  - **`location_type`** INTEGER: 0=country, 1=state_province, 2=local.
  - **`code_int`** INTEGER: country 1=US; state 1–51 (order AL…WY); local = 5-digit zip (e.g. 82001). **`parent_id`** FK to `location_areas(id)` (no text `parent_code`).
  - **Country:** United States (one row) with full-US bounding box.
  - **State/province:** All 50 US states + DC; each has `code_int` 1–51, `parent_id` = US row id, plus geo fence and center.
  - **Local (ZIP):** One representative ZIP per state (51 rows); `code_int` = zip as integer, `parent_id` = state row id. Full US ZIP list (~41k) can be bulk-loaded with `location_type=2`, `code_int` = zip, `parent_id` = state id.

Use the bounding box to test whether a point `(lat, lng)` lies inside an area:  
`lat BETWEEN min_lat AND max_lat AND lng BETWEEN min_lng AND max_lng`.

## Seeding data

Insert groups via the D1 dashboard or CLI. Use IDs from the type tables (`location_types.id` 0–3, `primary_types.id` 0–4). Example for a global group (location_type_id 0 = global, primary_type_id 0 = community):

```bash
npx wrangler d1 execute a4a-db --remote --command "
INSERT INTO organizations (name, slug, primary_type_id, location_type_id, location_area_id, lat, lng)
VALUES (
  'All of Us For All of Us',
  'a4a-global',
  0,
  0,
  NULL,
  NULL,
  NULL
);
"
```
