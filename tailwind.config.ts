import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        "brand-blue": "#1B3F94",
        "brand-purple": "#7B1C7C",
        background: "#F7F7FA",
        surface: "#FFFFFF",
        ink: "#1A1D2B",
        muted: "#5F6478",
        border: "#E3E4EC",
        status: {
          working: "#15803D",
          break: "#B45309",
          declined: "#B42318",
          off: "#5F6478",
          leave: "#7B1C7C",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
