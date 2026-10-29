import { useEffect, useMemo, useState } from "react";
import type { RoomRole, RoomStatusPayload } from "../lib/socket";
import { ROLE_LABELS } from "../lib/socket";

type Props = {
  isOpen: boolean;
  status: RoomStatusPayload | null;
  suggestedName: string;
  onClose: () => void;
  onClaim: (role: RoomRole, name: string) => void;
  isClaiming: RoomRole | null;
  error: string | null;
  clearError: () => void;
  /** Set while nobody has a seat yet: the first visitor chooses how many play. */
  onPlayerCountChange?: (count: number) => void;
};

type RoleEntry = {
  role: RoomRole;
  /** The seat can be taken (free, reserved for this name, or its player is gone). */
  available: boolean;
  disabled: boolean;
  description: string;
  countdown: string | null;
  isReservedForYou: boolean;
};

function getRoles(capacity: number): RoomRole[] {
  const n = Math.max(2, Math.min(6, capacity || 2));
  return Array.from({ length: n }, (_, i) => `p${i + 1}` as RoomRole);
}
const MAX_LENGTH = 40;

export default function RoleSelectModal({
  isOpen,
  status,
  suggestedName,
  onClose,
  onClaim,
  isClaiming,
  error,
  clearError,
  onPlayerCountChange,
}: Props) {
  const [name, setName] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isOpen) return;
    setName(suggestedName);
  }, [isOpen, suggestedName]);

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, [isOpen]);

  const trimmed = name.trim();
  const lowerTrimmed = trimmed.toLowerCase();

  const roleEntries = useMemo<RoleEntry[]>(() => {
    const roles = getRoles(status?.capacity ?? 2);
    return roles.map((role) => {
      const slot = status?.roles[role];
      if (!slot) {
        return {
          role,
          available: false,
          disabled: !trimmed,
          description: "Status unbekannt",
          countdown: null,
          isReservedForYou: false,
        } satisfies RoleEntry;
      }

      const secondsLeft = slot.releaseDeadline
        ? Math.max(0, Math.round((slot.releaseDeadline - now) / 1000))
        : null;
      const countdown = secondsLeft && !slot.connected ? formatCountdown(secondsLeft) : null;
      const sameName = slot.name?.toLowerCase() === lowerTrimmed;

      if (!slot.occupied) {
        return {
          role,
          available: true,
          disabled: !trimmed,
          description: "Frei - jetzt reservieren",
          countdown: null,
          isReservedForYou: false,
        } satisfies RoleEntry;
      }

      if (sameName) {
        return {
          role,
          available: !slot.connected,
          disabled: !trimmed,
          description: slot.connected ? "Bereits verbunden" : "Reserviert für dich",
          countdown,
          isReservedForYou: true,
        } satisfies RoleEntry;
      }

      // A disconnected player's seat can be taken over once the grace period has passed.
      if (!slot.connected && slot.releaseDeadline !== null && slot.releaseDeadline <= now) {
        return {
          role,
          available: true,
          disabled: !trimmed,
          description: `Frei – ${slot.name ?? "jemand"} ist nicht mehr verbunden`,
          countdown: null,
          isReservedForYou: false,
        } satisfies RoleEntry;
      }

      const connectionStatus = slot.connected ? "verbunden" : "nicht verbunden";
      return {
        role,
        available: false,
        disabled: true,
        description: `Belegt von ${slot.name ?? "jemand"} (${connectionStatus})`,
        countdown,
        isReservedForYou: false,
      } satisfies RoleEntry;
    });
  }, [status, trimmed, lowerTrimmed, now]);

  // "Mitspielen" takes the seat reserved for this name, otherwise the first free one.
  const ownSeat = roleEntries.find((entry) => entry.isReservedForYou && entry.available);
  const joinSeat = ownSeat ?? roleEntries.find((entry) => entry.available);
  const tableFull = Boolean(status) && !joinSeat;
  const join = () => {
    if (joinSeat && trimmed) onClaim(joinSeat.role, trimmed);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="role-modal-title">
      <div className="modal">
        <header className="modal-header">
          <h2 id="role-modal-title">Wer bist du?</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fenster schließen">
            x
          </button>
        </header>
        <p className="modal-description">
          {tableFull
            ? "Der Tisch ist gerade voll. Du kannst zuschauen und einsteigen, sobald ein Platz frei wird."
            : "Gib deinen Namen ein und spiel mit. Wenn du schon dabei warst, nimm denselben Namen – dann kommst du auf deinen Platz zurück."}
        </p>
        {status && onPlayerCountChange && (
          <div className="modal-player-count">
            <span className="modal-label">Wie viele spielen mit?</span>
            <div className="modal-stepper">
              <button
                type="button"
                aria-label="Einen Spieler weniger"
                disabled={status.capacity <= 2}
                onClick={() => onPlayerCountChange(status.capacity - 1)}
              >
                −
              </button>
              <strong>{status.capacity}</strong>
              <button
                type="button"
                aria-label="Einen Spieler mehr"
                disabled={status.capacity >= 6}
                onClick={() => onPlayerCountChange(status.capacity + 1)}
              >
                +
              </button>
            </div>
          </div>
        )}

        <label className="modal-label" htmlFor="player-name-input">
          Dein Name
        </label>
        <input
          id="player-name-input"
          className="modal-input"
          type="text"
          value={name}
          maxLength={MAX_LENGTH}
          autoComplete="nickname"
          onChange={(event) => {
            setName(event.target.value.slice(0, MAX_LENGTH));
            if (error) clearError();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") join();
          }}
          placeholder="z. B. Oma Erika"
        />
        {error && <p className="modal-error">{error}</p>}

        {tableFull ? (
          <button type="button" className="modal-primary" onClick={onClose}>
            Zuschauen
          </button>
        ) : (
          <button
            type="button"
            className="modal-primary"
            disabled={!trimmed || !joinSeat || isClaiming !== null}
            onClick={join}
          >
            {isClaiming ? "Verbinde …" : ownSeat ? `Weiterspielen als ${ROLE_LABELS[ownSeat.role]}` : "Mitspielen"}
          </button>
        )}

        <details className="modal-seats">
          <summary>Bestimmten Platz wählen</summary>
          <div className="role-grid">
            {roleEntries.map((entry) => {
              const claiming = isClaiming === entry.role;
              return (
                <button
                  key={entry.role}
                  type="button"
                  className={`role-button${entry.isReservedForYou ? " role-button--own" : ""}`}
                  disabled={entry.disabled || claiming}
                  onClick={() => onClaim(entry.role, trimmed || name)}
                >
                  <span className="role-title">{ROLE_LABELS[entry.role]}</span>
                  <span className="role-status">{entry.description}</span>
                  {entry.countdown && <span className="role-countdown">{entry.countdown}</span>}
                  {claiming && <span className="role-progress">Verbinde ...</span>}
                </button>
              );
            })}
          </div>
        </details>
      </div>
    </div>
  );
}

function formatCountdown(secondsLeft: number): string {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  if (minutes > 0) {
    return `Freigabe in ${minutes}:${seconds.toString().padStart(2, "0")} min`;
  }
  return `Freigabe in ${seconds}s`;
}
