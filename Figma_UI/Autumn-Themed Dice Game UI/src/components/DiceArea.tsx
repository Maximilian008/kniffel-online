import { Die } from "./Die";
import { Button } from "./ui/button";
import { MoreVertical, History, RotateCcw, Volume2, VolumeX } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface DiceAreaProps {
  dice: number[];
  heldDice: boolean[];
  rollsLeft: number;
  onToggleHeld: (index: number) => void;
  onRoll: () => void;
  onShowHistory: () => void;
  onReset: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  canRoll: boolean;
}

export function DiceArea({
  dice,
  heldDice,
  rollsLeft,
  onToggleHeld,
  onRoll,
  onShowHistory,
  onReset,
  soundEnabled,
  onToggleSound,
  canRoll,
}: DiceAreaProps) {
  return (
    <div className="flex flex-col items-center gap-6 p-4">
      {/* Dice grid */}
      <div className="flex flex-col gap-4 items-center">
        {/* Top row - 2 dice */}
        <div className="flex gap-4">
          {dice.slice(0, 2).map((value, idx) => (
            <Die
              key={idx}
              value={value}
              held={heldDice[idx]}
              onToggle={() => onToggleHeld(idx)}
              disabled={rollsLeft === 3}
            />
          ))}
        </div>
        
        {/* Bottom row - 3 dice */}
        <div className="flex gap-4">
          {dice.slice(2, 5).map((value, idx) => (
            <Die
              key={idx + 2}
              value={value}
              held={heldDice[idx + 2]}
              onToggle={() => onToggleHeld(idx + 2)}
              disabled={rollsLeft === 3}
            />
          ))}
        </div>
      </div>

      {/* Roll button */}
      <Button
        onClick={onRoll}
        disabled={!canRoll || rollsLeft === 0}
        className="px-8 py-6 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-[0_0_20px_rgba(249,115,22,0.5)] hover:shadow-[0_0_30px_rgba(249,115,22,0.7)] transition-all duration-300 border-none"
      >
        🎲 Roll ({rollsLeft} left)
      </Button>

      {/* Options menu */}
      <DropdownMenu>
        <DropdownMenuTrigger className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors border border-white/20">
          <MoreVertical className="w-5 h-5 text-amber-200" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-[#3d2549] border border-white/20 text-amber-100">
          <DropdownMenuItem onClick={onShowHistory} className="cursor-pointer hover:bg-white/10">
            <History className="w-4 h-4 mr-2" />
            History
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onReset} className="cursor-pointer hover:bg-white/10">
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset Game
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onToggleSound} className="cursor-pointer hover:bg-white/10">
            {soundEnabled ? <Volume2 className="w-4 h-4 mr-2" /> : <VolumeX className="w-4 h-4 mr-2" />}
            Sound {soundEnabled ? "On" : "Off"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
