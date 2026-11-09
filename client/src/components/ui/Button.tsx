import { forwardRef } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "ref" | "children"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children?: React.ReactNode;
}

const variants: Record<Variant, string> = {
  // One accent colour (orange) for the single primary action per surface.
  primary:
    "bg-accent text-accent-ink font-semibold hover:brightness-105 border border-transparent",
  secondary:
    "bg-card-2 text-ink border border-hairline hover:bg-card",
  ghost: "bg-transparent text-muted hover:text-ink hover:bg-card-2 border border-transparent",
  danger: "bg-transparent text-[rgb(240,120,110)] border border-hairline hover:bg-card-2",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-5 text-base gap-2 rounded-xl",
};

/**
 * Arc UI–style button. Press scales to ~0.97 on a snappy spring; hover styles
 * apply only on fine pointers (handled via CSS `@media (hover)` through Tailwind's
 * default hover which already gates on hover-capable devices in modern browsers);
 * reduced motion drops the press scale. Loading uses aria-busy, not `disabled`,
 * so focus is preserved.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, className, children, disabled, ...props },
  ref,
) {
  const reduce = useReducedMotion();
  const inert = loading || disabled;

  return (
    <motion.button
      ref={ref}
      whileTap={reduce || inert ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 520, damping: 30, mass: 0.6 }}
      aria-busy={loading || undefined}
      aria-disabled={inert || undefined}
      disabled={disabled}
      className={cn(
        "relative inline-flex select-none items-center justify-center whitespace-nowrap",
        "font-medium tracking-tight transition-colors duration-150",
        "outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-0",
        "disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </motion.button>
  );
});
