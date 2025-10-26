import { motion } from "motion/react";

type CurrentPlayerIndicatorProps = {
    playerName: string;
    rollsLeft: number;
};

export function CurrentPlayerIndicator({ playerName, rollsLeft }: CurrentPlayerIndicatorProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 text-center"
        >
            <motion.div
                animate={{
                    scale: [1, 1.05, 1],
                    textShadow: [
                        "0 0 10px rgba(251,146,60,0.5)",
                        "0 0 20px rgba(251,146,60,0.8)",
                        "0 0 10px rgba(251,146,60,0.5)",
                    ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="inline-block"
            >
                <h2 className="text-orange-300 drop-shadow-[0_2px_8px_rgba(251,146,60,0.8)]">
                    {playerName ? `${playerName}'s Turn` : "Waiting for players"}
                </h2>
            </motion.div>
            <p className="mt-1 text-amber-200/70">
                {rollsLeft === 3 ? "Roll to start" : `${rollsLeft} roll${rollsLeft !== 1 ? "s" : ""} remaining`}
            </p>
        </motion.div>
    );
}
