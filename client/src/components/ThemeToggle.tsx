import { Moon, Sun } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useTheme } from "@/lib/theme";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={toggle}
      whileTap={reduce ? undefined : { scale: 0.92 }}
      transition={{ type: "spring", stiffness: 520, damping: 28 }}
      aria-label={theme === "dark" ? "Skift til lyst tema" : "Skift til mørkt tema"}
      className="flex size-9 items-center justify-center rounded-full border border-hairline bg-card-2 text-muted hover:text-ink transition-colors"
    >
      {theme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </motion.button>
  );
}
