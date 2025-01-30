import { Mastodon } from "megalodon";
import { domainToUrl, logSchedulerEvent } from "../utils";
import {
	deleteMastodonInstance,
	deleteUser,
	findUsers,
	getMastodonInstanceUsers,
} from "../db";

export default async function cleanupJob() {
	console.log("Running scheduled job: verify instance app credentials...");

	const users = await findUsers();

	for (const user of users) {
		const userClient = new Mastodon(
			domainToUrl(user.mastodonInstance.url),
			user.mastodonToken,
		);

		userClient
			.verifyAppCredentials()
			.then((response) => {
				logSchedulerEvent(
					user.name,
					user.mastodonInstance.url,
					"CREDENTIAL_CHECK",
					`${response.status}: ${response.statusText}`,
				);
			})
			.catch((error) => {
				logSchedulerEvent(
					user.name,
					user.mastodonInstance.url,
					"CREDENTIAL_CHECK",
					`${(error as Response).status}: ${(error as Response).statusText}`,
				);

				if ((error as Response).status === 401) {
					logSchedulerEvent(
						user.name,
						user.mastodonInstance.url,
						"CREDENTIAL_CHECK",
						"Deleting user due to invalid credentials",
					);
					deleteUser(user);
				}
			});
	}

	const instances = await getMastodonInstanceUsers();

	for (const instance of instances) {
		logSchedulerEvent(
			"SYSTEM",
			instance.url,
			"INSTANCE_USERS",
			`${instance.count} users`,
		);

		if (instance.count === 0) {
			logSchedulerEvent(
				"SYSTEM",
				instance.url,
				"INSTANCE_USERS",
				"Deleting instance due to no users",
			);

			deleteMastodonInstance(instance);
		}
	}
}
