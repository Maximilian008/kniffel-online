
type Props = {
  connectionPhase: "connecting" | "waiting" | "matched";
  localName: string;
  localPlaceholder: string;
  canEdit: boolean;
  localReady: boolean;
  opponentReady: boolean;
  opponentConnected: boolean;
  startDisabled: boolean;
  onNameChange: (value: string) => void;
  onNameFocus: () => void;
  onNameBlur: () => void;
  onStart: () => void;
  onOpenHistory: () => void;
  opponentName?: string;
};

export default function SetupScreen({
  connectionPhase,
  localName,
  localPlaceholder,
  canEdit,
  localReady,
  opponentReady,
  opponentConnected,
  startDisabled,
  onNameChange,
  onNameFocus,
  onNameBlur,
  onStart,
  onOpenHistory,
  opponentName = "Warten...",
}: Props) {
  const isConnecting = connectionPhase === "connecting";
  const isWaiting = connectionPhase === "waiting";
  const isMatched = connectionPhase === "matched";

  return (
    <div className="panel setup-screen">
      <header className="screen-header">
        <h1>🎲 Kniffel Online</h1>
        <p>Lade einen Freund ein, gebt eure Namen ein und würfelt zusammen!</p>
      </header>

      <div className="name-grid">
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
              <span className="ready-icon">✓</span>
              <span>Bereit!</span>
            </div>
          )}
        </div>

        <div className={`name-card opponent-card ${!opponentConnected ? 'waiting' : ''}`}>
          <label>Gegner</label>
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


