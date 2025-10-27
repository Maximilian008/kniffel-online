import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import { Trophy, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface PlayerScore {
  [key: string]: number | null;
}

interface Player {
  name: string;
  scores: PlayerScore;
  total: number;
}

interface GameRecord {
  id: string;
  date: string;
  players: Player[];
  winner: string;
  winnerScore: number;
}

interface GameHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  history: GameRecord[];
}

export function GameHistory({ isOpen, onClose, history }: GameHistoryProps) {
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);

  const toggleExpanded = (gameId: string) => {
    setExpandedGameId(expandedGameId === gameId ? null : gameId);
  };

  const upperCategories = [
    { key: "ones", name: "Ones" },
    { key: "twos", name: "Twos" },
    { key: "threes", name: "Threes" },
    { key: "fours", name: "Fours" },
    { key: "fives", name: "Fives" },
    { key: "sixes", name: "Sixes" },
  ];

  const lowerCategories = [
    { key: "threeKind", name: "3 of a Kind" },
    { key: "fourKind", name: "4 of a Kind" },
    { key: "fullHouse", name: "Full House" },
    { key: "smallStraight", name: "Sm. Straight" },
    { key: "largeStraight", name: "Lg. Straight" },
    { key: "yahtzee", name: "Yahtzee" },
    { key: "chance", name: "Chance" },
  ];

  const calculateUpperSubtotal = (scores: PlayerScore) => {
    return upperCategories.reduce((sum, cat) => sum + (scores[cat.key] || 0), 0);
  };

  const calculateBonus = (scores: PlayerScore) => {
    const subtotal = calculateUpperSubtotal(scores);
    return subtotal >= 63 ? 35 : 0;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] bg-gradient-to-br from-[#e8dcc8] to-[#d4c5a9] border-2 border-orange-500/30 shadow-[0_0_30px_rgba(249,115,22,0.3)]">
        <DialogHeader>
          <DialogTitle className="text-orange-900 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-orange-600" />
            Game History
          </DialogTitle>
          <DialogDescription className="text-orange-900/70">
            View all your previously played games and their final scores
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[calc(85vh-120px)]">
          <div className="space-y-3 pr-4">
            {history.length === 0 ? (
              <div className="text-center py-12 text-orange-900/60">
                <p>No games played yet. Start playing to build your history!</p>
              </div>
            ) : (
              history.map((game) => (
                <div
                  key={game.id}
                  className="bg-white/40 rounded-lg border border-orange-800/20 overflow-hidden shadow-md"
                >
                  {/* Game summary - clickable header */}
                  <button
                    onClick={() => toggleExpanded(game.id)}
                    className="w-full p-4 hover:bg-white/60 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex items-center gap-2 text-orange-900/60">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm">{game.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-600" />
                        <span className="text-orange-900">
                          <span className="font-medium">{game.winner}</span> won with{" "}
                          <span className="font-medium text-orange-700">{game.winnerScore}</span> points
                        </span>
                      </div>
                      <div className="text-sm text-orange-900/60 ml-auto mr-4">
                        {game.players.length} players
                      </div>
                    </div>
                    {expandedGameId === game.id ? (
                      <ChevronUp className="w-5 h-5 text-orange-900" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-orange-900" />
                    )}
                  </button>

                  {/* Expanded scoreboard */}
                  <AnimatePresence>
                    {expandedGameId === game.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 pt-0 border-t border-orange-800/20">
                          <div className="bg-white/60 rounded-lg overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                              <thead>
                                <tr className="border-b-2 border-orange-600/40 bg-gradient-to-r from-[#c9a87c] to-[#b89968]">
                                  <th className="p-2 text-left text-orange-900 border-r border-orange-800/20">
                                    Category
                                  </th>
                                  {game.players.map((player, idx) => (
                                    <th
                                      key={idx}
                                      className="p-2 text-center text-orange-900 border-r border-orange-800/20 last:border-r-0"
                                    >
                                      {player.name}
                                      {player.name === game.winner && (
                                        <Trophy className="w-3 h-3 inline-block ml-1 text-amber-600" />
                                      )}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {/* Upper Section */}
                                <tr className="bg-orange-700/20">
                                  <td
                                    colSpan={game.players.length + 1}
                                    className="p-1.5 text-orange-800 uppercase tracking-wider text-xs"
                                  >
                                    Upper Section
                                  </td>
                                </tr>
                                {upperCategories.map((category) => (
                                  <tr
                                    key={category.key}
                                    className="border-b border-orange-800/10 hover:bg-orange-200/20"
                                  >
                                    <td className="p-2 text-orange-900 border-r border-orange-800/20">
                                      {category.name}
                                    </td>
                                    {game.players.map((player, idx) => (
                                      <td
                                        key={idx}
                                        className="p-2 text-center text-orange-900 border-r border-orange-800/20 last:border-r-0"
                                      >
                                        {player.scores[category.key] ?? "-"}
                                      </td>
                                    ))}
                                  </tr>
                                ))}

                                {/* Subtotal */}
                                <tr className="border-t-2 border-orange-700/30 bg-[#c9a87c]/40">
                                  <td className="p-2 text-orange-900 border-r border-orange-800/20">
                                    Subtotal
                                  </td>
                                  {game.players.map((player, idx) => (
                                    <td
                                      key={idx}
                                      className="p-2 text-center text-orange-900 border-r border-orange-800/20 last:border-r-0"
                                    >
                                      {calculateUpperSubtotal(player.scores)}
                                    </td>
                                  ))}
                                </tr>

                                {/* Bonus */}
                                <tr className="border-b-2 border-orange-700/40 bg-[#c9a87c]/40">
                                  <td className="p-2 text-orange-900 border-r border-orange-800/20">
                                    Bonus (63+)
                                  </td>
                                  {game.players.map((player, idx) => {
                                    const bonus = calculateBonus(player.scores);
                                    return (
                                      <td
                                        key={idx}
                                        className="p-2 text-center border-r border-orange-800/20 last:border-r-0"
                                      >
                                        <span className={bonus > 0 ? "text-green-700" : "text-orange-900/40"}>
                                          {bonus > 0 ? bonus : "-"}
                                        </span>
                                      </td>
                                    );
                                  })}
                                </tr>

                                {/* Lower Section */}
                                <tr className="bg-orange-700/20">
                                  <td
                                    colSpan={game.players.length + 1}
                                    className="p-1.5 text-orange-800 uppercase tracking-wider text-xs"
                                  >
                                    Lower Section
                                  </td>
                                </tr>
                                {lowerCategories.map((category) => (
                                  <tr
                                    key={category.key}
                                    className="border-b border-orange-800/10 hover:bg-orange-200/20"
                                  >
                                    <td className="p-2 text-orange-900 border-r border-orange-800/20">
                                      {category.name}
                                    </td>
                                    {game.players.map((player, idx) => (
                                      <td
                                        key={idx}
                                        className="p-2 text-center text-orange-900 border-r border-orange-800/20 last:border-r-0"
                                      >
                                        {player.scores[category.key] ?? "-"}
                                      </td>
                                    ))}
                                  </tr>
                                ))}

                                {/* Total */}
                                <tr className="border-t-2 border-orange-700/50 bg-gradient-to-r from-orange-700/30 to-amber-700/30">
                                  <td className="p-2 text-orange-900 border-r border-orange-800/20">
                                    Total Score
                                  </td>
                                  {game.players.map((player, idx) => (
                                    <td
                                      key={idx}
                                      className="p-2 text-center text-orange-900 border-r border-orange-800/20 last:border-r-0"
                                    >
                                      <span className={player.name === game.winner ? "text-orange-700" : ""}>
                                        {player.total}
                                      </span>
                                    </td>
                                  ))}
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
