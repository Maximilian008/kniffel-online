import { motion } from "motion/react";

interface DieProps {
  value: number;
  held: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function Die({ value, held, onToggle, disabled }: DieProps) {
  const getPipPositions = (value: number) => {
    const positions: [number, number][] = [];
    
    switch (value) {
      case 1:
        positions.push([50, 50]);
        break;
      case 2:
        positions.push([25, 25], [75, 75]);
        break;
      case 3:
        positions.push([25, 25], [50, 50], [75, 75]);
        break;
      case 4:
        positions.push([25, 25], [75, 25], [25, 75], [75, 75]);
        break;
      case 5:
        positions.push([25, 25], [75, 25], [50, 50], [25, 75], [75, 75]);
        break;
      case 6:
        positions.push([25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]);
        break;
    }
    
    return positions;
  };

  return (
    <motion.button
      onClick={onToggle}
      disabled={disabled}
      className={`
        relative w-16 h-16 md:w-20 md:h-20 rounded-lg
        transition-all duration-300 cursor-pointer
        disabled:cursor-not-allowed disabled:opacity-50
        ${held 
          ? "bg-green-500 shadow-[0_0_20px_4px_rgba(74,222,128,0.6)] animate-pulse" 
          : "bg-white shadow-lg hover:shadow-xl"}
      `}
      whileHover={!disabled ? { scale: 1.05 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {getPipPositions(value).map((pos, idx) => (
          <circle
            key={idx}
            cx={pos[0]}
            cy={pos[1]}
            r="8"
            fill={held ? "white" : "black"}
          />
        ))}
      </svg>
    </motion.button>
  );
}
