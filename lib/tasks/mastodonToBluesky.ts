import { Mastodon } from "megalodon";
import { getNewToots } from "../mastodon";
import { generateBlueskyPostsFromMastodon, intiBlueskyAgent } from "../bluesky";
import {
	domainToUrl,
	getBlueskyApiWaittime,
	logSchedulerEvent,
} from "../utils";
import { Constraint } from "../constraint";
import {
	db,
	updateLastPostTime,
	storeRepostRecord,
	findParentToot,
	findUsers,
	clearBlueskyCreds,
} from "../db";
import type { ReplyRef } from "@atproto/api/dist/client/types/app/bsky/feed/post";

export default async function taskMastodonToBluesky() {
	console.log("Running scheduled job: reposting to bluesky...");

	const users = await findUsers();

	users.forEach(async (user: any) => {
		if (!user.blueskyHandle || !user.blueskyToken) {
			logSchedulerEvent(
				user.name,
				user.mastodonInstance.url,
				"CREDENTIAL_CHECK",
				"no bluesky creds",
			);
			return;
		}

		const userClient = new Mastodon(
			domainToUrl(user.mastodonInstance.url),
			user.mastodonToken,
		);
		const constraint = new Constraint(
			user.relayCriteria ?? "all",
			user.relayMarker ?? "",
		);
		let posts = await getNewToots(
			userClient,
			user.mastodonUid,
			user.lastTootTime,
			constraint,
			user.relayVisibility,
		);

		if (posts.length === 0) {
			logSchedulerEvent(
				user.name,
				user.mastodonInstance.url,
				"REPOSTER",
				"no new posts",
			);
			return;
		}

		const blueskyClient = await intiBlueskyAgent(
			user.blueskyPDS || "https://bsky.social",
			user.blueskyHandle,
			user.blueskyToken,
			user,
		);

		if (blueskyClient === undefined) {
			return;
		}

		posts = posts.reverse();

		const repostsInThisRun: { [tootId: string]: ReplyRef } = {};

		for (const [postIdx, post] of posts.entries()) {
			try {
				if (
					post.in_reply_to_account_id !== user.mastodonUid &&
					post.in_reply_to_account_id !== null
				) {
					logSchedulerEvent(
						user.name,
						user.mastodonInstance.url,
						"REPOSTER",
						`skipping ${post.id} as it is a reply to someone else`,
					);
					continue;
				}
				logSchedulerEvent(
					user.name,
					user.mastodonInstance.url,
					"REPOSTER",
					`posting ${post.id}`,
				);
				const postsBsky = await generateBlueskyPostsFromMastodon(
					post,
					blueskyClient,
				);

				if (postsBsky.length === 0) continue;

				let repRef: ReplyRef = {
					root: undefined!,
					parent: undefined!,
				};

				if (post.in_reply_to_id) {
					const repostRefCached = repostsInThisRun[post.in_reply_to_id];
					if (repostRefCached) {
						logSchedulerEvent(
							user.name,
							user.mastodonInstance.url,
							"REPOSTER",
							`found parent in cache ${repostRefCached.parent?.uri}`,
						);
						repRef = repostRefCached;
					} else {
						const repostRef = await findParentToot(
							user.id,
							post.in_reply_to_id,
						);
						if (repostRef) {
							logSchedulerEvent(
								user.name,
								user.mastodonInstance.url,
								"REPOSTER",
								`found parent in db ${repostRef.parent?.uri}`,
							);

							repRef = repostRef;
						} else {
							logSchedulerEvent(
								user.name,
								user.mastodonInstance.url,
								"REPOSTER",
								`could not find parent in db ${post.in_reply_to_id}`,
							);
						}
					}
				}

				for (const [postBskyIdx, postBsky] of postsBsky.entries()) {
					if (postsBsky.length > 1) {
						logSchedulerEvent(
							user.name,
							user.mastodonInstance.url,
							"REPOSTER",
							`posting ${postBskyIdx + 1}/${postsBsky.length} (${post.id})`,
						);
					}

					if (repRef.parent !== undefined) {
						const discoveredParents = await blueskyClient.getPosts({
							uris: [repRef.parent?.uri],
						});

						if (discoveredParents.data.posts.length > 0) {
							logSchedulerEvent(
								user.name,
								user.mastodonInstance.url,
								"REPOSTER",
								`discovered parent on bluesky ${repRef.parent?.uri}`,
							);
							postBsky.reply = repRef;
						} else {
							logSchedulerEvent(
								user.name,
								user.mastodonInstance.url,
								"REPOSTER",
								`could not find parent on bluesky ${repRef.parent?.uri}, posting as root`,
							);
						}
					}

					try {
						const result = await blueskyClient.post(postBsky);

						if (repRef.root === undefined) repRef.root = result;
						repRef.parent = result;
					} catch (err: any) {
						if (err.error === "AccountDeactivated") {
							logSchedulerEvent(
								user.name,
								user.mastodonInstance.url,
								"REPOSTER",
								`Account deactivated, invalidating creds`,
							);

							clearBlueskyCreds(user);

							return;
						}
					}

					if (postBskyIdx < postsBsky.length - 1) {
						logSchedulerEvent(
							user.name,
							user.mastodonInstance.url,
							"REPOSTER",
							`waiting ${getBlueskyApiWaittime()}ms for next post (split post)`,
						);
						await new Promise((resolve) =>
							setTimeout(resolve, getBlueskyApiWaittime()),
						);
					}
				}

				repostsInThisRun[post.id] = repRef;
				await storeRepostRecord(user.id, post.id, repRef);
				await updateLastPostTime(user.id, new Date(post.created_at));
				if (postIdx < posts.length - 1) {
					logSchedulerEvent(
						user.name,
						user.mastodonInstance.url,
						"REPOSTER",
						`waiting ${getBlueskyApiWaittime()}ms for next post (thread)`,
					);
					await new Promise((resolve) =>
						setTimeout(resolve, getBlueskyApiWaittime()),
					);
				}
			} catch (err) {
				logSchedulerEvent(
					user.name,
					user.mastodonInstance.url,
					"REPOSTER",
					"could not repost",
				);
				console.error(err);
			}
		}
	});
}
