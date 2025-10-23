
type Props = {
  connectionPhase: "connecting" | "waiting" | "matched";
  localName: string;
  localPlaceholder: string;
  canEdit: boolean;
  localReady: boolean;
  opponentReady?: boolean;
  opponentConnected: boolean;
  startDisabled: boolean;
  playerCount?: number;
  onPlayerCountChange?: (count: number) => void;
  onNameChange: (value: string) => void;
  onNameFocus: () => void;
  onNameBlur: () => void;
  onStart: () => void;
  onOpenHistory: () => void;
  opponentName?: string;
  players?: Array<{ name: string; connected: boolean; ready: boolean; isSelf?: boolean }>;
};

export default function SetupScreen({
  connectionPhase,
  localName,
  localPlaceholder,
  canEdit,
  localReady,
  opponentReady = false,
  opponentConnected,
  startDisabled,
  onNameChange,
  onNameFocus,
  onNameBlur,
  onStart,
  onOpenHistory,
  playerCount,
  onPlayerCountChange,
  opponentName = "Warten...",
  players,
}: Props) {
  const isConnecting = connectionPhase === "connecting";
  const isWaiting = connectionPhase === "waiting";
  const isMatched = connectionPhase === "matched";

  function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }

  return (
    <div className="panel setup-screen">
      <header className="screen-header">
        <h1>🎲 Kniffel Online</h1>
        <p>Lade einen Freund ein, gebt eure Namen ein und würfelt zusammen!</p>
      </header>

      <div className="name-grid">
        {/* Spielerzahl-Auswahl */}
        <div className="name-card">
          <label>Spielerzahl</label>
          <div className="count-buttons">
            {[2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                className={`btn ${playerCount === n ? "btn-primary" : "btn-outline"}`}
                onClick={() => onPlayerCountChange?.(n)}
                title={`${n} Spieler`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="hint">Wähle die Anzahl der Spieler (2–6).</p>
        </div>

        <div className={`name-card ${isConnecting ? 'loading' : ''}`}>
          <label htmlFor="player-name">Dein Name</label>
          <input
            id="player-name"
            type="text"
            value={localName}
            placeholder={localPlaceholder}
            onChange={(event) => onNameChange(event.target.value)}
            onFocus={onNameFocus}
            onBlur={onNameBlur}
            disabled={!canEdit}
            className="input"
            autoComplete="name"
            maxLength={20}
          />
          <p className="hint">Klicke hier, um deinen Namen anzupassen.</p>
          {localReady && (
            <div className="ready-indicator">
              <span
                className="ready-chip"
                aria-live="polite"
                style={{
                  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  color: '#ecfdf5',
                  border: '1px solid #22c55e',
                  padding: '2px 10px',
                  height: 24,
                  borderRadius: 999,
                  boxShadow: '0 0 10px rgba(34,197,94,0.4), 0 2px 8px rgba(34,197,94,0.2)'
                }}
              >
                <span className="chip-icon">✓</span>
                Bereit
              </span>
            </div>
          )}
        </div>

        <div className={`name-card opponent-card ${!opponentConnected ? 'waiting' : ''}`}>
          <label>Gegner</label>
          {players && players.length > 0 ? (
            <div>
              <ul
                className={`player-list ${players.filter(p => !p.isSelf).length >= 5 ? 'player-list--grid' : ''}`}
                aria-label="Mitspieler"
              >
                {players.filter(p => !p.isSelf).map((p, idx) => (
                  <li
                    key={idx}
                    className="player-list-item"
                  >
                    <span
                      className="player-avatar"

                    >
                      <span className="player-avatar-text">{initials(p.name || 'Unbekannt')}</span>
                      <span
                        className={`avatar-dot ${p.connected ? 'online' : 'offline'}`}
                        aria-hidden="true"

                      />
                    </span>
                    <span className="player-list-name">{p.name || 'Unbekannt'}</span>
                    {p.ready && (
                      <span
                        className="ready-chip"
                        title="Bereit"
                        aria-label="Bereit"
                        style={{ marginLeft: 'auto' }}
                      >
                        <span className="chip-icon">✓</span>
                        Bereit
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <div className={`status-indicator ${opponentConnected ? (opponentReady ? "status-ready" : "status-connected") : "status-waiting"}`}>
                <span className="status-dot"></span>
                <span className="status-text">
                  {!opponentConnected
                    ? "Offline"
                    : opponentReady
                      ? "Alle Gegner bereit"
                      : "Verbunden"
                  }
                </span>
              </div>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={opponentConnected ? opponentName : (isWaiting ? "Warten auf Mitspieler..." : "Verbindung wird hergestellt...")}
                readOnly
                disabled
                className="input input-muted"
              />
              <div className={`status-indicator ${opponentConnected ? (opponentReady ? "status-ready" : "status-connected") : "status-waiting"}`}>
                <span className="status-dot"></span>
                <span className="status-text">
                  {!opponentConnected
                    ? "Offline"
                    : opponentReady
                      ? "Bereit!"
                      : "Verbunden"
                  }
                </span>
              </div>
              {opponentReady && (
                <div className="ready-indicator">
                  <span className="ready-icon">✓</span>
                  <span>Bereit!</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="setup-actions">
        <button
          className={`btn btn-primary ${isMatched && opponentConnected ? 'pulse' : ''}`}
          onClick={onStart}
          disabled={startDisabled}
        >
          {localReady ? "Warten auf Gegner..." : "Spiel starten"}
        </button>
        <button className="btn btn-ghost" onClick={onOpenHistory}>
          📊 Spielhistorie
        </button>
      </div>

      <div className="status-message">
        <div className={`connection-indicator ${connectionPhase}`}>
          <span className="indicator-dot"></span>
        </div>
        <p className="setup-status">{getGermanStatusMessage({
          connectionPhase,
          opponentConnected,
          localReady,
          opponentReady,
        })}</p>
      </div>
    </div>
  );
}

function getGermanStatusMessage(args: {
  connectionPhase: "connecting" | "waiting" | "matched";
  opponentConnected: boolean;
  localReady: boolean;
  opponentReady: boolean;
}) {
  if (args.connectionPhase === "connecting") {
    return "Verbindung zum Spielserver wird hergestellt...";
  }
  if (args.connectionPhase === "waiting") {
    return "Warten auf einen weiteren Spieler...";
  }
  if (!args.opponentConnected) {
    return "Teile den Link und warte darauf, dass dein Gegner beitritt.";
  }
  if (!args.opponentReady) {
    return "Gegner verbunden. Warten darauf, dass er auf Start drückt.";
  }
  if (!args.localReady) {
    return "Drücke Start, wenn du bereit bist.";
  }
  return "Beide Spieler sind bereit!";
}


