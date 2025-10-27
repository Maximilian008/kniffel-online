import type { CSSProperties } from "react";

export const autumnPalette = {
    background: "#2d1b3d",
    surface: "#20160f",
    panel: "#1b1410",
    text: "#fef3e8",
    primary: "#ff6900",
    primaryForeground: "#381408",
    primaryHover: "linear-gradient(90deg, #ff8a33, #ff6900)",
    accent: "#c74e26",
    accentForeground: "#ffffff",
    muted: "rgba(254, 243, 232, 0.7)",
    mutedForeground: "rgba(254, 243, 232, 0.85)",
    success: "#22c55e",
    danger: "#ef4444",
    border: "rgba(255, 255, 255, 0.12)",
    ring: "#ff914d",
} as const;

export const autumnMetrics = {
    radius: {
        md: "1.25rem",
        pill: "999px",
    },
    shadow: {
        surface: "0 24px 60px rgba(20, 16, 13, 0.4)",
    },
} as const;

export const autumnButtonTokens = {
    background: autumnPalette.primary,
    hoverBackground: autumnPalette.primaryHover,
    text: "#b9481f",
    border: autumnPalette.primary,
    ring: "rgba(255, 105, 0, 0.4)",
} as const;

export const autumnSetupTokens = {
    panelBackground: "#dfd2ba",
    panelBorder: "#efb88a",
    panelShadow: "0 8px 24px rgba(148, 87, 41, 0.25)",
    rootText: "#7e2a0c",
    headingText: "#6b3f23",
    helperText: "#7a5134",
    statusText: "#7c5639",
    emptyStateText: "#6b2324",
    cardBackground: "#ece4d6",
    cardBorder: "#d4ad95",
    mutedBorder: "#d8cbb8",
    inputText: "#4a2a16",
    inputPlaceholder: "#8f6a4d",
    badgeText: "#4a2a16",
    badgeReadyBackground: "#eef6e2",
    badgeReadyBorder: "#b7cf9d",
    badgeConnectedBackground: "#fbe4c9",
    badgeConnectedBorder: "#f0c79e",
    badgeDefaultBackground: "#f4e6d4",
    badgeDefaultBorder: "#e0d0b6",
} as const;

export const autumnMenuTokens = {
    triggerBackground: "rgba(255, 255, 255, 0.1)",
    triggerBackgroundHover: "rgba(255, 255, 255, 0.2)",
    triggerBorder: "rgba(255, 255, 255, 0.2)",
    triggerIcon: "#fcdba2",
    contentBackground: "#3d2549",
    contentBorder: "rgba(255, 255, 255, 0.2)",
    contentText: "#fcefe3",
    contentShadow: "0 16px 36px rgba(20, 16, 13, 0.45)",
    itemHoverBackground: "rgba(255, 255, 255, 0.1)",
    separator: "rgba(255, 255, 255, 0.1)",
} as const;

export const autumnCssVars = {
    button: {
        background: "--autumn-button-bg",
        hoverBackground: "--autumn-button-bg-hover",
        text: "--autumn-button-text",
        border: "--autumn-button-border",
        ring: "--autumn-button-ring",
    },
    setup: {
        panelBackground: "--autumn-setup-panel-bg",
        panelBorder: "--autumn-setup-panel-border",
        panelShadow: "--autumn-setup-panel-shadow",
        rootText: "--autumn-setup-text",
        headingText: "--autumn-setup-heading",
        helperText: "--autumn-setup-helper",
        statusText: "--autumn-setup-status",
        emptyStateText: "--autumn-setup-empty-text",
        cardBackground: "--autumn-setup-card-bg",
        cardBorder: "--autumn-setup-card-border",
        mutedBorder: "--autumn-setup-muted-border",
        inputText: "--autumn-setup-input-text",
        inputPlaceholder: "--autumn-setup-input-placeholder",
        badgeText: "--autumn-setup-badge-text",
        badgeReadyBackground: "--autumn-setup-badge-ready-bg",
        badgeReadyBorder: "--autumn-setup-badge-ready-border",
        badgeConnectedBackground: "--autumn-setup-badge-connected-bg",
        badgeConnectedBorder: "--autumn-setup-badge-connected-border",
        badgeDefaultBackground: "--autumn-setup-badge-default-bg",
        badgeDefaultBorder: "--autumn-setup-badge-default-border",
    },
    menu: {
        triggerBackground: "--autumn-menu-trigger-bg",
        triggerBackgroundHover: "--autumn-menu-trigger-bg-hover",
        triggerBorder: "--autumn-menu-trigger-border",
        triggerIcon: "--autumn-menu-trigger-icon",
        contentBackground: "--autumn-menu-content-bg",
        contentBorder: "--autumn-menu-content-border",
        contentText: "--autumn-menu-content-text",
        contentShadow: "--autumn-menu-content-shadow",
        itemHoverBackground: "--autumn-menu-item-hover-bg",
        separator: "--autumn-menu-separator",
    },
} as const;

export type AutumnPalette = typeof autumnPalette;

export function withAutumnButtonVars(style?: CSSProperties): CSSProperties {
    const baseVars: Record<string, string> = {
        [autumnCssVars.button.background]: autumnButtonTokens.background,
        [autumnCssVars.button.hoverBackground]: autumnButtonTokens.hoverBackground,
        [autumnCssVars.button.text]: autumnButtonTokens.text,
        [autumnCssVars.button.border]: autumnButtonTokens.border,
        [autumnCssVars.button.ring]: autumnButtonTokens.ring,
    };

    if (style) {
        return { ...baseVars, ...style } as CSSProperties;
    }

    return baseVars as CSSProperties;
}
