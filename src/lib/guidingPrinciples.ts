/**
 * Single source of truth for guiding principle copy (home carousel + /principles).
 */

export const GUIDING_PRINCIPALS = [
	{ text: "Community-focused/centered", icon: "users" as const },
	{ text: "Council leadership approach (there is no \"I\" in team)", icon: "handshake" as const },
	{ text: "Non-partisan", icon: "scale" as const },
	{ text: "Understand this is long-term, ongoing work", icon: "clock" as const },
	{ text: "Perfection is the enemy of the good", icon: "target" as const },
	{ text: "Action grounded in and informed by knowledge/research/facts", icon: "bookOpen" as const },
	{ text: "An approach based on a mindset of abundance, focused on our shared humanity and well-being, centered on openness, learning, growth, and creativity", icon: "sparkles" as const },
	{ text: "A recognition of our shared interdependence with each other and our environment, grounded in an understanding of, and focus on, the systems within which we operate and the necessity for such systems to be accessible, supportive, and designed to engender health and well-being and improve the human condition for all individuals and the communities of which they are a part", icon: "globe" as const },
	{ text: "A belief that all can contribute positively to the common good, learn from each other, and should be welcomed in and empowered to make their unique positive contribution(s)", icon: "heartHandshake" as const },
	{ text: "A commitment to ethical, respectful engagement, grounded in thoughtful listening and based on the idea of principled struggle", icon: "messageCircle" as const },
	{ text: "A belief in the inherent value, dignity, and worth of ALL human beings and a society that should be structured to provide the most good to all", icon: "heart" as const },
	{ text: "The goal is a grassroots democracy that is truly responsive to the needs of the people", icon: "landmark" as const },
] as const;

export type GuidingPrincipal = (typeof GUIDING_PRINCIPALS)[number];

/** Plain strings for the /principles list (same order as the home carousel). */
export function guidingPrincipleTexts(): readonly string[] {
	return GUIDING_PRINCIPALS.map((p) => p.text);
}
