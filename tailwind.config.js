/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./views/**/*.liquid"],
	theme: {
		extend: {},
		container: {
			center: true,
		},
	},
	daisyui: {
		themes: [
			{
				black: {
					...require("daisyui/src/theming/themes")["dark"],
					primary: "#6b21ff",
					secondary: "#1cd6ff",
				},
			},
		],
	},
	plugins: [require("@tailwindcss/typography"), require("daisyui")],
};
