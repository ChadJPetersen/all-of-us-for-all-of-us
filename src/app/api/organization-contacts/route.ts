import { getDb } from "@/lib/db";
import {
	requireNonEmptyString,
	requirePositiveInt,
	parseOptionalString,
	validateMaxLength,
} from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/organization-contacts
 * Body: organization_id, entity_name, contact_purpose, phone?, email?
 * Adds a contact to an organization (who to contact, phone/email, what to contact about).
 */
export async function POST(request: NextRequest) {
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const orgIdResult = requirePositiveInt(body, "organization_id", "Valid organization_id is required");
		if (orgIdResult.errorResponse) return orgIdResult.errorResponse;
		const organizationId = orgIdResult.value;

		const entityResult = requireNonEmptyString(body, "entity_name", "Entity name (who to contact) is required");
		if (entityResult.errorResponse) return entityResult.errorResponse;
		const entity_name = entityResult.value;
		const entityLenErr = validateMaxLength(entity_name, 500, "Entity name");
		if (entityLenErr) return entityLenErr;

		const purposeResult = requireNonEmptyString(body, "contact_purpose", "Contact purpose (what to contact about) is required");
		if (purposeResult.errorResponse) return purposeResult.errorResponse;
		const contact_purpose = purposeResult.value;
		const purposeLenErr = validateMaxLength(contact_purpose, 500, "Contact purpose");
		if (purposeLenErr) return purposeLenErr;

		const phone = parseOptionalString(body, "phone");
		if (phone != null) {
			const phoneLenErr = validateMaxLength(phone, 100, "Phone");
			if (phoneLenErr) return phoneLenErr;
		}
		const email = parseOptionalString(body, "email");
		if (email != null) {
			const emailLenErr = validateMaxLength(email, 320, "Email");
			if (emailLenErr) return emailLenErr;
		}

		const db = getDb();
		const maxOrder = (await db
			.prepare(
				"SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM organization_contacts WHERE organization_id = ?"
			)
			.bind(organizationId)
			.first()) as { next: number } | null;
		const sort_order = maxOrder?.next ?? 0;

		await db
			.prepare(
				"INSERT INTO organization_contacts (organization_id, entity_name, phone, email, contact_purpose, sort_order) VALUES (?, ?, ?, ?, ?, ?)"
			)
			.bind(organizationId, entity_name, phone, email, contact_purpose, sort_order)
			.run();

		return NextResponse.json({ ok: true });
	} catch (err) {
		console.error("organization-contacts POST error:", err);
		return NextResponse.json(
			{ error: "Failed to add contact" },
			{ status: 500 }
		);
	}
}
