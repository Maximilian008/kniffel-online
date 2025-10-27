import { Minus, Plus, UserCheck, UserX } from "lucide-react";
import type { CSSProperties } from "react";

import { Button } from "../../ui/button";
import { Input } from "../../ui/input";

// ──────────────────────────────────────────────────────────────
// [UI: PlayerSetupNew] Purpose: Setup panel for configuring a new lobby.
// Dependencies: button (variant="autumn"), input, lucide icons, inline theme tokens.
// Visible regions: Header, player counter, name input, lobby roster, seat list, footer actions.
// ──────────────────────────────────────────────────────────────

export type SetupPlayer = {
    name: string;
    connected: boolean;
    ready: boolean;
    isSelf?: boolean;
};

type PlayerSetupNewProps = {
    playerCount: number;
    onPlayerCountChange: (count: number) => void;
    localName: string;
    localPlaceholder: string;
    canEditName: boolean;
    onNameChange: (value: string) => void;
    onNameFocus: () => void;
    onNameBlur: () => void;
    onStart: () => void;
    onOpenHistory: () => void;
    startDisabled: boolean;
    localReady: boolean;
    statusMessage: string;
    players?: SetupPlayer[];
};

const panelStyle: CSSProperties = {
    backgroundColor: "#DFD2BA",
    borderRadius: "1.25rem",
    boxShadow: "0 8px 24px rgba(148, 87, 41, 0.25)",
    border: "1px solid #EFB88A",
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
    color: "#6B3F23",
};

const helperTextStyle: CSSProperties = {
    fontSize: "0.75rem",
    color: "#7A5134",
};

function lobbyBadgeStyle({ ready, connected }: { ready: boolean; connected: boolean }): CSSProperties {
    if (ready) {
        return {
            backgroundColor: "#EEF6E2",
            border: "1px solid #B7CF9D",
            color: "#4A2A16",
        };
    }

    if (connected) {
        return {
            backgroundColor: "#FBE4C9",
            border: "1px solid #F0C79E",
            color: "#4A2A16",
        };
    }

    return {
        backgroundColor: "#F4E6D4",
        border: "1px solid #E0D0B6",
        color: "#4A2A16",
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
        return "Offen";
    }

    return "Nicht verbunden";
}

