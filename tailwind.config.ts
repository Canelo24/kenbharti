import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          saffron: "#FF9933",
          green: "#138808",
          // Poster-matched deep cocoa replaces the old navy everywhere
          navy: "#241207",
          gold: "#e8b923",
          champagne: "#f7d778",
          cream: "#f8eeda",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
