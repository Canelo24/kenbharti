import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          saffron: "#FF9933",
          green: "#138808",
          navy: "#0b1026",
          gold: "#e8b923",
        },
      },
    },
  },
  plugins: [],
};
export default config;
