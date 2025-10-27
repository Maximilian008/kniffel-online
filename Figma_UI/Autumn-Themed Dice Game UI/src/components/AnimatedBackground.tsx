import { motion } from "motion/react";

export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <motion.div
        className="absolute inset-0"
        animate={{
          background: [
            "radial-gradient(ellipse at 20% 50%, #2d1b3d 0%, #c74e26 50%, #f5a962 100%)",
            "radial-gradient(ellipse at 80% 50%, #2d1b3d 0%, #c74e26 50%, #f5a962 100%)",
            "radial-gradient(ellipse at 50% 80%, #2d1b3d 0%, #c74e26 50%, #f5a962 100%)",
            "radial-gradient(ellipse at 50% 20%, #2d1b3d 0%, #c74e26 50%, #f5a962 100%)",
            "radial-gradient(ellipse at 20% 50%, #2d1b3d 0%, #c74e26 50%, #f5a962 100%)",
          ],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear",
        }}
      />
      
      {/* Subtle overlay texture */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.05)_0%,transparent_50%)] opacity-30" />
    </div>
  );
}
