import Pino from "pino";

const logger = Pino({
	transport: {
		target: "pino-pretty",
		options: {
			colorize: true,
		},
	},
});

export default logger;
