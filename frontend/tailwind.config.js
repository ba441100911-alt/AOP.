/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#edfdfd",
          100: "#cdf8fb",
          300: "#77e3ee",
          500: "#10b7d6",
          700: "#1f6fdc",
          900: "#071a66",
          950: "#4f2ce6",
        },
        surface: {
          base: "#060b11",
          soft: "#0b131d",
          muted: "#121c27",
          card: "#152131",
        },
      },
      borderRadius: {
        xl2: "1rem",
      },
      boxShadow: {
        panel: "0 16px 40px rgba(6, 11, 17, 0.35)",
        soft: "0 8px 24px rgba(6, 11, 17, 0.2)",
      },
    },
  },
  plugins: [],
};
