import React, { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";

interface GenieSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  originSelector?: string;
  children: ReactNode;
}

export function GenieSearchModal({
  isOpen,
  onClose,
  originSelector = ".lelam-search-toggle",
  children,
}: GenieSearchModalProps) {
  const [coords, setCoords] = useState<{
    deltaX: number;
    deltaY: number;
    originXPercent: number;
    originYPercent: number;
  }>({
    deltaX: 200,
    deltaY: -160,
    originXPercent: 88,
    originYPercent: 12,
  });

  // Check prefers-reduced-motion
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Measure button origin relative to modal center
  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;

    const measure = () => {
      const originEl = document.querySelector(originSelector);
      const originRect = originEl?.getBoundingClientRect();

      const btnCenterX = originRect
        ? originRect.left + originRect.width / 2
        : window.innerWidth - 180;
      const btnCenterY = originRect ? originRect.top + originRect.height / 2 : 36;

      const modalWidth = Math.min(512, window.innerWidth - 32);
      const modalCenterX = window.innerWidth / 2;
      const modalCenterY = Math.min(96, window.innerHeight * 0.12) + 260; // approximate center of modal

      const dX = btnCenterX - modalCenterX;
      const dY = btnCenterY - modalCenterY;

      // Transform origin percentages on the card pointing towards the search button
      const originXP = Math.max(10, Math.min(95, 50 + (dX / modalWidth) * 50));
      const originYP = Math.max(5, Math.min(95, 50 + (dY / 520) * 50));

      setCoords({
        deltaX: dX,
        deltaY: dY,
        originXPercent: originXP,
        originYPercent: originYP,
      });
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [isOpen, originSelector]);

  // Close on Escape key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const { deltaX, deltaY } = coords;
  // Lateral curved arc pointing sideways
  const arcX = deltaX > 0 ? 55 : -55;

  // Genie Animation Variants:
  // Non-uniform expansion: scaleY stretches faster than scaleX,
  // 3D perspective creates the classic narrow funnel/trumpet shape,
  // lateral arc curves towards the search button,
  // and finishes with an elastic settling bounce.
  const genieVariants: Variants = {
    closed: {
      x: deltaX,
      y: deltaY,
      scaleX: 0.05,
      scaleY: 0.03,
      rotateX: 28,
      rotateY: deltaX > 0 ? -24 : 24,
      skewX: deltaX > 0 ? -12 : 12,
      opacity: 0,
      transition: {
        duration: 0.36,
        ease: [0.32, 0, 0.67, 0] as const,
      },
    },
    open: {
      x: [deltaX, deltaX * 0.62 + arcX, deltaX * 0.24 + arcX * 0.45, 0],
      y: [deltaY, deltaY * 0.42, deltaY * 0.12, 0],
      scaleX: [0.05, 0.22, 0.68, 1.015, 1],
      scaleY: [0.03, 0.58, 0.92, 0.985, 1],
      rotateX: [28, 22, 8, 0],
      rotateY: [deltaX > 0 ? -24 : 24, deltaX > 0 ? -16 : 16, deltaX > 0 ? -5 : 5, 0],
      skewX: [deltaX > 0 ? -12 : 12, deltaX > 0 ? -8 : 8, deltaX > 0 ? -2 : 2, 0],
      opacity: [0, 0.8, 1, 1],
      transition: {
        duration: 0.44,
        times: [0, 0.32, 0.65, 0.88, 1],
        ease: ["easeOut", "easeInOut", "easeOut", "easeOut"],
      },
    },
  };

  const reducedMotionVariants: Variants = {
    closed: { opacity: 0, scale: 0.96 },
    open: { opacity: 1, scale: 1, transition: { duration: 0.18 } },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 overflow-hidden">
          {/* Warm Scrim Backdrop with backdrop blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#25170F]/60 backdrop-blur-md"
          />

          {/* Genie Window Card */}
          <motion.div
            initial="closed"
            animate="open"
            exit="closed"
            variants={prefersReducedMotion ? reducedMotionVariants : genieVariants}
            style={{
              transformOrigin: `${coords.originXPercent}% ${coords.originYPercent}%`,
              transformPerspective: 850,
            }}
            className="relative z-10 w-full max-w-lg will-change-transform"
          >
            {React.cloneElement(children as React.ReactElement<any>, {
              onClose,
            })}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default GenieSearchModal;
