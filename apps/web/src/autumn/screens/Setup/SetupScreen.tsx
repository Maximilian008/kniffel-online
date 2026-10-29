import { Minus, Plus, UserCheck, UserX } from "lucide-react";
import type { CSSProperties } from "react";

import { autumnCssVars, autumnSetupTokens } from "../../theme/tokens";
import { Button } from "../../ui/button";

// ──────────────────────────────────────────────────────────────
// [UI: SetupScreen] Purpose: Setup panel for configuring a new lobby.
// Dependencies: button (variant="autumn"), input, lucide icons, inline theme tokens.
// Visible regions: Header, player counter, lobby roster, footer actions (invite, history, ready).
// ──────────────────────────────────────────────────────────────

export type SetupPlayer = {
    name: string;
    connected: boolean;
    ready: boolean;
    isSelf?: boolean;
    /** Somebody has this seat (connected or not). */
    occupied?: boolean;
    /** Gone for longer than the grace period: others may free the seat. */
    canFree?: boolean;
};

type SetupScreenProps = {
    playerCount: number;
    onPlayerCountChange: (count: number) => void;
    onStart: () => void;
    onOpenHistory: () => void;
    startDisabled: boolean;
    localReady: boolean;
    statusMessage: string;
    players?: SetupPlayer[];
    onFreeSeat?: (index: number) => void;
    onInvite?: () => void;
    inviteLabel?: string;
};

const setupVars = autumnCssVars.setup;
const setupFallbacks = autumnSetupTokens;
const cssVar = (token: string, fallback?: string) => (fallback ? `var(${token}, ${fallback})` : `var(${token})`);

const panelStyle: CSSProperties = {
    backgroundColor: cssVar(setupVars.panelBackground, setupFallbacks.panelBackground),
    borderRadius: "1.25rem",
    boxShadow: cssVar(setupVars.panelShadow, setupFallbacks.panelShadow),
    border: `1px solid ${cssVar(setupVars.panelBorder, setupFallbacks.panelBorder)}`,
    padding: "2rem",
    width: "100%",
    maxWidth: "420px",
};

const sectionStackStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
};

const labelStyle: CSSProperties = {
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 600,
    fontSize: "0.75rem",
    color: cssVar(setupVars.headingText, setupFallbacks.headingText),
};

function lobbyBadgeStyle({ ready, connected }: { ready: boolean; connected: boolean }): CSSProperties {
    if (ready) {
        return {
            backgroundColor: cssVar(setupVars.badgeReadyBackground, setupFallbacks.badgeReadyBackground),
            border: `1px solid ${cssVar(setupVars.badgeReadyBorder, setupFallbacks.badgeReadyBorder)}`,
            color: cssVar(setupVars.badgeText, setupFallbacks.badgeText),
        };
    }

    if (connected) {
        return {
            backgroundColor: cssVar(setupVars.badgeConnectedBackground, setupFallbacks.badgeConnectedBackground),
            border: `1px solid ${cssVar(setupVars.badgeConnectedBorder, setupFallbacks.badgeConnectedBorder)}`,
            color: cssVar(setupVars.badgeText, setupFallbacks.badgeText),
        };
    }

    return {
        backgroundColor: cssVar(setupVars.badgeDefaultBackground, setupFallbacks.badgeDefaultBackground),
        border: `1px solid ${cssVar(setupVars.badgeDefaultBorder, setupFallbacks.badgeDefaultBorder)}`,
        color: cssVar(setupVars.badgeText, setupFallbacks.badgeText),
    };
}

function lobbyBadgeIcon(ready: boolean, connected: boolean) {
    if (ready) {
        return <UserCheck className="h-3 w-3" />;
    }

    if (connected) {
        return <UserX className="h-3 w-3" />;
    }

    return null;
}

function lobbyBadgeText(ready: boolean, connected: boolean) {
    if (ready) {
        return "Bereit";
    }

    if (connected) {
        return "Noch nicht bereit";
    }

    return "Nicht verbunden";
}

