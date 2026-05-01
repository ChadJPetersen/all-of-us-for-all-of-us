/**
 * Normalize a string into a URL-safe slug (lowercase, hyphens, alphanumeric only).
 */
export function slugify(name: string): string {
	return name
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9-]/g, "");
}

/**
 * Escape LIKE wildcards (%, _) and backslash so the term is matched literally in SQL LIKE.
 */
export function escapeLike(term: string): string {
	return term
		.replace(/\\/g, "\\\\")
		.replace(/%/g, "\\%")
		.replace(/_/g, "\\_");
}

/**
 * Build an FTS5 MATCH query from user input: tokenize, escape FTS special chars, add prefix *.
 * FTS5 special: " (phrase), - (NOT), AND, OR. We treat the query as a set of prefix tokens.
 */
export function buildFts5Query(userQuery: string): string {
	const tokens = userQuery
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.map((t) => t.replace(/"/g, '""').replace(/[-]/g, " ").trim())
		.filter(Boolean);
	if (tokens.length === 0) return "";
	return tokens.map((t) => `"${t}"*`).join(" ");
}
