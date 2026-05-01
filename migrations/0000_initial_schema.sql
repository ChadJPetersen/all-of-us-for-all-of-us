-- Single initial migration for an empty database.
-- Uses small integer codes (0-255) and FKs to save space; SQLite stores small integers in 1 byte.
-- Type tables first (referenced by organizations), then organizations.

-- =============================================================================
-- location_types: 0=global, 1=country, 2=state_province, 3=local (tiny range -> 1 byte)
-- sort_order: most local to global (Local -> State -> Country -> Global)
-- =============================================================================
CREATE TABLE IF NOT EXISTS location_types (
  id TINYINT PRIMARY KEY CHECK(id >= 0 AND id <= 255),
  label TEXT NOT NULL UNIQUE,
  sort_order TINYINT NOT NULL UNIQUE
);

INSERT OR IGNORE INTO location_types (id, label, sort_order) VALUES
  (1, 'Local (ZIP)', 1),
  (2, 'State / Province', 2),
  (3, 'Country', 3),
  (4, 'Global', 4);

-- =============================================================================
-- primary_types: 0=community, 1=advocacy, 2=education, 3=civic, 4=other (tiny range -> 1 byte)
-- sort_order: alphabetical (Advocacy, Civic, Community, Education, Other)
-- =============================================================================
CREATE TABLE IF NOT EXISTS primary_types (
  id TINYINT PRIMARY KEY CHECK(id >= 0 AND id <= 255),
  label TEXT NOT NULL UNIQUE
);

INSERT OR IGNORE INTO primary_types (id, label) VALUES
  (1, 'Advocacy'),
  (2, 'Civic'),
  (3, 'Community'),
  (4, 'Education'),
  (5, 'Other');

-- =============================================================================
-- location_areas: location_type 0=country, 1=state_province, 2=local (tiny). code_int: country 1=US; state 1-51; local=zip number.
-- parent_id FK replaces parent_code. Geo fence: min/max lat/lng, center.
-- =============================================================================
CREATE TABLE IF NOT EXISTS location_areas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_type INTEGER NOT NULL CHECK(location_type >= 0 AND location_type <= 2),
  code_int INTEGER NOT NULL,
  parent_id INTEGER REFERENCES location_areas(id),
  name TEXT NOT NULL,
  min_lat REAL NOT NULL,
  max_lat REAL NOT NULL,
  min_lng REAL NOT NULL,
  max_lng REAL NOT NULL,
  center_lat REAL NOT NULL,
  center_lng REAL NOT NULL,
  UNIQUE(location_type, code_int)
);
--Indexing is done in the zip_code_inserter.sql file

-- =============================================================================
-- organizations: FKs to type tables (ids are small integers). Geo (lat/lng) for nearest-to-user.
-- Datetime columns: _utc = Unix seconds (UTC), _offset_minutes = minutes from UTC (NULL = server-generated/UTC).
-- =============================================================================
CREATE TABLE IF NOT EXISTS organizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE CHECK (slug = lower(slug)),
  address TEXT,
  primary_type_id INTEGER REFERENCES primary_types(id),
  location_type_id INTEGER NOT NULL REFERENCES location_types(id),
  location_area_id INTEGER REFERENCES location_areas(id),
  parent_id INTEGER REFERENCES organizations(id),
  lat REAL,
  lng REAL,
  created_at_utc INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  created_at_offset_minutes INTEGER,
  updated_at_utc INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at_offset_minutes INTEGER,
  description TEXT NOT NULL,
  photo_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_organizations_parent ON organizations(parent_id);
CREATE INDEX IF NOT EXISTS idx_organizations_location_type_id ON organizations(location_type_id);
CREATE INDEX IF NOT EXISTS idx_organizations_primary_type_id ON organizations(primary_type_id);
CREATE INDEX IF NOT EXISTS idx_organizations_location_area_id ON organizations(location_area_id);
CREATE INDEX IF NOT EXISTS idx_organizations_geo ON organizations(lat, lng);

-- Multiple calendar links per organization (replaces single calendar_link on organizations).
-- in place for now so we do not alter organizations table structure.

CREATE TABLE IF NOT EXISTS organization_calendar_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  link TEXT NOT NULL UNIQUE,
  name TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_organization_calendar_links_org_id
  ON organization_calendar_links(organization_id);


