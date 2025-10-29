import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import "../../styles/theme.css";

import { Button } from "../../../autumn/ui/button";
import { Input } from "../../../autumn/ui/input";
import { useIdentity } from "../../hooks/useIdentity";
import { useRoom } from "../../hooks/useRoom";
import { useSessionGuard } from "../../hooks/useSessionGuard";

type TabKey = "host" | "join";

const TABS: Array<{ key: TabKey; label: string }> = [
    { key: "host", label: "Neues Spiel" },
    { key: "join", label: "Beitreten" },
];

function formatJoinCode(value: string) {
    if (value.length <= 3) return value;
    return `${value.slice(0, 3)}-${value.slice(3, 6)}`;
}

function deriveJoinCode(roomId: string) {
    const base = roomId.replace(/[^A-Z0-9]/gi, "").toUpperCase().padEnd(6, "A").slice(0, 6);
    return `${base.slice(0, 3)}-${base.slice(3, 6)}`;
}

export function StartScreen() {
    const { displayName, setDisplayName } = useIdentity();
    const { create, join, rejoin, state: roomState } = useRoom();
    const navigate = useNavigate();
    const location = useLocation();
    const locationState = (location.state as { joined?: boolean; roomId?: string } | null) ?? null;
    const joinedFromState = Boolean(locationState?.joined);
    const joinedRoomId = locationState?.roomId ?? null;
    const { resumeRoomId } = useSessionGuard();
    const [activeTab, setActiveTab] = useState<TabKey>("host");
    const [playerCount, setPlayerCount] = useState<number>(4);
    const [joinCode, setJoinCode] = useState<string>("");
    const [created, setCreated] = useState<
        | null
        | {
              roomId: string;
              code: string;
              inviteToken: string;
          }
    >(null);
    const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
    const [lastRoomId, setLastRoomId] = useState<string | null>(null);

    const formattedJoinCode = useMemo(() => formatJoinCode(joinCode), [joinCode]);
    const inviteUrl = useMemo(() => {
        if (!created || typeof window === "undefined") return "";
        const params = new URLSearchParams({ room: created.roomId, t: created.inviteToken });
        return `${window.location.origin}/?${params.toString()}`;
    }, [created]);

    useEffect(() => {
        const previous = document.body.getAttribute("data-a2-page");
        document.body.setAttribute("data-a2-page", "1");
        return () => {
            if (previous === null) {
                document.body.removeAttribute("data-a2-page");
            } else {
                document.body.setAttribute("data-a2-page", previous);
            }
        };
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const stored = window.localStorage.getItem("yahtzee.lastRoomId");
            setLastRoomId(stored && stored.length > 0 ? stored : null);
        } catch {
            setLastRoomId(null);
        }
    }, [created, resumeRoomId]);

    useEffect(() => {
        if (created) return;
        if (typeof window === "undefined") return;
        const historyState = (window.history.state as { created?: typeof created } | null) ?? null;
        if (historyState?.created) {
            setCreated(historyState.created);
            setActiveTab("host");
        }
    }, [created]);

    useEffect(() => {
        if (created || joinedFromState) return;
        const params = new URLSearchParams(location.search);
        if (params.get("new") !== "1") return;
        const room = params.get("room");
        const token = params.get("t");
        if (!room || !token || !token.startsWith("mock.")) return;
        setCreated({
            roomId: room,
            inviteToken: token,
            code: deriveJoinCode(room),
        });
        setActiveTab("host");
    }, [created, joinedFromState, location.search]);

    useEffect(() => {
        if (joinedFromState) {
            setActiveTab("join");
            setCreated(null);
            if (joinedRoomId) {
                const normalized = joinedRoomId.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 6);
                setJoinCode(normalized);
            }
        }
    }, [joinedFromState, joinedRoomId]);

    async function handleNameSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const name = (displayName ?? "").trim();
        if (!name) return;
        const result = await create({ name, playerCount });
        const url = `/?new=1&room=${result.roomId}&t=${result.inviteToken}`;
        if (typeof window !== "undefined") {
            window.history.replaceState({ created: result }, "", url);
        }
        setCreated(result);
        setCopyStatus("idle");
    }

    async function handleJoinSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const code = formatJoinCode(joinCode).toUpperCase();
        if (!code) return;
        const { roomId } = await join({ code });
        console.log("joined", roomId);
        const token = `mock.${roomId}`;
        navigate(`/?new=1&room=${roomId}&t=${token}`, {
            replace: true,
            state: { joined: true, roomId },
        });
    }

    function handleJoinCodeChange(event: React.ChangeEvent<HTMLInputElement>) {
        const raw = event.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        setJoinCode(raw.slice(0, 6));
    }

    function adjustPlayerCount(delta: number) {
        setPlayerCount((previous) => {
            const next = previous + delta;
            if (next < 2) return 2;
            if (next > 6) return 6;
            return next;
        });
    }

    const nameValue = displayName ?? "";
    const isCreating = roomState === "creating";
    const isJoining = roomState === "joining";

    async function handleCopy() {
        if (!inviteUrl || typeof navigator === "undefined" || !navigator.clipboard) return;
        try {
            await navigator.clipboard.writeText(inviteUrl);
            setCopyStatus("copied");
            setTimeout(() => setCopyStatus("idle"), 2000);
        } catch {
            setCopyStatus("idle");
        }
    }

    async function handleResume() {
        const room = resumeRoomId ?? lastRoomId;
        if (!room) return;
        await rejoin({ roomId: room });
        console.log("rejoined", room);
        navigate(`/?new=1&room=${room}&t=mock.${room}`, {
            replace: true,
            state: { joined: true, roomId: room },
        });
    }

    return (
        <div className="flex w-full flex-1 justify-center px-4 py-10" style={{ backgroundColor: "var(--a2-bg)" }}>
            <div
                className="flex w-full max-w-4xl flex-col gap-6 p-6 sm:p-8"
                style={{
                    borderRadius: "var(--a2-radius-container)",
                    border: "1px solid var(--a2-panel-border)",
                    backgroundColor: "var(--a2-panel)",
                    boxShadow: "0 30px 80px -50px var(--a2-shadow-warm)",
                    backdropFilter: "blur(10px)",
                }}
            >
                <header className="space-y-2 text-center" style={{ color: "var(--a2-text-primary)" }}>
                    <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                        Willkommen zurück bei Kniffel Online
                    </h1>
                    <p className="text-sm sm:text-base" style={{ color: "var(--a2-text-muted)" }}>
                        Starte eine neue Runde oder tritt einem bestehenden Spiel bei – ganz ohne Setup-Marathon.
                    </p>
                </header>

                <nav className="flex items-center justify-center gap-2" aria-label="Startoptionen">
                    {TABS.map((tab) => {
                        const isActive = tab.key === activeTab;
                        return (
                            <Button
                                key={tab.key}
                                type="button"
                                variant={isActive ? "autumn" : "outline"}
                                className="px-5 py-2 text-sm font-semibold transition-all"
                                style={
                                    isActive
                                        ? {
                                              backgroundImage:
                                                  "linear-gradient(90deg, var(--a2-accent), var(--a2-accent-hover-to))",
                                              color: "white",
                                              boxShadow: "0 18px 40px -24px var(--a2-shadow-warm)",
                                          }
                                        : {
                                              borderColor: "color-mix(in srgb, var(--a2-accent) 35%, transparent)",
                                              color: "var(--a2-text-primary)",
                                          }
                                }
                                onClick={() => setActiveTab(tab.key)}
                                aria-pressed={isActive}
                            >
                                {tab.label}
                            </Button>
                        );
                    })}
                </nav>

                {activeTab === "host" ? (
                    <form
                        className="flex flex-col gap-6 p-6 shadow-inner"
                        style={{
                            borderRadius: "var(--a2-radius-container)",
                            border: "1px solid color-mix(in srgb, var(--a2-accent) 22%, transparent)",
                            backgroundColor: "color-mix(in srgb, var(--a2-panel) 70%, white)",
                            color: "var(--a2-text-primary)",
                        }}
                        onSubmit={handleNameSubmit}
                    >
                        <div className="space-y-2">
                            <label
                                htmlFor="display-name"
                                className="block text-sm font-semibold"
                                style={{ color: "var(--a2-text-primary)" }}
                            >
                                Dein Name
                            </label>
                            <Input
                                id="display-name"
                                name="displayName"
                                value={nameValue}
                                onChange={(event) => setDisplayName(event.target.value)}
                                placeholder="z. B. Luna"
                                autoComplete="name"
                                required
                                aria-required="true"
                            />
                        </div>

                        <div className="space-y-2">
                            <span
                                className="block text-sm font-semibold"
                                style={{ color: "var(--a2-text-primary)" }}
                            >
                                Mitspieler
                            </span>
                            <div
                                className="flex items-center justify-between p-3"
                                style={{
                                    borderRadius: "var(--a2-radius-control)",
                                    border: "1px solid color-mix(in srgb, var(--a2-accent) 18%, transparent)",
                                    backgroundColor: "color-mix(in srgb, white 80%, var(--a2-panel) 20%)",
                                }}
                            >
                                <div className="flex flex-col text-sm" style={{ color: "var(--a2-text-muted)" }}>
                                    <span className="font-semibold" style={{ color: "var(--a2-text-primary)" }}>
                                        {playerCount} Spieler
                                    </span>
                                    <span className="text-xs">(mind. 2, max. 6)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        aria-label="Weniger Spieler"
                                        onClick={() => adjustPlayerCount(-1)}
                                        disabled={playerCount <= 2}
                                    >
                                        –
                                    </Button>
                                    <div
                                        className="flex h-10 w-12 items-center justify-center text-lg font-semibold"
                                        style={{
                                            borderRadius: "var(--a2-radius-control)",
                                            border: "1px solid color-mix(in srgb, var(--a2-accent) 18%, transparent)",
                                            backgroundColor: "var(--a2-panel)",
                                            color: "var(--a2-text-primary)",
                                        }}
                                    >
                                        {playerCount}
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        aria-label="Mehr Spieler"
                                        onClick={() => adjustPlayerCount(1)}
                                        disabled={playerCount >= 6}
                                    >
                                        +
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <Button
                                type="submit"
                                variant="autumn"
                                className="w-full py-3 text-base font-semibold text-white shadow-lg sm:w-auto"
                                style={{
                                    backgroundImage: "linear-gradient(90deg, var(--a2-accent), var(--a2-accent-hover-to))",
                                    boxShadow: "0 16px 40px -20px var(--a2-shadow-warm)",
                                }}
                                disabled={isCreating}
                            >
                                {isCreating ? "Erstelle Lobby..." : "Spiel erstellen"}
                            </Button>
                            <p className="text-xs sm:text-sm" style={{ color: "var(--a2-text-muted)" }}>
                                Deine Spieler-ID bleibt erhalten: perfekte Grundlage für Serien.
                            </p>
                        </div>
                    </form>
                ) : (
                    <form
                        className="flex flex-col gap-6 p-6 shadow-inner"
                        style={{
                            borderRadius: "var(--a2-radius-container)",
                            border: "1px solid var(--a2-panel-border)",
                            backgroundColor: "white",
                            color: "var(--a2-text-primary)",
                        }}
                        onSubmit={handleJoinSubmit}
                    >
                        <div className="space-y-2">
                            <label
                                htmlFor="join-code"
                                className="block text-sm font-semibold"
                                style={{ color: "var(--a2-text-primary)" }}
                            >
                                Spielcode
                            </label>
                            <Input
                                id="join-code"
                                name="joinCode"
                                value={formattedJoinCode}
                                onChange={handleJoinCodeChange}
                                placeholder="ABC-123"
                                inputMode="text"
                                autoCapitalize="characters"
                                autoComplete="one-time-code"
                                maxLength={7}
                                aria-describedby="join-code-hint"
                                required
                            />
                            <span
                                id="join-code-hint"
                                className="text-xs"
                                style={{ color: "var(--a2-text-muted)" }}
                            >
                                Sechs Zeichen – Buchstaben und Zahlen.
                            </span>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                                <Button
                                    type="submit"
                                    variant="autumn"
                                    className="w-full py-3 text-base font-semibold text-white shadow-lg sm:w-auto"
                                    style={{
                                        backgroundImage: "linear-gradient(90deg, var(--a2-accent), var(--a2-accent-hover-to))",
                                        boxShadow: "0 16px 40px -20px var(--a2-shadow-warm)",
                                    }}
                                >
                                    {isJoining ? "Beitritt läuft..." : "Beitreten"}
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="w-full border border-dashed py-3 text-sm font-medium sm:w-auto"
                                    style={{
                                        borderColor: "color-mix(in srgb, var(--a2-accent) 45%, transparent)",
                                        color: "var(--a2-accent)",
                                        backgroundColor: "transparent",
                                    }}
                                    onClick={() => console.log("scan")}
                                >
                                    QR scannen
                                </Button>
                            </div>
                            <p className="text-xs sm:text-sm" style={{ color: "var(--a2-text-muted)" }}>
                                Tipp: QR-Codes ersparen das Eintippen des Spielcodes.
                            </p>
                        </div>
                    </form>
                )}

                <footer
                    className="px-4 py-3 text-center text-sm"
                    style={{
                        borderRadius: "var(--a2-radius-control)",
                        border: "1px solid color-mix(in srgb, var(--a2-accent) 18%, transparent)",
                        backgroundColor: "color-mix(in srgb, white 75%, var(--a2-panel) 25%)",
                        color: "var(--a2-text-muted)",
                    }}
                >
                    {resumeRoomId || lastRoomId ? (
                        <Button
                            type="button"
                            variant="autumn"
                            className="w-full py-2 text-sm font-semibold text-white sm:w-auto"
                            style={{
                                backgroundImage: "linear-gradient(90deg, var(--a2-accent), var(--a2-accent-hover-to))",
                                boxShadow: "0 12px 28px -18px var(--a2-shadow-warm)",
                            }}
                            onClick={handleResume}
                        >
                            Letztes Spiel fortsetzen
                        </Button>
                    ) : (
                        "Letztes Spiel fortsetzen – kommt bald."
                    )}
                </footer>

                {created && (
                    <section
                        className="flex flex-col gap-4 rounded-2xl p-6"
                        style={{
                            border: "1px solid color-mix(in srgb, var(--a2-accent) 22%, transparent)",
                            backgroundColor: "color-mix(in srgb, white 80%, var(--a2-panel) 20%)",
                            color: "var(--a2-text-primary)",
                        }}
                    >
                        <div className="space-y-1">
                            <h2 className="text-lg font-semibold">Einladung teilen</h2>
                            <p className="text-sm" style={{ color: "var(--a2-text-muted)" }}>
                                Lade Mitspieler per Link oder Code ein.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-1 items-center gap-3 rounded-xl border px-3 py-2" style={{ borderColor: "color-mix(in srgb, var(--a2-accent) 20%, transparent)" }}>
                                <div className="flex-1 truncate text-sm" title={inviteUrl}>
                                    {inviteUrl}
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleCopy}
                                    className="text-sm"
                                >
                                    {copyStatus === "copied" ? "Kopiert" : "Link kopieren"}
                                </Button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-3xl font-bold tracking-[0.4em]" aria-label="Spielcode">
                                {created.code}
                            </div>
                            <div
                                className="flex h-32 w-32 items-center justify-center rounded-xl border"
                                style={{ borderColor: "color-mix(in srgb, var(--a2-accent) 18%, transparent)" }}
                                aria-hidden="true"
                            >
                                {/* TODO: QR-Code Integration */}
                                <span className="text-xs" style={{ color: "var(--a2-text-muted)" }}>
                                    QR
                                </span>
                            </div>
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}

// Farben ersetzt durch Variablen:
// #f9f4ef → var(--a2-bg)
// rgba(255,255,255,0.8) → var(--a2-panel)
// rgba(143,89,49,0.1) → var(--a2-panel-border)
// #2c1408 → var(--a2-text-primary)
// rgba(99,63,45,0.6) → var(--a2-text-muted)
// #d47a2e → var(--a2-accent)
// #f0ad43 → var(--a2-accent-hover-to)
// rgba(120,60,15,0.6) → var(--a2-shadow-warm)
// #9f6644 → var(--a2-placeholder)
// SharePanel zeigt Link (Invite-URL), großen Code und QR-Stub.
