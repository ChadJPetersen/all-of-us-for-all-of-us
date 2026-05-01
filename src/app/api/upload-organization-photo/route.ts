import { requireAddHumanSession } from "@/lib/humanVerify";
import { getOrgPhotosBucket, ORG_PHOTOS_PREFIX } from "@/lib/r2";
import { NextRequest, NextResponse } from "next/server";

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB (client sends already-resized WebP)
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

function extFromMime(mime: string): string {
	const map: Record<string, string> = {
		"image/jpeg": "jpg",
		"image/png": "png",
		"image/gif": "gif",
		"image/webp": "webp",
	};
	return map[mime] ?? "webp";
}

/**
 * POST /api/upload-organization-photo
 * Body: multipart/form-data with "file" (image file).
 * Client should resize and convert to WebP before upload (see resizeAndConvertToWebP).
 * Returns: { url: string } — path to serve the image (/api/organization-photo/...).
 */
export async function POST(request: NextRequest) {
	try {
		const humanBlock = requireAddHumanSession(request);
		if (humanBlock) return humanBlock;
		const bucket = getOrgPhotosBucket();
		const formData = await request.formData();
		const file = formData.get("file");
		if (!file || !(file instanceof File)) {
			return NextResponse.json(
				{ error: "Missing or invalid file. Use form field 'file' with an image file." },
				{ status: 400 }
			);
		}
		if (file.size > MAX_SIZE_BYTES) {
			return NextResponse.json(
				{ error: `Image must be under ${MAX_SIZE_BYTES / 1024 / 1024}MB.` },
				{ status: 400 }
			);
		}
		const mime = (file.type?.toLowerCase() || "").trim() || "image/webp";
		if (!ALLOWED_TYPES.includes(mime)) {
			return NextResponse.json(
				{ error: "Allowed types: JPEG, PNG, GIF, WebP." },
				{ status: 400 }
			);
		}
		const ext = extFromMime(mime);
		const id = crypto.randomUUID();
		const key = `${ORG_PHOTOS_PREFIX}${id}.${ext}`;
		const arrayBuffer = await file.arrayBuffer();
		await bucket.put(key, arrayBuffer, {
			httpMetadata: { contentType: mime },
		});
		const url = `/api/organization-photo/${id}.${ext}`;
		return NextResponse.json({ url });
	} catch (err) {
		console.error("upload-organization-photo error:", err);
		return NextResponse.json(
			{ error: "Failed to upload image." },
			{ status: 500 }
		);
	}
}
