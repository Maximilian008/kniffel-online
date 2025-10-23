import { useState, useEffect } from "react";
import { TopBar } from "./components/TopBar";
import { DiceArea } from "./components/DiceArea";
import { Scoreboard, SCORE_CATEGORIES } from "./components/Scoreboard";
import { StatusToast } from "./components/StatusToast";
import { AnimatedBackground } from "./components/AnimatedBackground";
import { PlayerSetup } from "./components/PlayerSetup";
import { CurrentPlayerIndicator } from "./components/CurrentPlayerIndicator";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from "./components/ui/alert-dialog";

interface PlayerScore {
  [key: string]: number | null;
}

interface Player {
  name: string;
  scores: PlayerScore;
  total: number;
}

export default function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [playerCount, setPlayerCount] = useState(2);
  const [playerNames, setPlayerNames] = useState<string[]>(["Player 1", "Player 2"]);
  const [dice, setDice] = useState<number[]>([1, 2, 3, 4, 5]);
  const [heldDice, setHeldDice] = useState<boolean[]>([false, false, false, false, false]);
  const [rollsLeft, setRollsLeft] = useState(3);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);

  const handlePlayerCountChange = (count: number) => {
    setPlayerCount(count);
    const newNames = [...playerNames];
    while (newNames.length < count) {
      newNames.push(`Player ${newNames.length + 1}`);
    }
    setPlayerNames(newNames.slice(0, count));
  };

  const handlePlayerNameChange = (index: number, name: string) => {
    const newNames = [...playerNames];
    newNames[index] = name || `Player ${index + 1}`;
    setPlayerNames(newNames);
  };

  const startGame = () => {
    const initialScores: PlayerScore = {};
    SCORE_CATEGORIES.forEach(cat => {
      initialScores[cat.key] = null;
    });
    
    const newPlayers = playerNames.slice(0, playerCount).map((name, idx) => ({
      name: name || `Player ${idx + 1}`,
      scores: { ...initialScores },
      total: 0,
    }));
    
    setPlayers(newPlayers);
    setGameStarted(true);
    setCurrentPlayerIndex(0);
    setRollsLeft(3);
    setHeldDice([false, false, false, false, false]);
    setDice([1, 2, 3, 4, 5]);
  };

  const rollDice = () => {
    if (rollsLeft === 0) return;
    
    const newDice = dice.map((value, idx) => 
      heldDice[idx] ? value : Math.floor(Math.random() * 6) + 1
    );
    setDice(newDice);
    setRollsLeft(rollsLeft - 1);
    
    if (rollsLeft === 1) {
      showToastMessage("Last roll! Choose a category to score.");
    }
  };

  const toggleHeld = (index: number) => {
    if (rollsLeft === 3) return; // Can't hold before first roll
    const newHeld = [...heldDice];
    newHeld[index] = !newHeld[index];
    setHeldDice(newHeld);
  };

  const calculateScore = (category: string, diceValues: number[]): number => {
    const counts = [0, 0, 0, 0, 0, 0, 0]; // index 0 unused, 1-6 for dice values
    diceValues.forEach(val => counts[val]++);
    const sum = diceValues.reduce((a, b) => a + b, 0);

    switch (category) {
      case "ones":
        return counts[1] * 1;
      case "twos":
        return counts[2] * 2;
      case "threes":
        return counts[3] * 3;
      case "fours":
        return counts[4] * 4;
      case "fives":
        return counts[5] * 5;
      case "sixes":
        return counts[6] * 6;
      case "threeKind":
        return counts.some(c => c >= 3) ? sum : 0;
      case "fourKind":
        return counts.some(c => c >= 4) ? sum : 0;
      case "fullHouse":
        return counts.includes(3) && counts.includes(2) ? 25 : 0;
      case "smallStraight":
        const smallStraights = [
          [1, 2, 3, 4],
          [2, 3, 4, 5],
          [3, 4, 5, 6],
        ];
        return smallStraights.some(straight =>
          straight.every(num => counts[num] > 0)
        ) ? 30 : 0;
      case "largeStraight":
        const largeStraights = [
          [1, 2, 3, 4, 5],
          [2, 3, 4, 5, 6],
        ];
        return largeStraights.some(straight =>
          straight.every(num => counts[num] > 0)
        ) ? 40 : 0;
      case "yahtzee":
        return counts.some(c => c === 5) ? 50 : 0;
      case "chance":
        return sum;
      default:
        return 0;
    }
  };

  const getPreviewScores = (): { [key: string]: number } => {
    if (rollsLeft === 3 || players.length === 0) return {};
    
    const previews: { [key: string]: number } = {};
    SCORE_CATEGORIES.forEach(cat => {
      if (players[currentPlayerIndex]?.scores[cat.key] === null) {
        previews[cat.key] = calculateScore(cat.key, dice);
      }
    });
    return previews;
  };

  const handleCategoryClick = (category: string) => {
    if (rollsLeft === 3) return;
    if (players[currentPlayerIndex].scores[category] !== null) return;

    const score = calculateScore(category, dice);
    const newPlayers = [...players];
    newPlayers[currentPlayerIndex].scores[category] = score;
    setPlayers(newPlayers);

    const categoryName = SCORE_CATEGORIES.find(c => c.key === category)?.name;
    showToastMessage(`🎲 ${players[currentPlayerIndex].name} scored ${score} in ${categoryName}!`);

    // Move to next player
    const nextPlayer = (currentPlayerIndex + 1) % players.length;
    setCurrentPlayerIndex(nextPlayer);
    setRollsLeft(3);
    setHeldDice([false, false, false, false, false]);
    setDice([1, 2, 3, 4, 5]);
  };

  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const resetGame = () => {
    setGameStarted(false);
    setPlayers([]);
    setCurrentPlayerIndex(0);
    setRollsLeft(3);
    setHeldDice([false, false, false, false, false]);
    setDice([1, 2, 3, 4, 5]);
    showToastMessage("Game reset! 🍂");
  };

  const isGameComplete = () => {
    if (players.length === 0) return false;
    return players.every(player =>
      SCORE_CATEGORIES.every(cat => player.scores[cat.key] !== null)
    );
  };

  useEffect(() => {
    if (players.length > 0 && isGameComplete()) {
      const winner = players.reduce((prev, current) => 
        (current.total > prev.total) ? current : prev
      );
      showToastMessage(`🏆 ${winner.name} wins with ${winner.total} points!`);
    }
  }, [players]);

  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <AnimatedBackground />
      
      <div className="relative z-10 flex flex-col min-h-screen">
        <TopBar
          onHelp={() => setShowHelp(true)}
          onLogout={() => showToastMessage("Logged out! 👋")}
        />

        {!gameStarted ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <PlayerSetup
              playerCount={playerCount}
              playerNames={playerNames}
              onPlayerCountChange={handlePlayerCountChange}
              onPlayerNameChange={handlePlayerNameChange}
              onStart={startGame}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center gap-6 pb-8 px-4">
            <CurrentPlayerIndicator
              playerName={players[currentPlayerIndex]?.name || ""}
              rollsLeft={rollsLeft}
            />

            <DiceArea
              dice={dice}
              heldDice={heldDice}
              rollsLeft={rollsLeft}
              onToggleHeld={toggleHeld}
              onRoll={rollDice}
              onShowHistory={() => showToastMessage("History feature coming soon! 📜")}
              onReset={resetGame}
              soundEnabled={soundEnabled}
              onToggleSound={() => {
                setSoundEnabled(!soundEnabled);
                showToastMessage(soundEnabled ? "Sound off 🔇" : "Sound on 🔊");
              }}
              canRoll={rollsLeft > 0}
            />

            <Scoreboard
              players={players}
              currentPlayerIndex={currentPlayerIndex}
              onCategoryClick={handleCategoryClick}
              previewScores={getPreviewScores()}
              canScore={rollsLeft < 3}
            />
          </div>
        )}

        <StatusToast message={toastMessage} isVisible={showToast} />

        <AlertDialog open={showHelp} onOpenChange={setShowHelp}>
          <AlertDialogContent className="bg-[#3d2549] border border-orange-500/30 text-amber-100">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-orange-300">How to Play 🎲</AlertDialogTitle>
              <AlertDialogDescription className="text-amber-100/90 space-y-2">
                <p><strong>Goal:</strong> Score the most points by rolling dice combinations.</p>
                <p><strong>Gameplay:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Roll the dice up to 3 times per turn</li>
                  <li>After rolling, tap dice to hold them</li>
                  <li>Choose a scoring category after your rolls</li>
                  <li>Each category can only be used once</li>
                </ul>
                <p className="mt-4"><strong>Special combinations:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Full House: 3 of one number + 2 of another (25 pts)</li>
                  <li>Small Straight: 4 in a row (30 pts)</li>
                  <li>Large Straight: 5 in a row (40 pts)</li>
                  <li>Yahtzee: All 5 dice the same (50 pts)</li>
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction className="bg-orange-500 hover:bg-orange-600">
                Got it!
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