-- Volunteer opportunities belong to an organization.
-- Datetime columns: _utc = Unix seconds (UTC), _offset_minutes = minutes from UTC (NULL = server/UTC).
CREATE TABLE IF NOT EXISTS volunteer_opportunities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  link TEXT,
  schedule_type_id INTEGER REFERENCES schedule_types(id),
  role_type_id INTEGER REFERENCES volunteer_role_types(id),
  start_at_utc INTEGER,
  start_at_offset_minutes INTEGER,
  end_at_utc INTEGER,
  end_at_offset_minutes INTEGER,
  due_date TEXT,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurrence_description TEXT,
  window_start_date TEXT,
  window_end_date TEXT,
  volunteers_needed INTEGER,
  location_override TEXT,
  created_at_utc INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  created_at_offset_minutes INTEGER,
  updated_at_utc INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at_offset_minutes INTEGER
);


CREATE INDEX IF NOT EXISTS idx_volunteer_opportunities_organization_id ON volunteer_opportunities(organization_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_opportunities_start_at_utc ON volunteer_opportunities(start_at_utc);
CREATE INDEX IF NOT EXISTS idx_volunteer_opportunities_due_date ON volunteer_opportunities(due_date);
CREATE INDEX IF NOT EXISTS idx_volunteer_opportunities_window_end_date ON volunteer_opportunities(window_end_date);


-- Volunteer opportunity scheduling and metadata (schedule type, slots, due date, recurring, role, etc.)

-- =============================================================================
-- schedule_types: 1=open_ended, 2=flexible, 3=set_shift (one-time event / specific shift)
-- =============================================================================
CREATE TABLE IF NOT EXISTS schedule_types (
  id TINYINT PRIMARY KEY CHECK(id >= 0 AND id <= 255),
  label TEXT NOT NULL UNIQUE,
  sort_order TINYINT NOT NULL
);

INSERT OR IGNORE INTO schedule_types (id, label, sort_order) VALUES
  (1, 'Open-ended', 1),
  (2, 'Flexible timeframe', 2),
  (3, 'Set shift / one-time event', 3);

-- =============================================================================
-- volunteer_role_types: role/category for the opportunity (e.g. General, Event support)
-- =============================================================================
CREATE TABLE IF NOT EXISTS volunteer_role_types (
  id TINYINT PRIMARY KEY CHECK(id >= 0 AND id <= 255),
  label TEXT NOT NULL UNIQUE
);

INSERT OR IGNORE INTO volunteer_role_types (id, label) VALUES
  (1, 'General'),
  (2, 'Event support'),
  (3, 'Skilled / professional'),
  (4, 'Ongoing'),
  (5, 'Other');


-- =============================================================================
-- volunteer_opportunity_slots: multiple date/time slots per opportunity (for set shift)
-- Datetime columns: _utc = Unix seconds (UTC), _offset_minutes = minutes from UTC (NULL = UTC).
-- =============================================================================
CREATE TABLE IF NOT EXISTS volunteer_opportunity_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  volunteer_opportunity_id INTEGER NOT NULL REFERENCES volunteer_opportunities(id) ON DELETE CASCADE,
  start_at_utc INTEGER NOT NULL,
  start_at_offset_minutes INTEGER,
  end_at_utc INTEGER,
  end_at_offset_minutes INTEGER
);

CREATE INDEX IF NOT EXISTS idx_volunteer_opportunity_slots_vo_id
  ON volunteer_opportunity_slots(volunteer_opportunity_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_opportunity_slots_vo_start
  ON volunteer_opportunity_slots(volunteer_opportunity_id, start_at_utc);


-- Resource types (categories for organization resources).
-- Organizations can add resources with one of these types.
CREATE TABLE IF NOT EXISTS resource_types (
  id TINYINT PRIMARY KEY CHECK(id >= 0 AND id <= 255),
  label TEXT NOT NULL UNIQUE
);

INSERT OR IGNORE INTO resource_types (id, label) VALUES
  (1, 'Help'),
  (2, 'Art & Music'),
  (3, 'Education'),
  (4, 'Local News'),
  (5, 'Other');

-- Organization resources: title, optional description/link, and type.
-- Datetime columns: _utc = Unix seconds (UTC), _offset_minutes = minutes from UTC (NULL = UTC).
CREATE TABLE IF NOT EXISTS organization_resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  resource_type_id INTEGER NOT NULL REFERENCES resource_types(id),
  title TEXT NOT NULL,
  description TEXT,
  link TEXT,
  created_at_utc INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  created_at_offset_minutes INTEGER,
  updated_at_utc INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at_offset_minutes INTEGER
);

