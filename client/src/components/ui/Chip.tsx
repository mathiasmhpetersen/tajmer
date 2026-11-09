import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

export interface ChipProps {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * Pill-shaped filter chip in the newarc.io "Udvalgte projekter" style — used for
 * the artist switcher and the range toggle. Rounded-full, muted when idle,
 * solid-ink fill when active.
 */
export function Chip({ active = false, onClick, children, className }: ChipProps) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 520, damping: 30, mass: 0.6 }}
      aria-pressed={active}
      className={cn(
        "inline-flex h-9 items-center whitespace-nowrap rounded-full px-4 text-sm font-medium",
        "border transition-colors duration-150 outline-none",
        "focus-visible:ring-2 focus-visible:ring-accent/50",
        active
          ? "border-transparent bg-ink text-page"
          : "border-hairline bg-card-2 text-muted hover:text-ink hover:bg-card",
        className,
      )}
    >
      {children}
    </motion.button>
  );
}
