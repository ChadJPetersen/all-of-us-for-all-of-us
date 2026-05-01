import { getDb } from "@/lib/db";
import { escapeLike, buildFts5Query } from "@/lib/strings";
import type {
	SearchOrganizationHit,
	SearchCalendarHit,
	SearchResourceHit,
	SearchVolunteerHit,
} from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

/** Re-export search types for consumers that import from the route. */
export type {
	SearchOrganizationHit,
	SearchCalendarHit,
	SearchResourceHit,
	SearchVolunteerHit,
} from "@/lib/types";
export type { SearchHit } from "@/lib/types";

/**
 * GET /api/search?q=...
 * Searches organizations (name), calendars (org name for orgs with calendar links),
 * organization_resources (title, description), volunteer_opportunities (title, description).
 */
export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const q = searchParams.get("q")?.trim() ?? "";
		if (q.length === 0) {
			return NextResponse.json({
				organizations: [],
				calendars: [],
				resources: [],
				volunteerOpportunities: [],
			});
		}

		const escaped = escapeLike(q);
		const pattern = `%${escaped}%`;
		const ftsQuery = buildFts5Query(q);

		const db = getDb();
		const results: {
			organizations: SearchOrganizationHit[];
			calendars: SearchCalendarHit[];
			resources: SearchResourceHit[];
			volunteerOpportunities: SearchVolunteerHit[];
		} = {
			organizations: [],
			calendars: [],
			resources: [],
			volunteerOpportunities: [],
		};

		// Organizations: FTS5 when available (faster), else LIKE
		try {
			if (ftsQuery) {
				const orgStmt = db.prepare(
					`SELECT id, name, slug FROM organizations WHERE id IN (
						SELECT rowid FROM organizations_fts WHERE organizations_fts MATCH ? LIMIT 50
					) ORDER BY name`
				);
				const orgRows = (await orgStmt.bind(ftsQuery).all()).results as { id: number; name: string; slug: string | null }[] | undefined;
				if (orgRows?.length) {
					results.organizations = orgRows.map((row) => ({
						type: "organization",
						id: row.id,
						name: row.name,
						slug: row.slug,
						href: "/organizations",
					}));
				}
			}
		} catch {
			// FTS table may not exist (migration not run); fall back to LIKE
		}
		if (results.organizations.length === 0) {
			const orgStmt = db.prepare(
				"SELECT id, name, slug FROM organizations WHERE name LIKE ? ESCAPE '\\' ORDER BY name LIMIT 50"
			);
			const orgRows = (await orgStmt.bind(pattern).all()).results as { id: number; name: string; slug: string | null }[] | undefined;
			if (orgRows?.length) {
				results.organizations = orgRows.map((row) => ({
					type: "organization",
					id: row.id,
					name: row.name,
					slug: row.slug,
					href: "/organizations",
				}));
			}
		}

		// Calendars: organizations with calendar links whose name matches (FTS or LIKE)
		try {
			let calRows: { id: number; name: string; link: string; link_id: number; calendar_name?: string | null }[] | undefined;
			if (ftsQuery) {
				try {
					const calStmt = db.prepare(
						`SELECT o.id, o.name, ocl.id AS link_id, ocl.link, ocl.name AS calendar_name
						 FROM organizations o
						 INNER JOIN organization_calendar_links ocl ON ocl.organization_id = o.id
						 WHERE o.id IN (SELECT rowid FROM organizations_fts WHERE organizations_fts MATCH ? LIMIT 50)
						 ORDER BY o.name, ocl.sort_order, ocl.id`
					);
					calRows = (await calStmt.bind(ftsQuery).all()).results as { id: number; name: string; link_id: number; link: string; calendar_name?: string | null }[];
				} catch {
					calRows = undefined;
				}
			}
			if (!calRows?.length) {
				const calStmt = db.prepare(
					`SELECT o.id, o.name, ocl.id AS link_id, ocl.link, ocl.name AS calendar_name
					 FROM organizations o
					 INNER JOIN organization_calendar_links ocl ON ocl.organization_id = o.id
					 WHERE o.name LIKE ? ESCAPE '\\'
					 ORDER BY o.name, ocl.sort_order, ocl.id`
				);
				calRows = (await calStmt.bind(pattern).all()).results as { id: number; name: string; link_id: number; link: string; calendar_name?: string | null }[];
			}
			if (calRows?.length) {
				const byId = new Map<number, { name: string; links: { id: number; link: string; name?: string | null }[] }>();
				for (const row of calRows) {
					const existing = byId.get(row.id);
					const entry = { id: row.link_id, link: row.link, name: row.calendar_name ?? null };
					if (existing) {
						existing.links.push(entry);
					} else {
						byId.set(row.id, { name: row.name, links: [entry] });
					}
				}
				results.calendars = Array.from(byId.entries())
					.slice(0, 50)
					.map(([id, { name, links }]) => ({
						type: "calendar" as const,
						id,
						name,
						calendar_links: links,
						href: "/calendar",
					}));
			}
		} catch {
			// fallback already used or table missing
		}

		// Organization resources: FTS5 when available, else LIKE
		try {
			if (ftsQuery) {
				try {
					const resStmt = db.prepare(
						`SELECT r.id, r.organization_id, r.title, r.description, rt.label AS resource_type_label, g.name AS organization_name
						 FROM organization_resources r
						 JOIN resource_types rt ON rt.id = r.resource_type_id
						 JOIN organizations g ON g.id = r.organization_id
						 WHERE r.id IN (SELECT rowid FROM organization_resources_fts WHERE organization_resources_fts MATCH ? LIMIT 50)
						 ORDER BY r.title`
					);
					const resRows = (await resStmt.bind(ftsQuery).all()).results as {
						id: number;
						organization_id: number;
						title: string;
						description: string | null;
						resource_type_label: string;
						organization_name: string;
					}[];
					if (resRows?.length) {
						results.resources = resRows.map((row) => ({
							type: "resource",
							id: row.id,
							organization_id: row.organization_id,
							organization_name: row.organization_name,
							title: row.title,
							description: row.description,
							resource_type_label: row.resource_type_label,
							href: "/resources",
						}));
					}
				} catch {
					// FTS table may not exist
				}
			}
			if (results.resources.length === 0) {
				const resStmt = db.prepare(
					`SELECT r.id, r.organization_id, r.title, r.description, rt.label AS resource_type_label, g.name AS organization_name
					 FROM organization_resources r
					 JOIN resource_types rt ON rt.id = r.resource_type_id
					 JOIN organizations g ON g.id = r.organization_id
					 WHERE r.title LIKE ? ESCAPE '\\' OR (r.description IS NOT NULL AND r.description LIKE ? ESCAPE '\\')
					 ORDER BY r.title LIMIT 50`
				);
				const resRows = (await resStmt.bind(pattern, pattern).all()).results as {
					id: number;
					organization_id: number;
					title: string;
					description: string | null;
					resource_type_label: string;
					organization_name: string;
				}[];
				if (resRows?.length) {
					results.resources = resRows.map((row) => ({
						type: "resource",
						id: row.id,
						organization_id: row.organization_id,
						organization_name: row.organization_name,
						title: row.title,
						description: row.description,
						resource_type_label: row.resource_type_label,
						href: "/resources",
					}));
				}
			}
		} catch {
			// organization_resources may not exist
		}

		// Volunteer opportunities: FTS5 when available, else LIKE
		try {
			if (ftsQuery) {
				try {
					const voStmt = db.prepare(
						`SELECT vo.id, vo.organization_id, vo.title, vo.description, g.name AS organization_name
						 FROM volunteer_opportunities vo
						 JOIN organizations g ON g.id = vo.organization_id
						 WHERE vo.id IN (SELECT rowid FROM volunteer_opportunities_fts WHERE volunteer_opportunities_fts MATCH ? LIMIT 50)
						 ORDER BY vo.title`
					);
					const voRows = (await voStmt.bind(ftsQuery).all()).results as {
						id: number;
						organization_id: number;
						title: string;
						description: string | null;
						organization_name: string;
					}[];
					if (voRows?.length) {
						results.volunteerOpportunities = voRows.map((row) => ({
							type: "volunteer",
							id: row.id,
							organization_id: row.organization_id,
							organization_name: row.organization_name,
							title: row.title,
							description: row.description,
							href: "/organizations",
						}));
					}
				} catch {
					// FTS table may not exist
				}
			}
			if (results.volunteerOpportunities.length === 0) {
				const voStmt = db.prepare(
					`SELECT vo.id, vo.organization_id, vo.title, vo.description, g.name AS organization_name
					 FROM volunteer_opportunities vo
					 JOIN organizations g ON g.id = vo.organization_id
					 WHERE vo.title LIKE ? ESCAPE '\\' OR (vo.description IS NOT NULL AND vo.description LIKE ? ESCAPE '\\')
					 ORDER BY vo.title LIMIT 50`
				);
				const voRows = (await voStmt.bind(pattern, pattern).all()).results as {
					id: number;
					organization_id: number;
					title: string;
					description: string | null;
					organization_name: string;
				}[];
				if (voRows?.length) {
					results.volunteerOpportunities = voRows.map((row) => ({
						type: "volunteer",
						id: row.id,
						organization_id: row.organization_id,
						organization_name: row.organization_name,
						title: row.title,
						description: row.description,
						href: "/organizations",
					}));
				}
			}
		} catch {
			// volunteer_opportunities may not exist
		}

		return NextResponse.json(results);
	} catch (err) {
		console.error("search API error:", err);
		return NextResponse.json(
			{ error: "Search failed" },
			{ status: 500 }
		);
	}
}
