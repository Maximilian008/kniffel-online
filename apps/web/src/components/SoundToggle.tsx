import { useEffect, useState } from "react";
import { soundManager } from "../lib/sounds";

export default function SoundToggle() {
  const [isEnabled, setIsEnabled] = useState(soundManager.isAudioEnabled());

  useEffect(() => {
    const unsubscribe = soundManager.subscribe(setIsEnabled);
    return unsubscribe;
  }, []);

  const toggleSound = () => {
    const nextEnabled = soundManager.toggleSound();
    if (nextEnabled) {
      soundManager.buttonClick();
    }
    setIsEnabled(nextEnabled);
  };

  return (
    <button
      type="button"
      className="btn btn-ghost sound-toggle"
      onClick={toggleSound}
      title={`Sound ${isEnabled ? "aus" : "ein"}schalten (M)`}
      aria-label={`Sound ${isEnabled ? "deaktivieren" : "aktivieren"}`}
      aria-pressed={isEnabled}
    >
      {isEnabled ? "🔊" : "🔇"}
    </button>
  );
}
