import { useEffect, useRef, useState } from 'react';
import { soundManager } from '../lib/sounds';

type DiceAnimationProps = {
    diceValues: [number, number, number, number, number];
    isRolling: boolean;
    onAnimationComplete?: () => void;
};

// 3D Würfel-Augen Positionen (3x3 Grid)
const DICE_DOTS_3D: Record<number, number[]> = {
    1: [4], // Mitte
    2: [0, 8], // Diagonal
    3: [0, 4, 8], // Diagonal + Mitte
    4: [0, 2, 6, 8], // Ecken
    5: [0, 2, 4, 6, 8], // Ecken + Mitte
    6: [0, 2, 3, 5, 6, 8] // Zwei Spalten
};

// 3D Würfel-Seite
function DiceFace3D({ value, side }: { value: number; side: string }) {
    const dots = DICE_DOTS_3D[value] || [];

    return (
        <div className={`cube-face cube-face-${side}`}>
            <div className="dots-grid-3d">
                {Array.from({ length: 9 }, (_, index) => (
                    <div
                        key={index}
                        className={`dot-3d ${dots.includes(index) ? 'active' : ''}`}
                    />
                ))}
            </div>
        </div>
    );
}

// Einzelner 3D Animations-Würfel
function AnimatedDie3D({ value, isAnimating }: { value: number; isAnimating: boolean }) {
    // Würfel-Seiten-Werte berechnen (gegenüberliegende Seiten ergeben 7)
    const faces = {
        front: value,
        back: 7 - value,
        right: value === 1 ? 3 : value === 2 ? 1 : value === 3 ? 6 : value === 4 ? 2 : value === 5 ? 4 : 5,
        left: value === 1 ? 4 : value === 2 ? 6 : value === 3 ? 1 : value === 4 ? 5 : value === 5 ? 2 : 3,
        top: value === 1 ? 2 : value === 2 ? 4 : value === 3 ? 2 : value === 4 ? 1 : value === 5 ? 6 : 1,
        bottom: value === 1 ? 5 : value === 2 ? 3 : value === 3 ? 5 : value === 4 ? 6 : value === 5 ? 1 : 4
    };

    return (
        <div className={`dice-3d-container ${isAnimating ? 'animating' : ''}`}>
            <div className="dice-3d-cube">
                <DiceFace3D value={faces.front} side="front" />
                <DiceFace3D value={faces.back} side="back" />
                <DiceFace3D value={faces.right} side="right" />
                <DiceFace3D value={faces.left} side="left" />
                <DiceFace3D value={faces.top} side="top" />
                <DiceFace3D value={faces.bottom} side="bottom" />
            </div>
        </div>
    );
}

export default function DiceAnimation3D({ diceValues, isRolling, onAnimationComplete }: DiceAnimationProps) {
    const [displayValues, setDisplayValues] = useState(diceValues);
    const [isAnimating, setIsAnimating] = useState(false);

    // Ref für die neuesten Werte
    const latestValuesRef = useRef(diceValues);

    // Ref immer aktuell halten
    useEffect(() => {
        latestValuesRef.current = diceValues;
    }, [diceValues]);

    // Animations-Logik
    useEffect(() => {
        if (isRolling) {
            setIsAnimating(true);
            soundManager.whooshSound();

            // Zufällige Werte während Animation
            const randomInterval = setInterval(() => {
                setDisplayValues(prev => prev.map(() => Math.floor(Math.random() * 6) + 1) as typeof diceValues);
            }, 80);

            // Animation stoppen und finale Werte setzen
            const stopAnimation = setTimeout(() => {
                clearInterval(randomInterval);
                setIsAnimating(false);
                setDisplayValues([...latestValuesRef.current]); // Finale Werte aus Ref
                soundManager.thudSound();
                onAnimationComplete?.();
            }, 1200); // 1.2 Sekunden Animation

            // Cleanup
            return () => {
                clearInterval(randomInterval);
                clearTimeout(stopAnimation);
            };
        } else {
            // Wenn nicht mehr rolling, Werte updaten und Animation stoppen
            setDisplayValues(diceValues);
            setIsAnimating(false);
        }
    }, [isRolling, diceValues, onAnimationComplete]);

    return (
        <div className="dice-animation-wrapper">
            <div className="dice-animation-container-3d">
                {displayValues.map((value, index) => (
                    <AnimatedDie3D
                        key={index}
                        value={value}
                        isAnimating={isAnimating}
                    />
                ))}
            </div>
        </div>
    );
}