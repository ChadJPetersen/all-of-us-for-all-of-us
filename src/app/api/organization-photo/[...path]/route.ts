import { getOrgPhotosBucket, ORG_PHOTOS_PREFIX } from "@/lib/r2";
import { NextRequest, NextResponse } from "next/server";

/** Only allow safe filename characters (no path traversal). */
const SAFE_FILENAME = /^[a-zA-Z0-9._-]+$/;

const EXT_TO_MIME: Record<string, string> = {
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	gif: "image/gif",
	webp: "image/webp",
};

/**
 * GET /api/organization-photo/[...path]
 * Serves an image from R2 (org-photos/...) with correct Content-Type.
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ path: string[] }> }
) {
	try {
		const { path: pathSegments } = await params;
		const filename = pathSegments?.join("/");
		if (!filename || !SAFE_FILENAME.test(filename)) {
			return NextResponse.json({ error: "Invalid path" }, { status: 400 });
		}
		const bucket = getOrgPhotosBucket();
		const key = `${ORG_PHOTOS_PREFIX}${filename}`;
		const object = await bucket.get(key);
		if (!object) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}
		const ext = filename.split(".").pop()?.toLowerCase() ?? "";
		const contentType = object.httpMetadata?.contentType ?? EXT_TO_MIME[ext] ?? "application/octet-stream";
		const body = object.body;
		return new NextResponse(body, {
			headers: {
				"Content-Type": contentType,
				"Cache-Control": "public, max-age=31536000, immutable",
			},
		});
	} catch (err) {
		console.error("organization-photo GET error:", err);
		return NextResponse.json({ error: "Failed to load image" }, { status: 500 });
	}
}
