import { useMemo, useState } from "react";

import "../../styles/theme.css";

import { Button } from "../../../autumn/ui/button";
import { Input } from "../../../autumn/ui/input";
import { useIdentity } from "../../hooks/useIdentity";

type TabKey = "host" | "join";

const TABS: Array<{ key: TabKey; label: string }> = [
    { key: "host", label: "Neues Spiel" },
    { key: "join", label: "Beitreten" },
];

function formatJoinCode(value: string) {
    if (value.length <= 3) return value;
    return `${value.slice(0, 3)}-${value.slice(3, 6)}`;
}

export function StartScreen() {
    const { displayName, setDisplayName } = useIdentity();
    const [activeTab, setActiveTab] = useState<TabKey>("host");
    const [playerCount, setPlayerCount] = useState<number>(4);
    const [joinCode, setJoinCode] = useState<string>("");

    const formattedJoinCode = useMemo(() => formatJoinCode(joinCode), [joinCode]);

    function handleNameSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const name = (displayName ?? "").trim();
        console.log("create", { name, playerCount });
    }

    function handleJoinSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const code = formatJoinCode(joinCode).toUpperCase();
        console.log("join", { code });
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
                            >
                                Spiel erstellen
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
                                    Beitreten
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
                    Letztes Spiel fortsetzen – kommt bald.
                </footer>
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