export function SetupScreen({
    playerCount,
    onPlayerCountChange,
    onStart,
    onOpenHistory,
    startDisabled,
    localReady,
    statusMessage,
    players,
    onFreeSeat,
    onInvite,
    inviteLabel = "📨 Mitspieler einladen",
}: SetupScreenProps) {
    const roster = players ?? [];

    return (
        <div
            className="flex min-h-screen w-full items-center justify-center px-4 py-10"
            style={{ color: cssVar(setupVars.rootText, setupFallbacks.rootText) }}
        >
            <div style={panelStyle}>
                <header style={{ marginBottom: "2rem", textAlign: "center" }}>
                    <h2
                        style={{
                            fontSize: "1.5rem",
                            fontWeight: 600,
                            color: cssVar(setupVars.headingText, setupFallbacks.headingText),
                        }}
                    >
                        Spiel vorbereiten
                    </h2>
                </header>

                <div style={sectionStackStyle}>
                    <section style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        <span style={labelStyle}>Anzahl der Spieler</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <Button
                                type="button"
                                size="icon"
                                variant="autumn"
                                aria-label="Einen Spieler weniger"
                                onClick={() => onPlayerCountChange(Math.max(2, playerCount - 1))}
                                disabled={playerCount <= 2}
                                className="rounded-full"
                                style={{ width: "44px", height: "44px", color: "#ffffff" }}
                            >
                                <Minus className="h-4 w-4" />
                            </Button>
                            <span style={{ minWidth: "2.5rem", textAlign: "center", fontSize: "1.5rem", fontWeight: 600 }}>
                                {playerCount}
                            </span>
                            <Button
                                type="button"
                                size="icon"
                                variant="autumn"
                                aria-label="Einen Spieler mehr"
                                onClick={() => onPlayerCountChange(Math.min(6, playerCount + 1))}
                                disabled={playerCount >= 6}
                                className="rounded-full"
                                style={{ width: "44px", height: "44px", color: "#ffffff" }}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                    </section>

                    <section style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                            <span style={labelStyle}>Lobby</span>
                            {roster.length === 0 ? (
                                <div
                                    style={{
                                        backgroundColor: cssVar(setupVars.cardBackground, setupFallbacks.cardBackground),
                                        borderRadius: "0.85rem",
                                        border: `1px solid ${cssVar(setupVars.mutedBorder, setupFallbacks.mutedBorder)}`,
                                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)",
                                        padding: "1rem",
                                        textAlign: "center",
                                        fontSize: "0.9rem",
                                        color: cssVar(setupVars.emptyStateText, setupFallbacks.emptyStateText),
                                    }}
                                >
                                    Teile den Link mit Mitspielern, damit sie beitreten können.
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                    {roster.map((player, index) => {
                                        const ready = Boolean(player.ready);
                                        const connected = Boolean(player.connected);
                                        const badgeStyles = lobbyBadgeStyle({ ready, connected });
                                        const resolvedName = player.name?.trim() || `Spieler ${index + 1}`;

                                        return (
                                            <div
                                                key={`${player.name}-${index}`}
                                                style={{
                                                    backgroundColor: cssVar(setupVars.cardBackground, setupFallbacks.cardBackground),
                                                    borderRadius: "0.85rem",
                                                    border: `1px solid ${cssVar(setupVars.cardBorder, setupFallbacks.cardBorder)}`,
                                                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)",
                                                    padding: "0.85rem 1rem",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "space-between",
                                                    gap: "0.75rem",
                                                }}
                                            >
                                                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                                    <span style={{ fontWeight: 600 }}>
                                                        {player.isSelf ? `${resolvedName} (Du)` : resolvedName}
                                                    </span>
                                                    <span style={{ fontSize: "0.75rem", color: cssVar(setupVars.helperText, setupFallbacks.helperText) }}>
                                                        {connected ? "Verbunden" : player.canFree ? "Seit über 2 Minuten weg" : "Nicht verbunden"}
                                                    </span>
                                                    {player.canFree && onFreeSeat && (
                                                        <button
                                                            type="button"
                                                            onClick={() => onFreeSeat(index)}
                                                            style={{
                                                                alignSelf: "flex-start",
                                                                marginTop: "0.25rem",
                                                                fontSize: "0.75rem",
                                                                fontWeight: 600,
                                                                textDecoration: "underline",
                                                                color: cssVar(setupVars.rootText, setupFallbacks.rootText),
                                                                background: "none",
                                                                border: "none",
                                                                padding: 0,
                                                                cursor: "pointer",
                                                            }}
                                                        >
                                                            Platz freigeben
                                                        </button>
                                                    )}
                                                </div>
                                                <span
                                                    className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
                                                    style={badgeStyles}
                                                >
                                                    {lobbyBadgeIcon(ready, connected)}
                                                    {lobbyBadgeText(ready, connected)}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </section>

                </div>

                <footer style={{ marginTop: "2rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <span
                        style={{
                            textAlign: "center",
                            fontSize: "0.875rem",
                            color: cssVar(setupVars.statusText, setupFallbacks.statusText),
                        }}
                    >
                        {statusMessage}
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        {onInvite && (
                            <Button
                                type="button"
                                variant="autumn"
                                onClick={onInvite}
                                className="rounded-full text-sm font-semibold"
                                style={{ padding: "0.9rem", textTransform: "none", color: "#ffffff" }}
                            >
                                {inviteLabel}
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="autumn"
                            onClick={onOpenHistory}
                            className="rounded-full text-sm font-semibold"
                            style={{ padding: "0.9rem", textTransform: "none", color: "#ffffff" }}
                        >
                            📊 Verlauf anzeigen
                        </Button>
                        <Button
                            type="button"
                            variant="autumn"
                            onClick={onStart}
                            disabled={startDisabled}
                            className="rounded-full text-sm font-semibold"
                            style={{ padding: "0.9rem", textTransform: "none", color: "#ffffff" }}
                        >
                            {localReady ? "Doch nicht bereit" : "Spiel starten 🎲"}
                        </Button>
                    </div>
                </footer>
            </div>
        </div>
    );
}
