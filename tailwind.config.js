/** @type {import('tailwindcss').Config} */
import { dark } from "daisyui";

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
					// biome-ignore lint/complexity/useLiteralKeys: <explanation>
					...require("daisyui/src/theming/themes")["dark"],
					primary: "#6b21ff",
					secondary: "#1cd6ff",
				},
			},
		],
	},
	plugins: [require("@tailwindcss/typography"), require("daisyui")],
};
