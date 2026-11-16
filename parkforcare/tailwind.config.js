/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1c2b27",
        spruce: "#1e5c4a",
        deep: "#10241e",
        mist: "#e7efe9",
        paper: "#fbfaf6",
        line: "#d5e0d8",
        gold: "#8a6a2f",
        clay: "#8d2f2f",
        reserved: "#1d4e89",
        amber: "#8a5a12",
      },
      fontFamily: {
        sans: ["Outfit", "Segoe UI", "sans-serif"],
        serif: ["Fraunces", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
