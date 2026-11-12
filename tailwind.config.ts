import type { Config } from "tailwindcss";

// Palette: cool neutrals, one steel-blue brand colour, and muted semantic colours. No gradients.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  // Button variants are composed at runtime (`btn-${variant}`), so the scanner cannot see them.
  safelist: ["btn-primary", "btn-secondary", "btn-ghost", "btn-danger", "btn-danger-outline", "btn-sm", "btn-lg", "btn-icon"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#18212F", 2: "#3B4658", 3: "#5E6A7D", 4: "#8892A3" },
        line: { DEFAULT: "#E1E5EB", strong: "#CBD1DB" },
        canvas: "#F3F5F8",
        panel: "#FFFFFF",
        nav: { DEFAULT: "#101B2B", hover: "#182739", active: "#1F3350", line: "#24354D", text: "#AEB9CA" },
        brand: { 50: "#EEF4F9", 100: "#D9E6F1", 200: "#B3CDE3", 500: "#2B6E9E", 600: "#1F5C88", 700: "#194C72", 800: "#143C5B" },
        ok: { bg: "#E6F3EC", fg: "#1B6B45", line: "#BFDECC" },
        warn: { bg: "#FBF0DC", fg: "#8A5600", line: "#EFD6A3" },
        bad: { bg: "#FAE8E6", fg: "#A23228", line: "#EDC2BD" },
        info: { bg: "#E8F0F8", fg: "#1F5C88", line: "#C4D7E8" },
        mute: { bg: "#EDF0F4", fg: "#4B5668", line: "#D8DEE6" },
        teal: { bg: "#E3F3F2", fg: "#17706B", line: "#B9DDDA" },
      },
      fontFamily: {
        sans: ['"Inter"', '"Segoe UI"', "system-ui", "-apple-system", "Roboto", '"Helvetica Neue"', "Arial", "sans-serif"],
        mono: ['ui-monospace', '"SF Mono"', "Menlo", "Consolas", "monospace"],
      },
      fontSize: { xs: ["12px", "16px"], sm: ["13px", "18px"], base: ["14px", "20px"], lg: ["16px", "24px"], xl: ["18px", "26px"], "2xl": ["22px", "28px"] },
      borderRadius: { DEFAULT: "6px", md: "6px", lg: "8px" },
      boxShadow: { pop: "0 8px 24px rgba(16,27,43,.16), 0 1px 3px rgba(16,27,43,.10)", card: "0 1px 2px rgba(16,27,43,.04)" },
    },
  },
  plugins: [],
};
export default config;
