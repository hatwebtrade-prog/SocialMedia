import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FBF8F1",
        surface: "#FFFFFF",
        ink: { DEFAULT: "#2B2A26", soft: "#6B6760" },
        sage: {
          50: "#F1F4ED", 100: "#E2EAD9", 200: "#C8D6B7", 300: "#A9BE90",
          400: "#88A36C", 500: "#6B8E5A", 600: "#577748", 700: "#4F6B43",
          800: "#3D5234", 900: "#2F3F29",
        },
        sand: {
          50: "#F7F3EA", 100: "#F0EADC", 200: "#E9E3D6", 300: "#D9D0BD",
          400: "#C2B69C", 500: "#A6987A",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-fraunces)", "Georgia", "serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(43,42,38,0.04), 0 4px 12px rgba(43,42,38,0.05)",
        lift: "0 2px 4px rgba(43,42,38,0.06), 0 8px 24px rgba(43,42,38,0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