export function PlayerSetupNew({
    playerCount,
    onPlayerCountChange,
    localName,
    localPlaceholder,
    canEditName,
    onNameChange,
    onNameFocus,
    onNameBlur,
    onStart,
    onOpenHistory,
    startDisabled,
    localReady,
    statusMessage,
    players,
}: PlayerSetupNewProps) {
    const roster = players ?? [];
    const editableSeatIndex = roster.findIndex((player) => player?.isSelf);

    const seats = Array.from({ length: playerCount }, (_, index) => {
        const player = roster[index];
        const trimmedName = player?.name?.trim() ?? "";
        const isSelf = index === editableSeatIndex || Boolean(player?.isSelf);
        const displayName = trimmedName.length > 0 ? trimmedName : `Spieler ${index + 1}`;

        return {
            index,
            isSelf,
            connected: Boolean(player?.connected),
            ready: Boolean(player?.ready),
            name: displayName,
            inputValue: isSelf ? localName : displayName,
        };
    });

    return (
        <div className="flex min-h-screen w-full items-center justify-center px-4 py-10 text-[#7E2A0C]">
            <div style={panelStyle}>
                <header style={{ marginBottom: "2rem", textAlign: "center" }}>
                    <h2 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Spiel vorbereiten</h2>
                </header>

                <div style={sectionStackStyle}>
                    <section style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        <span style={labelStyle}>Anzahl der Spieler</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <Button
                                type="button"
                                size="icon"
                                variant="autumn"
                                onClick={() => onPlayerCountChange(Math.max(2, playerCount - 1))}
                                disabled={playerCount <= 2}
                                className="rounded-full"
                                style={{ width: "44px", height: "44px" }}
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
                                onClick={() => onPlayerCountChange(Math.min(6, playerCount + 1))}
                                disabled={playerCount >= 6}
                                className="rounded-full"
                                style={{ width: "44px", height: "44px" }}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                    </section>

                    <section style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                            <span style={labelStyle}>Dein Name</span>
                            <div
                                style={{
                                    backgroundColor: "#ECE4D6",
                                    borderRadius: "0.6rem",
                                    border: "1px solid #D4AD95",
                                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)",
                                }}
                            >
                                <Input
                                    value={localName}
                                    placeholder={localPlaceholder}
                                    onChange={(event) => onNameChange(event.target.value)}
                                    onFocus={onNameFocus}
                                    onBlur={onNameBlur}
                                    disabled={!canEditName}
                                    maxLength={40}
                                    className="h-11 w-full border-0 bg-transparent text-base font-medium placeholder:text-[#8F6A4D] focus-visible:ring-0"
                                    style={{
                                        color: "#4A2A16",
                                        padding: "0 0.875rem",
                                        borderRadius: "0.6rem",
                                    }}
                                />
                            </div>
                            <span style={helperTextStyle}>
                                {localReady ? "Du bist bereit zum Start." : "Passe deinen Namen an oder warte auf Mitspieler."}
                            </span>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                            <span style={labelStyle}>Lobby</span>
                            {roster.length === 0 ? (
                                <div
                                    style={{
                                        backgroundColor: "#ECE4D6",
                                        borderRadius: "0.85rem",
                                        border: "1px solid #D8CBB8",
                                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)",
                                        padding: "1rem",
                                        textAlign: "center",
                                        fontSize: "0.9rem",
                                        color: "#6b2324ff",
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
                                                    backgroundColor: "#ECE4D6",
                                                    borderRadius: "0.85rem",
                                                    border: "1px solid #D4AD95",
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
                                                    <span style={{ fontSize: "0.75rem", color: "#7A5134" }}>
                                                        {connected ? "Verbunden" : "Nicht verbunden"}
                                                    </span>
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

                    {seats.length > 0 && (
                        <section style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                            <span style={labelStyle}>Spielerliste</span>
                            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                                {seats.map((seat) => {
                                    const isEditable = seat.isSelf && canEditName;
                                    return (
                                        <div key={`seat-input-${seat.index}`} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                            <span style={{ fontWeight: 600 }}>{`Spieler ${seat.index + 1}`}</span>
                                            <div
                                                style={{
                                                    position: "relative",
                                                    backgroundColor: "#ECE4D6",
                                                    borderRadius: "0.6rem",
                                                    border: "1px solid #D4AD95",
                                                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)",
                                                }}
                                            >
                                                <Input
                                                    value={seat.inputValue}
                                                    placeholder={`Spieler ${seat.index + 1}`}
                                                    onChange={isEditable ? (event) => onNameChange(event.target.value) : undefined}
                                                    onFocus={isEditable ? onNameFocus : undefined}
                                                    onBlur={isEditable ? onNameBlur : undefined}
                                                    readOnly={!isEditable}
                                                    maxLength={40}
                                                    className="h-11 w-full border-0 bg-transparent text-base font-medium placeholder:text-[#7E2A0C] focus-visible:ring-0"
                                                    style={{
                                                        color: "#4a1616ff",
                                                        padding: "0 0.875rem",
                                                        borderRadius: "0.6rem",
                                                    }}
                                                />
                                            </div>
                                            <span style={helperTextStyle}>
                                                {seat.ready
                                                    ? "Spieler ist bereit."
                                                    : seat.connected
                                                        ? "Wartet auf Startsignal."
                                                        : "Noch nicht verbunden."}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}
                </div>

                <footer style={{ marginTop: "2rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <span style={{ textAlign: "center", fontSize: "0.875rem", color: "#7C5639" }}>{statusMessage}</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        <Button
                            type="button"
                            variant="autumn"
                            onClick={onOpenHistory}
                            className="rounded-full text-sm font-semibold"
                            style={{ padding: "0.9rem", textTransform: "none" }}
                        >
                            📊 Verlauf anzeigen
                        </Button>
                        <Button
                            type="button"
                            variant="autumn"
                            onClick={onStart}
                            disabled={startDisabled}
                            className="rounded-full text-sm font-semibold"
                            style={{ padding: "0.9rem", textTransform: "none" }}
                        >
                            {localReady ? "Warten auf Mitspieler" : "Spiel starten 🎲"}
                        </Button>
                    </div>
                </footer>
            </div>
        </div>
    );
}
