import { soundManager } from "../lib/sounds";

type DiceProps = {
    value: number;
    held: boolean;
    isRolling: boolean;
    onToggle: () => void;
    disabled?: boolean;
};

// Einfache 2D Würfel-Augen Positionen (3x3 Grid)
const DICE_DOTS: Record<number, number[]> = {
    1: [4], // Mitte
    2: [0, 8], // Diagonal
    3: [0, 4, 8], // Diagonal + Mitte
    4: [0, 2, 6, 8], // Ecken
    5: [0, 2, 4, 6, 8], // Ecken + Mitte
    6: [0, 2, 3, 5, 6, 8] // Zwei Spalten
};

export default function Dice({ value, held, isRolling, onToggle, disabled = false }: DiceProps) {
    const handleClick = () => {
        if (!disabled && !isRolling) {
            soundManager.thudSound();
            onToggle();
        }
    };

    const statusText = held ? "Festgehalten - Klicken zum Freigeben" : "Frei - Klicken zum Festhalten";
    const dots = DICE_DOTS[value] || [];

    return (
        <button
            onClick={handleClick}
            disabled={disabled || isRolling}
            className={`die-2d ${held ? 'held' : ''} ${isRolling ? 'rolling' : ''}`}
            title={statusText}
            aria-label={`Würfel ${value}, ${statusText}`}
        >
            <div className="die-face-2d">
                <div className="dots-grid">
                    {Array.from({ length: 9 }, (_, index) => (
                        <div
                            key={index}
                            className={`dot ${dots.includes(index) ? 'active' : ''}`}
                        />
                    ))}
                </div>
            </div>
        </button>
    );
}