CREATE INDEX IF NOT EXISTS idx_organization_resources_organization_id ON organization_resources(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_resources_resource_type_id ON organization_resources(resource_type_id);


-- Analytics/observation events for understanding usage (searches, clicks, page views).
-- Stored in D1; safe for Cloudflare Workers/Pages edge.
-- created_at_utc = Unix seconds (UTC), created_at_offset_minutes = NULL (server/UTC).
CREATE TABLE IF NOT EXISTS observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at_utc INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  created_at_offset_minutes INTEGER,
  type TEXT NOT NULL CHECK(type IN ('search', 'click', 'page_view')),
  payload TEXT NOT NULL,
  session_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_observations_type ON observations(type);
CREATE INDEX IF NOT EXISTS idx_observations_created_at_utc ON observations(created_at_utc);
CREATE INDEX IF NOT EXISTS idx_observations_session_id ON observations(session_id);

-- =============================================================================
-- Query performance: indexes for API query patterns
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_location_areas_type_name
  ON location_areas(location_type, name);
CREATE INDEX IF NOT EXISTS idx_organization_calendar_links_org_sort_id
  ON organization_calendar_links(organization_id, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_volunteer_opportunities_org_created
  ON volunteer_opportunities(organization_id, created_at_utc);
CREATE INDEX IF NOT EXISTS idx_volunteer_opportunities_created_at
  ON volunteer_opportunities(created_at_utc);
CREATE INDEX IF NOT EXISTS idx_organization_resources_org_created
  ON organization_resources(organization_id, created_at_utc);
CREATE INDEX IF NOT EXISTS idx_organization_resources_type_title
  ON organization_resources(resource_type_id, title);
CREATE INDEX IF NOT EXISTS idx_organizations_location_type_id_id
  ON organizations(location_type_id, id);
CREATE INDEX IF NOT EXISTS idx_organizations_name
  ON organizations(name);

-- =============================================================================
-- Full-text search (FTS5) for search API (MATCH instead of LIKE)
-- =============================================================================
CREATE VIRTUAL TABLE IF NOT EXISTS organizations_fts USING fts5(name);
CREATE VIRTUAL TABLE IF NOT EXISTS organization_resources_fts USING fts5(title, description);
CREATE VIRTUAL TABLE IF NOT EXISTS volunteer_opportunities_fts USING fts5(title, description);

CREATE TRIGGER IF NOT EXISTS organizations_fts_insert AFTER INSERT ON organizations BEGIN INSERT INTO organizations_fts(rowid, name) VALUES (new.id, new.name); END;
CREATE TRIGGER IF NOT EXISTS organizations_fts_update AFTER UPDATE OF name ON organizations BEGIN INSERT INTO organizations_fts(organizations_fts, rowid, name) VALUES ('delete', old.id, old.name); INSERT INTO organizations_fts(rowid, name) VALUES (new.id, new.name); END;
CREATE TRIGGER IF NOT EXISTS organizations_fts_delete AFTER DELETE ON organizations BEGIN INSERT INTO organizations_fts(organizations_fts, rowid, name) VALUES ('delete', old.id, old.name); END;

CREATE TRIGGER IF NOT EXISTS organization_resources_fts_insert AFTER INSERT ON organization_resources BEGIN INSERT INTO organization_resources_fts(rowid, title, description) VALUES (new.id, new.title, COALESCE(new.description, '')); END;
CREATE TRIGGER IF NOT EXISTS organization_resources_fts_update AFTER UPDATE OF title, description ON organization_resources BEGIN INSERT INTO organization_resources_fts(organization_resources_fts, rowid, title, description) VALUES ('delete', old.id, old.title, COALESCE(old.description, '')); INSERT INTO organization_resources_fts(rowid, title, description) VALUES (new.id, new.title, COALESCE(new.description, '')); END;
CREATE TRIGGER IF NOT EXISTS organization_resources_fts_delete AFTER DELETE ON organization_resources BEGIN INSERT INTO organization_resources_fts(organization_resources_fts, rowid, title, description) VALUES ('delete', old.id, old.title, COALESCE(old.description, '')); END;

CREATE TRIGGER IF NOT EXISTS volunteer_opportunities_fts_insert AFTER INSERT ON volunteer_opportunities BEGIN INSERT INTO volunteer_opportunities_fts(rowid, title, description) VALUES (new.id, new.title, COALESCE(new.description, '')); END;
CREATE TRIGGER IF NOT EXISTS volunteer_opportunities_fts_update AFTER UPDATE OF title, description ON volunteer_opportunities BEGIN INSERT INTO volunteer_opportunities_fts(volunteer_opportunities_fts, rowid, title, description) VALUES ('delete', old.id, old.title, COALESCE(old.description, '')); INSERT INTO volunteer_opportunities_fts(rowid, title, description) VALUES (new.id, new.title, COALESCE(new.description, '')); END;
CREATE TRIGGER IF NOT EXISTS volunteer_opportunities_fts_delete AFTER DELETE ON volunteer_opportunities BEGIN INSERT INTO volunteer_opportunities_fts(volunteer_opportunities_fts, rowid, title, description) VALUES ('delete', old.id, old.title, COALESCE(old.description, '')); END;
