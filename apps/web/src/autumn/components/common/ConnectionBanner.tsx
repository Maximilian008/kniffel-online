import { AnimatePresence, motion } from "motion/react";

type ConnectionBannerProps = {
    isVisible: boolean;
};

/** Shown at the top while the connection to the game server is down. */
export function ConnectionBanner({ isVisible }: ConnectionBannerProps) {
    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    role="status"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        zIndex: 90,
                        padding: "0.6rem 1rem",
                        paddingTop: "calc(0.6rem + env(safe-area-inset-top, 0px))",
                        textAlign: "center",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: "#fff7ed",
                        background: "linear-gradient(90deg, rgba(124, 45, 18, 0.95), rgba(146, 64, 14, 0.95))",
                        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.25)",
                    }}
                >
                    Verbindung unterbrochen – wird wiederhergestellt …
                </motion.div>
            )}
        </AnimatePresence>
    );
}
