import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

/** @type {import("eslint").Linter.Config[]} */
const config = [
	{ ignores: [".open-next/**", ".wrangler/**"] },
	...nextCoreWebVitals,
	{
		rules: {
			// Standard patterns (localStorage, matchMedia) sync state in effects; useSyncExternalStore refactors are optional.
			"react-hooks/set-state-in-effect": "off",
		},
	},
];

export default config;
