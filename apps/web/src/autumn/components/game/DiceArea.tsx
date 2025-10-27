import { History, MoreVertical, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Button } from "../../ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { Die } from "../dice/Die";

type DiceAreaProps = {
    dice: number[];
    heldDice: boolean[];
    rollsLeft: number;
    canRoll: boolean;
    isCurrentPlayer: boolean;
    isRolling: boolean;
    onToggleHeld: (index: number) => void;
    onRoll: () => void;
    onShowHistory: () => void;
    onReset: () => void;
    soundEnabled: boolean;
    onToggleSound: () => void;
};

export function DiceArea({
    dice,
    heldDice,
    rollsLeft,
    canRoll,
    isCurrentPlayer,
    isRolling,
    onToggleHeld,
    onRoll,
    onShowHistory,
    onReset,
    soundEnabled,
    onToggleSound,
}: DiceAreaProps) {
    const disableHold = rollsLeft === 3 || !isCurrentPlayer;
    const rollDisabled = !isCurrentPlayer || isRolling || !canRoll || rollsLeft === 0;

    return (
        <div className="flex flex-col items-center gap-6 p-4">
            <div className="flex flex-col items-center gap-4">
                <div className="flex gap-4">
                    {dice.slice(0, 2).map((value, index) => (
                        <Die
                            key={index}
                            value={value}
                            held={Boolean(heldDice[index])}
                            onToggle={() => onToggleHeld(index)}
                            disabled={disableHold}
                        />
                    ))}
                </div>
                <div className="flex gap-4">
                    {dice.slice(2).map((value, index) => (
                        <Die
                            key={index + 2}
                            value={value}
                            held={Boolean(heldDice[index + 2])}
                            onToggle={() => onToggleHeld(index + 2)}
                            disabled={disableHold}
                        />
                    ))}
                </div>
            </div>

            <Button
                type="button"
                onClick={onRoll}
                disabled={rollDisabled}
                className="border-none bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-6 text-base shadow-[0_0_20px_rgba(249,115,22,0.5)] transition-all duration-300 hover:from-orange-600 hover:to-amber-600 hover:shadow-[0_0_30px_rgba(249,115,22,0.7)]"
            >
                🎲 Würfeln ({rollsLeft} übrig)
            </Button>

            <DropdownMenu>
                <DropdownMenuTrigger
                    data-slot="menu-trigger"
                    className="rounded-lg border p-2 transition-colors"
                >
                    <MoreVertical className="h-5 w-5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent data-slot="menu-content" className="border rounded-xl text-sm">
                    <DropdownMenuItem
                        data-slot="menu-item"
                        onClick={onShowHistory}
                        className="cursor-pointer gap-2 px-3 py-2"
                    >
                        <History className="h-4 w-4" /> Verlauf
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        data-slot="menu-item"
                        onClick={onReset}
                        className="cursor-pointer gap-2 px-3 py-2"
                    >
                        <RotateCcw className="h-4 w-4" /> Spiel zurücksetzen
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        data-slot="menu-item"
                        onClick={onToggleSound}
                        className="cursor-pointer gap-2 px-3 py-2"
                    >
                        {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                        {soundEnabled ? "Sound an" : "Sound aus"}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
