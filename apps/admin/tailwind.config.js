module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        cedi: {
          blue: "#0047AB",
          gold: "#f5b769",
          light: "#E6F0FF",
          dark: "#0b1d3a",
        },
      },
    },
  },
  plugins: [],
};
