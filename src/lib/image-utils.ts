/**
 * Resize an image so its longest side is at most maxDim, then encode as WebP.
 * Runs in the browser (uses Canvas). Returns a Blob or null on failure.
 */
export async function resizeAndConvertToWebP(
	file: File,
	maxDimension: number = 1200,
	quality: number = 0.85
): Promise<Blob | null> {
	const img = await createImageBitmap(file);
	const { width: w, height: h } = img;
	let width = w;
	let height = h;
	if (w > maxDimension || h > maxDimension) {
		if (w >= h) {
			width = maxDimension;
			height = Math.max(1, Math.round((h * maxDimension) / w));
		} else {
			height = maxDimension;
			width = Math.max(1, Math.round((w * maxDimension) / h));
		}
	}
	const canvas = new OffscreenCanvas(width, height);
	const ctx = canvas.getContext("2d");
	if (!ctx) return null;
	ctx.drawImage(img, 0, 0, width, height);
	img.close();
	const blob = await canvas.convertToBlob({ type: "image/webp", quality });
	return blob;
}
