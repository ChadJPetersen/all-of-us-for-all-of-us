import { getDb } from "@/lib/db";
import { rowToOrganizationResource } from "@/lib/organizations";
import type { OrganizationResource } from "@/lib/types";
import { parseLimitParam, parseOffsetParam } from "@/lib/pagination";
import {
	requirePositiveInt,
	requireNonEmptyString,
	parseOptionalString,
	parseOptionalUrl,
} from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/resources
 * Query: type (optional) - resource_type_id to filter by.
 * Returns all organization resources with org name and resource type label.
 */
export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const typeIdParam = searchParams.get("type");
		const limit = parseLimitParam(searchParams.get("limit"));
		const offset = parseOffsetParam(searchParams.get("offset"));

		const db = getDb();
		let stmt;
		let params: number[] = [];
		if (typeIdParam != null && typeIdParam !== "") {
			const typeId = parseInt(typeIdParam, 10);
			if (!Number.isInteger(typeId) || typeId < 1) {
				return NextResponse.json(
					{ error: "Invalid type parameter" },
					{ status: 400 }
				);
			}
			stmt = db.prepare(`
				SELECT r.id, r.organization_id, r.resource_type_id, r.title, r.description, r.link, r.created_at_utc, r.created_at_offset_minutes, r.updated_at_utc, r.updated_at_offset_minutes,
				       o.name AS organization_name,
				       o.slug AS organization_slug,
				       rt.label AS resource_type_label
				FROM organization_resources r
				JOIN organizations o ON o.id = r.organization_id
				JOIN resource_types rt ON rt.id = r.resource_type_id
				WHERE r.resource_type_id = ?
				ORDER BY rt.label, o.name, r.title
				LIMIT ? OFFSET ?
			`);
			params = [typeId, limit, offset];
		} else {
			stmt = db.prepare(`
				SELECT r.id, r.organization_id, r.resource_type_id, r.title, r.description, r.link, r.created_at_utc, r.created_at_offset_minutes, r.updated_at_utc, r.updated_at_offset_minutes,
				       o.name AS organization_name,
				       o.slug AS organization_slug,
				       rt.label AS resource_type_label
				FROM organization_resources r
				JOIN organizations o ON o.id = r.organization_id
				JOIN resource_types rt ON rt.id = r.resource_type_id
				ORDER BY rt.label, o.name, r.title
				LIMIT ? OFFSET ?
			`);
			params = [limit, offset];
		}
		const result = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();
		const rows = (result.results ?? []) as Record<string, unknown>[];
		const resources = rows.map((row) => ({
			...rowToOrganizationResource(row),
			organization_name: row.organization_name as string,
			organization_slug: (row.organization_slug as string | null) ?? null,
		}));

		// Total count for infinite scroll
		let total_count: number;
		if (typeIdParam != null && typeIdParam !== "") {
			const typeId = parseInt(typeIdParam, 10);
			const countRow = (await db.prepare(
				"SELECT COUNT(*) AS c FROM organization_resources WHERE resource_type_id = ?"
			).bind(typeId).first()) as { c: number };
			total_count = countRow?.c ?? 0;
		} else {
			const countRow = (await db.prepare(
				"SELECT COUNT(*) AS c FROM organization_resources"
			).first()) as { c: number };
			total_count = countRow?.c ?? 0;
		}

		return NextResponse.json({ resources, total_count });
	} catch (err) {
		console.error("resources GET error:", err);
		return NextResponse.json(
			{ error: "Failed to fetch resources" },
			{ status: 500 }
		);
	}
}

/**
 * POST /api/resources
 * Body: organization_id, resource_type_id, title, description?, link?
 * Creates a resource for an organization.
 */
export async function POST(request: NextRequest) {
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const orgIdResult = requirePositiveInt(body, "organization_id", "Valid organization_id is required");
		if (orgIdResult.errorResponse) return orgIdResult.errorResponse;
		const organizationId = orgIdResult.value;

		const typeIdResult = requirePositiveInt(body, "resource_type_id", "Valid resource_type_id is required");
		if (typeIdResult.errorResponse) return typeIdResult.errorResponse;
		const resourceTypeId = typeIdResult.value;

		const titleResult = requireNonEmptyString(body, "title", "Title is required");
		if (titleResult.errorResponse) return titleResult.errorResponse;
		const title = titleResult.value;

		const description = parseOptionalString(body, "description");
		const linkResult = parseOptionalUrl(body, "link", "Please enter a valid URL for the resource link");
		if (linkResult.errorResponse) return linkResult.errorResponse;
		const link = linkResult.value;

		const db = getDb();
		const typeRow = await db
			.prepare("SELECT 1 AS ok FROM resource_types WHERE id = ? LIMIT 1")
			.bind(resourceTypeId)
			.first();
		if (!typeRow) {
			return NextResponse.json({ error: "Unknown resource_type_id" }, { status: 400 });
		}
		const result = await db
			.prepare(
				`INSERT INTO organization_resources (organization_id, resource_type_id, title, description, link)
				 VALUES (?, ?, ?, ?, ?)`
			)
			.bind(organizationId, resourceTypeId, title, description, link)
			.run();
		const lastId = (result as { meta?: { last_row_id?: number } }).meta?.last_row_id;
		const row =
			lastId != null
				? await db
						.prepare(
							`SELECT r.id, r.organization_id, r.resource_type_id, r.title, r.description, r.link, r.created_at_utc, r.created_at_offset_minutes, r.updated_at_utc, r.updated_at_offset_minutes,
							        rt.label AS resource_type_label
							 FROM organization_resources r
							 JOIN resource_types rt ON rt.id = r.resource_type_id
							 WHERE r.id = ?`
						)
						.bind(lastId)
						.first()
				: null;
		const resource: OrganizationResource | null = row
			? rowToOrganizationResource(row as Record<string, unknown>)
			: null;
		return NextResponse.json({
			ok: true,
			resource,
		});
	} catch (err) {
		console.error("resources POST error:", err);
		return NextResponse.json(
			{ error: "Failed to create resource" },
			{ status: 500 }
		);
	}
}
