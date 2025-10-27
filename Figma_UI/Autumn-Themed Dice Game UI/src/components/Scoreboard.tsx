import { motion } from "motion/react";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { Button } from "./ui/button";

export interface ScoreCategory {
  name: string;
  key: string;
  description: string;
  section: "upper" | "lower";
}

export const SCORE_CATEGORIES: ScoreCategory[] = [
  { name: "Ones", key: "ones", description: "Sum of all 1s", section: "upper" },
  { name: "Twos", key: "twos", description: "Sum of all 2s", section: "upper" },
  { name: "Threes", key: "threes", description: "Sum of all 3s", section: "upper" },
  { name: "Fours", key: "fours", description: "Sum of all 4s", section: "upper" },
  { name: "Fives", key: "fives", description: "Sum of all 5s", section: "upper" },
  { name: "Sixes", key: "sixes", description: "Sum of all 6s", section: "upper" },
  { name: "3 of a Kind", key: "threeKind", description: "Sum of all dice", section: "lower" },
  { name: "4 of a Kind", key: "fourKind", description: "Sum of all dice", section: "lower" },
  { name: "Full House", key: "fullHouse", description: "25 points", section: "lower" },
  { name: "Sm. Straight", key: "smallStraight", description: "30 points", section: "lower" },
  { name: "Lg. Straight", key: "largeStraight", description: "40 points", section: "lower" },
  { name: "Yahtzee", key: "yahtzee", description: "50 points", section: "lower" },
  { name: "Chance", key: "chance", description: "Sum of all dice", section: "lower" },
];

interface PlayerScore {
  [key: string]: number | null;
}

interface Player {
  name: string;
  scores: PlayerScore;
  total: number;
}

interface ScoreboardProps {
  players: Player[];
  currentPlayerIndex: number;
  onCategoryClick: (category: string) => void;
  previewScores: { [key: string]: number };
  canScore: boolean;
}

