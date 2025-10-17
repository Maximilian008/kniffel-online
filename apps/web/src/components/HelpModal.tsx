type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function HelpModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="history-overlay" role="dialog" aria-modal="true">
      <div className="history-dialog">
        <header className="history-header">
          <h2>Hilfe</h2>
          <div className="history-actions">
            <button className="btn btn-primary" onClick={onClose}>
              Schließen
            </button>
          </div>
        </header>
        <div className="history-body">
          <p>So funktioniert es kurz und bündig:</p>
          <ul>
            <li>Oben im Header auf „Rolle wechseln“ klicken, Namen eintragen und reservieren.</li>
            <li>Wenn beide verbunden sind: Spiel starten und abwechselnd würfeln.</li>
            <li>Bis zu drei Würfe pro Zug – der erste Wurf geschieht automatisch beim Start.</li>
            <li>Klicke einzelne Würfel an, um sie zu halten oder wieder freizugeben.</li>
            <li>Wähle eine Kategorie aus, sobald du zufrieden bist. Die Punkte landen automatisch im Bogen.</li>
            <li>Der Spielverlauf wird gespeichert und ist jederzeit über „Verlauf“ abrufbar.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
