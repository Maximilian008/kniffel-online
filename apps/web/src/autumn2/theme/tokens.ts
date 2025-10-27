export const autumn2Theme = {
	colors: {
		bg: "#f9f4ef",
		panel: "#ffffffcc",
		panelBorder: "#8f59311a",
		textPrimary: "#2c1408",
		textMuted: "#633f2d99",
		placeholder: "#9f6644",
		accent: "#d47a2e",
		accentHoverFrom: "#e27f2b",
		accentHoverTo: "#f0ad43",
		shadowWarm: "rgba(120, 60, 15, 0.6)",
		badgeReadyBg: "#f4eadf",
		badgeReadyBorder: "#d39564",
		badgeConnBg: "#ebe2f7",
		badgeConnBorder: "#a07bd8",
		badgeOffBg: "#f8d8d3",
		badgeOffBorder: "#d77a6f",
	},
	radii: {
		container: "1.25rem",
		control: "0.6rem",
		chip: "9999px",
	},
} as const;

export type Autumn2Theme = typeof autumn2Theme;

// Hex → Var Mapping (siehe theme.css):
// bg (#f9f4ef) → --a2-bg
// panel (#ffffffcc) → --a2-panel
// panelBorder (#8f59311a) → --a2-panel-border
// textPrimary (#2c1408) → --a2-text-primary
// textMuted (#633f2d99) → --a2-text-muted
// placeholder (#9f6644) → --a2-placeholder
// accent (#d47a2e) → --a2-accent
// accentHoverFrom (#e27f2b) → --a2-accent-hover-from
// accentHoverTo (#f0ad43) → --a2-accent-hover-to
// shadowWarm (rgba(120,60,15,0.6)) → --a2-shadow-warm
// badgeReadyBg (#f4eadf) → --a2-badge-ready-bg
// badgeReadyBorder (#d39564) → --a2-badge-ready-border
// badgeConnBg (#ebe2f7) → --a2-badge-conn-bg
// badgeConnBorder (#a07bd8) → --a2-badge-conn-border
// badgeOffBg (#f8d8d3) → --a2-badge-off-bg
// badgeOffBorder (#d77a6f) → --a2-badge-off-border