export function Scoreboard({
  players,
  currentPlayerIndex,
  onCategoryClick,
  previewScores,
  canScore,
}: ScoreboardProps) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [viewStartIndex, setViewStartIndex] = useState(0);

  const upperCategories = SCORE_CATEGORIES.filter(c => c.section === "upper");
  const lowerCategories = SCORE_CATEGORIES.filter(c => c.section === "lower");

  // For mobile: show max 2 players at a time
  const maxVisiblePlayers = 2;
  const visiblePlayers = players.slice(viewStartIndex, viewStartIndex + maxVisiblePlayers);
  const canNavigateLeft = viewStartIndex > 0;
  const canNavigateRight = viewStartIndex + maxVisiblePlayers < players.length;

  const handleNavigateLeft = () => {
    setViewStartIndex(Math.max(0, viewStartIndex - 1));
  };

  const handleNavigateRight = () => {
    setViewStartIndex(Math.min(players.length - maxVisiblePlayers, viewStartIndex + 1));
  };

  // Auto-scroll to current player on mobile when turn changes
  useEffect(() => {
    if (players.length > 2) {
      // Make sure current player is visible
      if (currentPlayerIndex < viewStartIndex) {
        setViewStartIndex(currentPlayerIndex);
      } else if (currentPlayerIndex >= viewStartIndex + maxVisiblePlayers) {
        setViewStartIndex(Math.max(0, currentPlayerIndex - maxVisiblePlayers + 1));
      }
    }
  }, [currentPlayerIndex, players.length]);

  const calculateUpperSubtotal = (scores: PlayerScore) => {
    return upperCategories.reduce((sum, cat) => sum + (scores[cat.key] || 0), 0);
  };

  const calculateBonus = (scores: PlayerScore) => {
    const subtotal = calculateUpperSubtotal(scores);
    return subtotal >= 63 ? 35 : 0;
  };

  const calculateTotal = (scores: PlayerScore) => {
    return Object.values(scores).reduce((sum, score) => sum + (score || 0), 0) + calculateBonus(scores);
  };

  const renderPlayerCellContent = (player: Player, actualPlayerIndex: number, category: ScoreCategory) => {
    const score = player.scores[category.key];
    const preview = actualPlayerIndex === currentPlayerIndex ? previewScores[category.key] : undefined;
    const isClickable = canScore && actualPlayerIndex === currentPlayerIndex && score === null;
    const cellKey = `${actualPlayerIndex}-${category.key}`;

    return {
      content: (
        <>
          {score !== null ? (
            <span className="text-orange-900">{score}</span>
          ) : preview !== undefined && isClickable ? (
            <span className="text-orange-600 hover:text-orange-700 transition-colors">
              {preview}
            </span>
          ) : (
            <span className="text-orange-900/30">-</span>
          )}
          {hoveredCell === cellKey && (
            <div className="absolute inset-0 border-2 border-orange-600 rounded pointer-events-none" />
          )}
        </>
      ),
      className: `p-3 text-center border-r border-orange-800/20 last:border-r-0 relative ${
        isClickable ? "cursor-pointer hover:bg-orange-200/30" : ""
      } ${
        actualPlayerIndex === currentPlayerIndex
          ? "bg-orange-500/10"
          : ""
      }`,
      onClick: () => isClickable && onCategoryClick(category.key),
      onMouseEnter: () => isClickable && setHoveredCell(cellKey),
      onMouseLeave: () => setHoveredCell(null),
    };
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      {/* Navigation buttons for mobile (when more than 2 players) */}
      {players.length > 2 && (
        <div className="flex justify-between items-center mb-3 md:hidden gap-3">
          <Button
            onClick={handleNavigateLeft}
            disabled={!canNavigateLeft}
            size="sm"
            variant="outline"
            className="bg-gradient-to-r from-orange-900/40 to-amber-900/40 border-orange-400/40 text-amber-100 hover:from-orange-800/50 hover:to-amber-800/50 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-orange-500/20 via-amber-500/20 to-orange-500/20 rounded-full border border-orange-400/30 shadow-lg backdrop-blur-sm">
            <Users className="w-4 h-4 text-orange-300" />
            <span className="text-amber-100 tracking-wide">
              {viewStartIndex + 1}-{Math.min(viewStartIndex + maxVisiblePlayers, players.length)}
            </span>
            <span className="text-orange-300/60 text-xs">of</span>
            <span className="text-orange-300">{players.length}</span>
          </div>
          <Button
            onClick={handleNavigateRight}
            disabled={!canNavigateRight}
            size="sm"
            variant="outline"
            className="bg-gradient-to-r from-orange-900/40 to-amber-900/40 border-orange-400/40 text-amber-100 hover:from-orange-800/50 hover:to-amber-800/50 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      <div className="bg-gradient-to-br from-[#e8dcc8] to-[#d4c5a9] backdrop-blur-sm rounded-xl border-2 border-orange-500/30 shadow-[0_0_30px_rgba(249,115,22,0.3)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-orange-600/40 bg-gradient-to-r from-[#c9a87c] to-[#b89968]">
                <th className="p-3 text-left text-orange-900 border-r border-orange-800/20">Category</th>
                {/* Mobile: show only visible players */}
                {visiblePlayers.map((player, idx) => {
                  const actualPlayerIndex = viewStartIndex + idx;
                  return (
                    <th
                      key={`mobile-${actualPlayerIndex}`}
                      className={`md:hidden p-3 text-center transition-all duration-300 border-r border-orange-800/20 last:border-r-0 ${
                        actualPlayerIndex === currentPlayerIndex
                          ? "text-orange-600 bg-orange-500/15"
                          : "text-orange-900"
                      }`}
                    >
                      {actualPlayerIndex === currentPlayerIndex && (
                        <motion.span
                          animate={{ opacity: [1, 0.5, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="inline-block mr-1"
                        >
                          ▸
                        </motion.span>
                      )}
                      {player.name}
                    </th>
                  );
                })}
                {/* Desktop: show all players */}
                {players.map((player, actualPlayerIndex) => (
                  <th
                    key={`desktop-${actualPlayerIndex}`}
                    className={`hidden md:table-cell p-3 text-center transition-all duration-300 border-r border-orange-800/20 last:border-r-0 ${
                      actualPlayerIndex === currentPlayerIndex
                        ? "text-orange-600 bg-orange-500/15"
                        : "text-orange-900"
                    }`}
                  >
                    {actualPlayerIndex === currentPlayerIndex && (
                      <motion.span
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="inline-block mr-1"
                      >
                        ▸
                      </motion.span>
                    )}
                    {player.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* UPPER SECTION */}
              <tr className="bg-orange-700/20">
                <td colSpan={100} className="p-2 text-orange-800 uppercase tracking-wider">
                  Upper Section
                </td>
              </tr>
              {upperCategories.map((category) => (
                <tr
                  key={category.key}
                  className="border-b border-orange-800/10 hover:bg-orange-200/20 transition-colors"
                >
                  <td className="p-3 text-orange-900 border-r border-orange-800/20">{category.name}</td>
                  {/* Mobile: show only visible players */}
                  {visiblePlayers.map((player, idx) => {
                    const actualPlayerIndex = viewStartIndex + idx;
                    const cellData = renderPlayerCellContent(player, actualPlayerIndex, category);
                    return (
                      <td 
                        key={`mobile-${actualPlayerIndex}`} 
                        className={`md:hidden ${cellData.className}`}
                        onClick={cellData.onClick}
                        onMouseEnter={cellData.onMouseEnter}
                        onMouseLeave={cellData.onMouseLeave}
                      >
                        {cellData.content}
                      </td>
                    );
                  })}
                  {/* Desktop: show all players */}
                  {players.map((player, actualPlayerIndex) => {
                    const cellData = renderPlayerCellContent(player, actualPlayerIndex, category);
                    return (
                      <td 
                        key={`desktop-${actualPlayerIndex}`} 
                        className={`hidden md:table-cell ${cellData.className}`}
                        onClick={cellData.onClick}
                        onMouseEnter={cellData.onMouseEnter}
                        onMouseLeave={cellData.onMouseLeave}
                      >
                        {cellData.content}
                      </td>
                    );
                  })}
                </tr>
              ))}
              
              {/* SUBTOTAL */}
              <tr className="border-t-2 border-orange-700/30 bg-[#c9a87c]/40">
                <td className="p-3 text-orange-900 border-r border-orange-800/20">Subtotal</td>
                {/* Mobile */}
                {visiblePlayers.map((player, idx) => {
                  const actualPlayerIndex = viewStartIndex + idx;
                  return (
                    <td key={`mobile-${actualPlayerIndex}`} className="md:hidden p-3 text-center text-orange-900 border-r border-orange-800/20 last:border-r-0">
                      {calculateUpperSubtotal(player.scores)}
                    </td>
                  );
                })}
                {/* Desktop */}
                {players.map((player, actualPlayerIndex) => (
                  <td key={`desktop-${actualPlayerIndex}`} className="hidden md:table-cell p-3 text-center text-orange-900 border-r border-orange-800/20 last:border-r-0">
                    {calculateUpperSubtotal(player.scores)}
                  </td>
                ))}
              </tr>
              
              {/* BONUS */}
              <tr className="border-b-2 border-orange-700/40 bg-[#c9a87c]/40">
                <td className="p-3 text-orange-900 border-r border-orange-800/20">Bonus (63+)</td>
                {/* Mobile */}
                {visiblePlayers.map((player, idx) => {
                  const actualPlayerIndex = viewStartIndex + idx;
                  const bonus = calculateBonus(player.scores);
                  const subtotal = calculateUpperSubtotal(player.scores);
                  return (
                    <td key={`mobile-${actualPlayerIndex}`} className="md:hidden p-3 text-center border-r border-orange-800/20 last:border-r-0">
                      <span className={bonus > 0 ? "text-green-700" : "text-orange-900/40"}>
                        {bonus > 0 ? bonus : `-`}
                      </span>
                      {subtotal > 0 && subtotal < 63 && (
                        <div className="text-[0.65rem] text-amber-600 mt-0.5 tracking-tight">
                          {63 - subtotal} to go
                        </div>
                      )}
                    </td>
                  );
                })}
                {/* Desktop */}
                {players.map((player, actualPlayerIndex) => {
                  const bonus = calculateBonus(player.scores);
                  const subtotal = calculateUpperSubtotal(player.scores);
                  return (
                    <td key={`desktop-${actualPlayerIndex}`} className="hidden md:table-cell p-3 text-center border-r border-orange-800/20 last:border-r-0">
                      <span className={bonus > 0 ? "text-green-700" : "text-orange-900/40"}>
                        {bonus > 0 ? bonus : `-`}
                      </span>
                      {subtotal > 0 && subtotal < 63 && (
                        <div className="text-[0.65rem] text-amber-600 mt-0.5 tracking-tight">
                          {63 - subtotal} to go
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* LOWER SECTION */}
              <tr className="bg-orange-700/20">
                <td colSpan={100} className="p-2 text-orange-800 uppercase tracking-wider">
                  Lower Section
                </td>
              </tr>
              {lowerCategories.map((category) => (
                <tr
                  key={category.key}
                  className="border-b border-orange-800/10 hover:bg-orange-200/20 transition-colors"
                >
                  <td className="p-3 text-orange-900 border-r border-orange-800/20">{category.name}</td>
                  {/* Mobile */}
                  {visiblePlayers.map((player, idx) => {
                    const actualPlayerIndex = viewStartIndex + idx;
                    const cellData = renderPlayerCellContent(player, actualPlayerIndex, category);
                    return (
                      <td 
                        key={`mobile-${actualPlayerIndex}`} 
                        className={`md:hidden ${cellData.className}`}
                        onClick={cellData.onClick}
                        onMouseEnter={cellData.onMouseEnter}
                        onMouseLeave={cellData.onMouseLeave}
                      >
                        {cellData.content}
                      </td>
                    );
                  })}
                  {/* Desktop */}
                  {players.map((player, actualPlayerIndex) => {
                    const cellData = renderPlayerCellContent(player, actualPlayerIndex, category);
                    return (
                      <td 
                        key={`desktop-${actualPlayerIndex}`} 
                        className={`hidden md:table-cell ${cellData.className}`}
                        onClick={cellData.onClick}
                        onMouseEnter={cellData.onMouseEnter}
                        onMouseLeave={cellData.onMouseLeave}
                      >
                        {cellData.content}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* TOTAL */}
              <tr className="border-t-2 border-orange-700/50 bg-gradient-to-r from-orange-700/30 to-amber-700/30">
                <td className="p-3 text-orange-900 border-r border-orange-800/20">Total Score</td>
                {/* Mobile */}
                {visiblePlayers.map((player, idx) => {
                  const actualPlayerIndex = viewStartIndex + idx;
                  return (
                    <td key={`mobile-${actualPlayerIndex}`} className="md:hidden p-3 text-center text-orange-900 border-r border-orange-800/20 last:border-r-0">
                      {calculateTotal(player.scores)}
                    </td>
                  );
                })}
                {/* Desktop */}
                {players.map((player, actualPlayerIndex) => (
                  <td key={`desktop-${actualPlayerIndex}`} className="hidden md:table-cell p-3 text-center text-orange-900 border-r border-orange-800/20 last:border-r-0">
                    {calculateTotal(player.scores)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
