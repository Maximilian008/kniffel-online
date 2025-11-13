import { motion } from "motion/react";

type DieProps = {
    value: number;
    held: boolean;
    onToggle: () => void;
    disabled?: boolean;
    isRolling?: boolean;
};

function getPipPositions(value: number): Array<[number, number]> {
    switch (value) {
        case 1:
            return [[50, 50]];
        case 2:
            return [[25, 25], [75, 75]];
        case 3:
            return [[25, 25], [50, 50], [75, 75]];
        case 4:
            return [[25, 25], [75, 25], [25, 75], [75, 75]];
        case 5:
            return [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]];
        case 6:
            return [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]];
        default:
            return [];
    }
}

export function Die({ value, held, onToggle, disabled, isRolling }: DieProps) {
    const pips = getPipPositions(value);
    const animateProps = isRolling
        ? { rotate: [0, -8, 8, -8, 0], scale: [1, 1.05, 1, 1.05, 1] }
        : { rotate: 0, scale: 1 };

    return (
        <motion.button
            type="button"
            onClick={onToggle}
            disabled={disabled}
            className={`relative h-16 w-16 rounded-lg transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50 md:h-20 md:w-20 ${held
                ? "bg-green-500 shadow-[0_0_20px_4px_rgba(74,222,128,0.6)]"
                : "bg-white shadow-lg hover:shadow-xl"
                }`}
            animate={animateProps}
            transition={isRolling ? { duration: 0.45, ease: "easeInOut" } : { duration: 0.2 }}
            whileHover={!disabled ? { scale: 1.05 } : undefined}
            whileTap={!disabled ? { scale: 0.95 } : undefined}
        >
            <svg viewBox="0 0 100 100" className="h-full w-full">
                {pips.map(([cx, cy], index) => (
                    <circle key={index} cx={cx} cy={cy} r="8" fill={held ? "white" : "black"} />
                ))}
            </svg>
        </motion.button>
    );
}
