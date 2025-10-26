import { AnimatePresence, motion } from "motion/react";

type StatusToastProps = {
    message: string | null;
    isVisible: boolean;
};

export function StatusToast({ message, isVisible }: StatusToastProps) {
    return (
        <AnimatePresence>
            {isVisible && message && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="fixed bottom-6 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 px-6 py-3 rounded-lg border border-orange-500/30 bg-gradient-to-r from-orange-900/90 to-amber-900/90 text-center text-amber-100 shadow-lg backdrop-blur-sm"
                >
                    {message}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
