/**
 * Default page size for infinite-scroll lists.
 * Research suggests 50–200; 75 balances mobile memory, request count, and UX.
 * @see https://www.baymard.com/blog/number-of-items-loaded-by-default
 */
export const DEFAULT_PAGE_SIZE = 75;

export const MIN_PAGE_SIZE = 1;
export const MAX_PAGE_SIZE = 200;

export function parseLimitParam(value: string | null, defaultSize: number = DEFAULT_PAGE_SIZE): number {
	if (value == null || value === "") return defaultSize;
	const n = parseInt(value, 10);
	if (!Number.isInteger(n) || n < MIN_PAGE_SIZE) return defaultSize;
	return Math.min(n, MAX_PAGE_SIZE);
}

export function parseOffsetParam(value: string | null): number {
	if (value == null || value === "") return 0;
	const n = parseInt(value, 10);
	return Number.isInteger(n) && n >= 0 ? n : 0;
}
