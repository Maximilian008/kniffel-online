import { motion, AnimatePresence } from "motion/react";

interface StatusToastProps {
  message: string;
  isVisible: boolean;
}

export function StatusToast({ message, isVisible }: StatusToastProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-gradient-to-r from-orange-900/90 to-amber-900/90 backdrop-blur-sm rounded-lg border border-orange-500/30 shadow-lg"
        >
          <p className="text-amber-100 text-center">{message}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
