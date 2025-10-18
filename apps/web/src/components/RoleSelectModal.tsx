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
};

type RoleEntry = {
  role: RoomRole;
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
          disabled: !trimmed,
          description: "Frei - jetzt reservieren",
          countdown: null,
          isReservedForYou: false,
        } satisfies RoleEntry;
      }

      if (sameName) {
        return {
          role,
          disabled: !trimmed,
          description: slot.connected ? "Bereits verbunden" : "Reserviert fuer dich",
          countdown,
          isReservedForYou: true,
        } satisfies RoleEntry;
      }

      const connectionStatus = slot.connected ? "online" : "offline";
      return {
        role,
        disabled: true,
        description: `Belegt von ${slot.name ?? "jemand"} (${connectionStatus})`,
        countdown,
        isReservedForYou: false,
      } satisfies RoleEntry;
    });
  }, [status, trimmed, lowerTrimmed, now]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <header className="modal-header">
          <h2>Wer bist du?</h2>
          {trimmed && (
            <button className="modal-close" onClick={onClose} aria-label="Fenster schliessen">
              x
            </button>
          )}
        </header>
        <p className="modal-description">
          Reserviere eine Rolle und gib deinen Anzeigenamen ein. Wenn du bereits gespielt hast,
          waehle dieselbe Kombination, um sofort wieder einzusteigen.
        </p>
        {status && (
          <p className="modal-hint" style={{ marginTop: 4, marginBottom: 8, color: '#666' }}>
            Spielerzahl: <strong>{Math.max(2, Math.min(6, status.capacity || 2))}</strong>
          </p>
        )}

        <label className="modal-label" htmlFor="player-name-input">
          Anzeigename
        </label>
        <input
          id="player-name-input"
          className="modal-input"
          type="text"
          value={name}
          maxLength={MAX_LENGTH}
          onChange={(event) => {
            setName(event.target.value.slice(0, MAX_LENGTH));
            if (error) clearError();
          }}
          placeholder="Name"
        />
        {error && <p className="modal-error">{error}</p>}

        <div
          className="role-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            maxHeight: 320,
            overflowY: 'auto',
            paddingRight: 4,
          }}
        >
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
                {entry.countdown && (
                  <span className="role-countdown">{entry.countdown}</span>
                )}
                {claiming && <span className="role-progress">Verbinde ...</span>}
              </button>
            );
          })}
        </div>
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
