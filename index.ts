import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyView from "@fastify/view";
const { Liquid } = require("liquidjs");
import fastifyFormbody from "@fastify/formbody";
import fastifyJwt from "@fastify/jwt";
import { routesRoot } from "./routes/root";
import { routesUser } from "./routes/user";
import { join } from "node:path";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { existsSync, readFileSync } from "node:fs";
import { printInfo } from "./lib/utils";
import { client, db } from "./lib/db";
import { migrationHelper } from "./lib/migration";

declare module "@fastify/jwt" {
	interface FastifyJWT {
		user: {
			id: string;
			mastodonHandle: string;
			token: string;
			instance: string;
		};
	}
}

export const app = Fastify({
	logger: true,
});

client.connect();

migrationHelper()
	.then(() => {
		const { ADDRESS = "localhost", PORT = "3000" } = process.env;

		if (process.env.SENTRY_DSN) {
			Sentry.init({
				dsn: process.env.SENTRY_DSN,
				integrations: [nodeProfilingIntegration()],
				tracesSampleRate: 1.0,
				profilesSampleRate: 1.0,
			});
		}

		let version = "development";

		const gitRevPath = join(__dirname, ".git-rev");
		if (existsSync(gitRevPath)) {
			version = readFileSync(gitRevPath, "utf-8").trim();
		}

		app.register(fastifyCookie);
		app.register(fastifyFormbody);
		app.register(fastifyView, {
			engine: {
				liquid: new Liquid({
					root: join(__dirname, "views"),
					extname: ".liquid",
					globals: {
						version,
					},
				}),
			},
			root: join(__dirname, "views"),
			production: false,
			maxCache: 0,
			options: {
				noCache: true,
			},
		});

		app.register(require("@fastify/static"), {
			root: join(__dirname, "public"),
		});

		app.register(fastifyJwt, {
			secret: process.env.JWT_SECRET ?? "this_shoudl_not_be_used_in_production",
			cookie: {
				cookieName: "token",
				signed: false,
			},
		});

		app.register(routesRoot);
		app.register(routesUser);

		app.listen(
			{ host: ADDRESS, port: Number.parseInt(PORT, 10) },
			(err, address) => {
				if (err) {
					app.log.error(err);
				}
			},
		);

		printInfo();
	})
	.catch((err) => {
		console.error(err);
	});
