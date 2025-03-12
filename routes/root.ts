import {
	validateBlueskyAppPassword,
	validateBlueskyCredentials,
	validateBlueskyHandle,
} from "./../lib/bluesky";
import { authenticateJWT, checkValidHttpsUrl } from "./../lib/utils";
import {
	findUserById,
	persistBlueskyCreds,
	updateRelaySettings,
} from "./../lib/db";
import type { FastifyInstance } from "fastify";
import type { InferInsertModel } from "drizzle-orm";
import type { user as User } from "./../drizzle/schema";

export const routesRoot = async (app: FastifyInstance) => {
	app.get("/", { onRequest: [authenticateJWT] }, async (req, res) => {
		const user = await findUserById(req.user.id);

		let hasBlueskyToken = false;
		if (user?.blueskyToken) hasBlueskyToken = true;

		return res.view("index", {
			userName: req.user.mastodonHandle,
			instance: req.user.instance,
			blueskyHandle: user?.blueskyHandle,
			blueskyPDS: user?.blueskyPDS,
			hasBlueskyToken: hasBlueskyToken,
			pollingInterval: Number.parseInt(process.env.POLL_INTERVAL ?? "60"),
			relayCriteria: user?.relayCriteria,
			relayMarker: user?.relayMarker,
			relayVisibility: user?.relayVisibility,
			relayUnlistedAnswers: user?.relayUnlistedAnswers,
		});
	});

	app.post<{
		Body: {
			blueskyHandle: string;
			blueskyToken: string;
			blueskyPDS: string;
		};
	}>(
		"/settings/blueskyCreds",
		{ onRequest: [authenticateJWT] },
		async (req, res) => {
			const user = await findUserById(req.user.id, true);

			const response_data = {
				err: undefined,
				blueskyPDS: req.body.blueskyPDS,
				userName: req.user.mastodonHandle,
				instance: req.user.instance,
				relayCriteria: user?.relayCriteria,
				relayMarker: user?.relayMarker,
				pollingInterval: Number.parseInt(process.env.POLL_INTERVAL ?? "60"),
			};

			if (!validateBlueskyAppPassword(req.body.blueskyToken))
				return res.status(400).view("index", {
					...response_data,
					err: "Invalid Bluesky App Password",
				});

			if (!validateBlueskyHandle(req.body.blueskyHandle))
				return res.status(400).view("index", {
					...response_data,
					err: "Invalid Bluesky Handle",
				});

			if (!checkValidHttpsUrl(req.body.blueskyPDS))
				return res.status(400).view("index", {
					...response_data,
					err: "Invalid Bluesky PDS",
				});

			if (
				!(await validateBlueskyCredentials(
					req.body.blueskyPDS,
					req.body.blueskyHandle,
					req.body.blueskyToken,
				))
			)
				return res.status(400).view("index", {
					...response_data,
					err: "Invalid Bluesky Credentials, could not authenticate",
				});

			await persistBlueskyCreds(
				req.user.id,
				req.body.blueskyHandle,
				req.body.blueskyToken,
				req.body.blueskyPDS,
			);

			return res.redirect("/");
		},
	);

	app.post<{
		Body: {
			relayCriteria: string;
			relayMarker: string;
			relayVisibility: string[];
			relayUnlistedAnswers: string;
		};
	}>("/settings/repost", { onRequest: [authenticateJWT] }, async (req, res) => {
		const user = await findUserById(req.user.id, true);

		const response_data = {
			err: undefined,
			blueskyPDS: user?.blueskyPDS,
			userName: req.user.mastodonHandle,
			instance: req.user.instance,
			relayCriteria: user?.relayCriteria,
			relayMarker: user?.relayMarker,
			pollingInterval: Number.parseInt(process.env.POLL_INTERVAL ?? "60"),
		};

		if (req.body.relayVisibility === undefined)
			return res.status(400).view("index", {
				...response_data,
				err: "Invalid Relay Visibility",
			});

		const relayVisibility = !Array.isArray(req.body.relayVisibility)
			? [req.body.relayVisibility]
			: req.body.relayVisibility;

		await updateRelaySettings(
			req.user.id,
			req.body.relayCriteria as InferInsertModel<typeof User>["relayCriteria"],
			req.body.relayMarker,
			relayVisibility as InferInsertModel<typeof User>["relayVisibility"],
			req.body.relayUnlistedAnswers === "on",
		);

		return res.redirect("/");
	});

	app.get("/privacy", async (req, res) => {
		return res.view("privacy", {});
	});

	app.get("/health", async (req, res) => {
		return res.send({ status: "ok" });
	});
};
