-- Organization contact information: who to contact, how, and what for.
-- Multiple contacts per organization (e.g. general inquiries, volunteer coordinator, donations).

CREATE TABLE IF NOT EXISTS organization_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  contact_purpose TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_organization_contacts_organization_id
  ON organization_contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_contacts_org_sort
  ON organization_contacts(organization_id, sort_order, id);
