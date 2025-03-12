/** @type {import('tailwindcss').Config} */

module.exports = {
	content: ["./views/**/*.liquid"],
	theme: {
		extend: {},
		container: {
			center: true,
		},
	},
	plugins: [require("@tailwindcss/typography")],
};
