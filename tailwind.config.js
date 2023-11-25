/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./views/**/*.liquid",
  ],
  theme: {
    extend: {},
    container: {
      center: true,
    }
  },
  daisyui: {
    themes: ["black"],
  },
  plugins: [require("@tailwindcss/typography"), require("daisyui")],
}

