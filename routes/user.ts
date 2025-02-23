import type { FastifyInstance } from "fastify";
import { Mastodon } from "megalodon";
import {
	authenticateJWT,
	domainToUrl,
	genCallBackUrl,
	validateDomain,
} from "./../lib/utils";
import {
	createMastodonInstance,
	createUser,
	deleteUser,
	getAllUserInformation,
	getInstanceByDomain,
	getUserByMastodonUid,
	updateUser,
} from "./../lib/db";
import type { AtpSessionData } from "@atproto/api";

export const routesUser = async (app: FastifyInstance) => {
	app.get("/login", async (req, res) => {
		return res.view("login", {});
	});

	app.get("/logout", async (req, res) => {
		return res.clearCookie("token").redirect("/login");
	});

	app.post(
		"/account/delete",
		{ onRequest: [authenticateJWT] },
		async (req, res) => {
			deleteUser(req.user.id, req.user.mastodonHandle);
			return res.clearCookie("token").redirect("/login");
		},
	);

	app.get(
		"/account/downloadData",
		{ onRequest: [authenticateJWT] },
		async (req, res) => {
			const user = await getAllUserInformation(req.user.id);
			if (user) {
				if (user.blueskySession) {
					const blueskySession =
						user?.blueskySession as unknown as AtpSessionData;

					user.blueskySession = {
						handle: blueskySession?.handle,
						did: blueskySession?.did,
						email: blueskySession?.email,
						emailConfirmed: blueskySession?.emailConfirmed,
						emailAuthFactor: blueskySession?.emailAuthFactor,
						active: blueskySession?.active,
						status: blueskySession?.status,
					};
				}
				res.header(
					"Content-Disposition",
					`attachment; filename=skymoth-userdata-${user?.name}.json`,
				);
				res.send(user).type("application/json").code(200).redirect("/");
			} else {
				return res.status(404).send("User not found");
			}
		},
	);

	app.get<{
		Querystring: {
			instance: string;
		};
	}>("/auth", async (req, res) => {
		let instanceDomain: string = req.query.instance || "mastodon.social";
		instanceDomain = instanceDomain
			.toLowerCase()
			.replace(/https?:\/\//, "")
			.replace("/", "");

		if (!validateDomain(instanceDomain)) {
			return res.status(400).view("login", {
				err: "Invalid instance domain",
			});
		}

		const url = domainToUrl(instanceDomain);
		const client = new Mastodon(url);

		let knownInstance = await getInstanceByDomain(instanceDomain);

		if (knownInstance) {
			req.log.info("Instance already registered");
		} else {
			req.log.info("Instance not registered");
			const appData = await client.createApp(
				process.env.APP_ID ?? "skymoth-test",
				{
					scopes: ["read"],
					redirect_uris: genCallBackUrl(instanceDomain),
				},
			);

			knownInstance = (
				await createMastodonInstance(instanceDomain, appData)
			)[0];
		}

		const authUrl = await client.generateAuthUrl(
			knownInstance.applicationId,
			knownInstance.applicationSecret,
			{
				scope: ["read"],
				redirect_uri: genCallBackUrl(instanceDomain),
			},
		);
		return res.redirect(authUrl);
	});

	app.get<{
		Params: {
			id: string;
		};
		Querystring: {
			code: string;
		};
	}>("/auth/callback/:id", async (req, res) => {
		const { id } = req.params;

		const instance = await getInstanceByDomain(atob(id));

		if (instance == null) {
			return res.status(400).view("login", {
				err: "A problem occured while authenticating to the instance via token",
			});
		}

		const client = new Mastodon(domainToUrl(instance.url));

		const token = await client.fetchAccessToken(
			instance.applicationId,
			instance.applicationSecret,
			req.query.code,
			genCallBackUrl(instance.url),
		);

		const userClient = new Mastodon(
			domainToUrl(instance.url),
			token.access_token,
		);
		const verifiedCredentials = await userClient.verifyAccountCredentials();

		let user = await getUserByMastodonUid(
			verifiedCredentials.data.id,
			instance.id,
		);

		if (!user) {
			user = (await createUser(instance.id, verifiedCredentials, token))[0];
		} else {
			user = (
				await updateUser(user.id, token, verifiedCredentials.data.username)
			)[0];
		}

		const jwt = app.jwt.sign({
			id: user.id,
			mastodonHandle: verifiedCredentials.data.username,
			token: token,
			instance: instance.url,
		});

		return res
			.setCookie("token", jwt, {
				domain: process.env.APP_DOMAIN,
				path: "/",
				secure: false,
				httpOnly: true,
			})
			.redirect("/");
	});
};
