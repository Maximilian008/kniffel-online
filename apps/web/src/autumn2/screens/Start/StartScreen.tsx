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
        <div className="flex w-full flex-1 justify-center bg-gradient-to-b from-amber-50/70 to-transparent px-4 py-10">
            <div className="flex w-full max-w-4xl flex-col gap-6 rounded-3xl border border-orange-900/10 bg-white/80 p-6 shadow-[0_30px_80px_-50px_rgba(120,60,15,0.6)] backdrop-blur-sm sm:p-8">
                <header className="space-y-2 text-center text-orange-950">
                    <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                        Willkommen zurück bei Kniffel Online
                    </h1>
                    <p className="text-sm text-orange-900/80 sm:text-base">
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
                                className={`px-5 py-2 text-sm font-semibold transition-all ${
                                    isActive
                                        ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg"
                                        : "border-orange-300/60 text-orange-900 hover:border-orange-400"
                                }`}
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
                        className="flex flex-col gap-6 rounded-2xl border border-orange-900/15 bg-orange-50/60 p-6 text-orange-950 shadow-inner"
                        onSubmit={handleNameSubmit}
                    >
                        <div className="space-y-2">
                            <label htmlFor="display-name" className="block text-sm font-semibold text-orange-900">
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
                            <span className="block text-sm font-semibold text-orange-900">Mitspieler</span>
                            <div className="flex items-center justify-between rounded-xl border border-orange-900/10 bg-white/70 p-3">
                                <div className="flex flex-col text-sm text-orange-900/80">
                                    <span className="font-semibold text-orange-950">{playerCount} Spieler</span>
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
                                    <div className="flex h-10 w-12 items-center justify-center rounded-md border border-orange-900/20 bg-white text-lg font-semibold text-orange-950">
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
                                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 py-3 text-base font-semibold text-white shadow-lg shadow-orange-500/30 hover:from-orange-600 hover:to-amber-600 sm:w-auto"
                            >
                                Spiel erstellen
                            </Button>
                            <p className="text-xs text-orange-900/70 sm:text-sm">
                                Deine Spieler-ID bleibt erhalten: perfekte Grundlage für Serien.
                            </p>
                        </div>
                    </form>
                ) : (
                    <form
                        className="flex flex-col gap-6 rounded-2xl border border-orange-900/15 bg-white p-6 text-orange-950 shadow-inner"
                        onSubmit={handleJoinSubmit}
                    >
                        <div className="space-y-2">
                            <label htmlFor="join-code" className="block text-sm font-semibold text-orange-900">
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
                            <span id="join-code-hint" className="text-xs text-orange-900/70">
                                Sechs Zeichen – Buchstaben und Zahlen.
                            </span>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                                <Button
                                    type="submit"
                                    variant="autumn"
                                    className="w-full bg-gradient-to-r from-orange-500 to-amber-500 py-3 text-base font-semibold text-white shadow-lg shadow-orange-500/30 hover:from-orange-600 hover:to-amber-600 sm:w-auto"
                                >
                                    Beitreten
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="w-full border border-dashed border-orange-400/60 py-3 text-sm font-medium text-orange-800 hover:bg-orange-100/50 sm:w-auto"
                                    onClick={() => console.log("scan")}
                                >
                                    QR scannen
                                </Button>
                            </div>
                            <p className="text-xs text-orange-900/70 sm:text-sm">
                                Tipp: QR-Codes ersparen das Eintippen des Spielcodes.
                            </p>
                        </div>
                    </form>
                )}

                <footer className="rounded-2xl border border-orange-900/10 bg-orange-100/60 px-4 py-3 text-center text-sm text-orange-900/80">
                    Letztes Spiel fortsetzen – kommt bald.
                </footer>
            </div>
        </div>
    );
}
