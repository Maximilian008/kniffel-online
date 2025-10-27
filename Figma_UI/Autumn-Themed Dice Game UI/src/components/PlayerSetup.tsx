import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Plus, Minus } from "lucide-react";

interface PlayerSetupProps {
  playerCount: number;
  playerNames: string[];
  onPlayerCountChange: (count: number) => void;
  onPlayerNameChange: (index: number, name: string) => void;
  onStart: () => void;
}

export function PlayerSetup({
  playerCount,
  playerNames,
  onPlayerCountChange,
  onPlayerNameChange,
  onStart,
}: PlayerSetupProps) {
  return (
    <div className="w-full max-w-md mx-auto p-6 bg-gradient-to-br from-[#e8dcc8] to-[#d4c5a9] backdrop-blur-sm rounded-xl border-2 border-orange-500/30 shadow-[0_0_30px_rgba(249,115,22,0.3)]">
      <h2 className="text-center text-orange-900 mb-6">Setup Game</h2>
      
      <div className="mb-6">
        <label className="text-orange-900 mb-2 block">Number of Players</label>
        <div className="flex items-center gap-4">
          <Button
            onClick={() => onPlayerCountChange(Math.max(2, playerCount - 1))}
            disabled={playerCount <= 2}
            className="bg-orange-500 hover:bg-orange-600 text-white"
            size="icon"
          >
            <Minus className="w-4 h-4" />
          </Button>
          <span className="text-orange-900 min-w-[3rem] text-center">{playerCount}</span>
          <Button
            onClick={() => onPlayerCountChange(Math.min(6, playerCount + 1))}
            disabled={playerCount >= 6}
            className="bg-orange-500 hover:bg-orange-600 text-white"
            size="icon"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        {Array.from({ length: playerCount }).map((_, idx) => (
          <div key={idx}>
            <label className="text-orange-900 text-sm mb-1 block">Player {idx + 1}</label>
            <Input
              value={playerNames[idx] || ""}
              onChange={(e) => onPlayerNameChange(idx, e.target.value)}
              placeholder={`Player ${idx + 1}`}
              className="bg-white/40 border-orange-800/30 text-orange-900 placeholder:text-orange-900/50 focus:bg-white/60"
            />
          </div>
        ))}
      </div>

      <Button
        onClick={onStart}
        className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-[0_0_20px_rgba(249,115,22,0.5)]"
      >
        Start Game 🎲
      </Button>
    </div>
  );
}
