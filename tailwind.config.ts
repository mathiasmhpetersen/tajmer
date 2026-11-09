import type { Config } from "tailwindcss";

// All colours are driven by CSS variables (see client/src/index.css) so the
// theme toggle only has to flip a `.light` class on <html>. Dark is default.
export default {
  content: ["./client/index.html", "./client/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        page: "rgb(var(--page) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        "card-2": "rgb(var(--card-2) / <alpha-value>)",
        hairline: "var(--hairline)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        faint: "rgb(var(--faint) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-ink": "rgb(var(--accent-ink) / <alpha-value>)",
        success: "rgb(var(--success) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "Inter Variable",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
      },
      borderRadius: {
        card: "16px",
        tile: "14px",
      },
      maxWidth: {
        content: "1500px",
      },
      letterSpacing: {
        tightest: "-0.03em",
      },
      fontFeatureSettings: {
        nums: '"tnum" 1, "cv01" 1',
      },
    },
  },
  plugins: [],
} satisfies Config;
