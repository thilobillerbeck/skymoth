import {
	AtpAgent,
	AppBskyFeedPost,
	RichText,
	type BlobRef,
	type AtpSessionData,
	type AtpSessionEvent,
	type Facet,
} from "@atproto/api";
import type { Entity } from "megalodon";
import {
	fetchImageToBytes,
	logSchedulerEvent,
	mastodonHtmlToText,
	splitTextBluesky,
} from "./utils";
import sharp from "sharp";
import type { Attachment } from "megalodon/lib/src/entities/attachment";
import {
	clearBlueskyCreds,
	clearBluskySession,
	db,
	persistBlueskySession,
} from "./db";
import { ResponseType, type XRPCError } from "@atproto/xrpc";
import type { InferSelectModel } from "drizzle-orm";
import type { mastodonInstance, user as User } from "../drizzle/schema";
import logger from "./logger";
import { isLink as isFacetLink } from "@atproto/api/dist/client/types/app/bsky/richtext/facet";
import ogs from "open-graph-scraper";
import type { External } from "@atproto/api/dist/client/types/app/bsky/embed/external";

export async function intiBlueskyAgent(
	url: string,
	handle: string,
	password: string,
	user: InferSelectModel<typeof User> & {
		mastodonInstance: InferSelectModel<typeof mastodonInstance>;
	},
): Promise<AtpAgent | undefined> {
	let session: AtpSessionData | undefined = undefined;
	session = user.blueskySession as unknown as AtpSessionData;

	const agent = new AtpAgent({
		service: url,
		persistSession: (evt: AtpSessionEvent, sess?: AtpSessionData) => {
			logSchedulerEvent(
				user.name,
				user.mastodonInstance.url,
				"SESSION_PERSIST",
				`${evt}`,
			);
			if (evt === "expired" || evt === "create-failed") {
				logSchedulerEvent(
					user.name,
					user.mastodonInstance.url,
					"AGENT",
					"clearing session",
				);
				clearBluskySession(user);
			} else {
				logSchedulerEvent(
					user.name,
					user.mastodonInstance.url,
					"AGENT",
					"persisting session",
				);
				persistBlueskySession(user, evt, sess);
			}
		},
	});

	if (session) {
		const res = await agent.resumeSession(session);

		if (res.success) {
			logSchedulerEvent(
				user.name,
				user.mastodonInstance.url,
				"AGENT",
				"resuming session",
			);
			return agent;
		}

		logSchedulerEvent(
			user.name,
			user.mastodonInstance.url,
			"AGENT",
			"could not resume session",
		);
	} else {
		logSchedulerEvent(
			user.name,
			user.mastodonInstance.url,
			"AGENT",
			"no session found",
		);
	}

	try {
		await agent.login({ identifier: handle, password: password });
		return agent;
	} catch (err) {
		if ((err as XRPCError).status === ResponseType.AuthRequired) {
			// invalidate creds to prevent further login attempts resulting in rate limiting
			logSchedulerEvent(
				user.name,
				user.mastodonInstance.url,
				"AGENT",
				"invalid creds",
			);
			clearBlueskyCreds(user);
		} else if ((err as XRPCError).status === ResponseType.RateLimitExceeded) {
			logSchedulerEvent(
				user.name,
				user.mastodonInstance.url,
				"AGENT",
				"login rate limited",
			);
		} else {
			logSchedulerEvent(
				user.name,
				user.mastodonInstance.url,
				"AGENT",
				"login error",
			);
			logger.error(err);
		}
		return undefined;
	}
}

function applyPostLink(status: Entity.Status): string {
	console.log(status.media_attachments);
	if (status.poll) return `\n\nPoll: ${status.url}`;
	if (
		status.media_attachments.find(
			(media) => media.type === "video" || media.type === "gifv",
		)
	) {
		return `\n\nVideo: ${status.url}`;
	}
	if (status.media_attachments.find((media) => media.type === "audio")) {
		return `\n\nAudio: ${status.url}`;
	}
	return "";
}

export async function generateBlueskyPostsFromMastodon(
	status: Entity.Status,
	client: AtpAgent,
	postNumbering: boolean,
): Promise<Array<AppBskyFeedPost.Record>> {
	const posts: Array<AppBskyFeedPost.Record> = [];
	const spoiler = status.sensitive ? `CW: ${status.spoiler_text}\n\n` : "";
	const conv = mastodonHtmlToText(status.content);
	const postLink = applyPostLink(status);
	const split = splitTextBluesky(conv, spoiler, postLink, postNumbering);

	for (const [idx, text] of split.entries()) {
		const post = await generateBlueskyPostFromMastodon(
			status,
			text,
			client,
			idx === 0 ? status.media_attachments : undefined,
		);
		if (post) {
			posts.push(post);
		}
	}

	return posts;
}

async function handleBskyImageBlob(
	url: string,
	client: AtpAgent,
): Promise<BlobRef | undefined> {
	const { arrayBuffer, mimeType } = await fetchImageToBytes(url);

	if (!mimeType) return undefined;

	let arr = new Uint8Array(arrayBuffer);

	if (arr.length > 1000000) {
		const result = await sharp(arrayBuffer)
			.resize({ height: 1080 })
			.jpeg({
				quality: 40,
			})
			.toBuffer();

		arr = new Uint8Array(result.buffer);
	}
	const res = await client.uploadBlob(arr, {
		encoding: mimeType,
	});

	if (res.success) return res.data.blob;
	return undefined;
}

async function getPostExternalEmbed(
	links: string[],
	client: AtpAgent,
): Promise<External | undefined> {
	for (const link of links) {
		const { result } = await ogs({
			url: link,
		});

		if (result.requestUrl && result.ogTitle && result.ogDescription) {
			if (result.ogImage?.[0].url) {
				const url = result.ogImage[0].url.startsWith("/")
					? `${result.requestUrl}${result.ogImage[0].url.slice(1)}`
					: result.ogImage[0].url;

				const imageBlob = await handleBskyImageBlob(url, client);

				if (!imageBlob) {
					return {
						uri: result.requestUrl,
						title: result.ogTitle,
						description: result.ogDescription,
					};
				}
				return {
					uri: result.requestUrl,
					title: result.ogTitle,
					description: result.ogDescription,
					thumb: imageBlob,
				};
			}
			return {
				uri: result.requestUrl,
				title: result.ogTitle,
				description: result.ogDescription,
			};
		}
	}

	return undefined;
}

async function getPostExternalLinks(facets: Facet[]) {
	const lgLinks = [];

	for (const facet of facets) {
		for (const facetFeature of facet.features) {
			if (isFacetLink(facetFeature)) {
				lgLinks.push(facetFeature.uri);
			}
		}
	}

	return lgLinks;
}

export async function generateBlueskyPostFromMastodon(
	status: Entity.Status,
	content: string,
	client: AtpAgent,
	media_attachments?: Array<Attachment>,
): Promise<AppBskyFeedPost.Record | undefined> {
	const rt = new RichText({
		text: content,
	});

	await rt.detectFacets(client);

	const ogLinks = rt.facets ? await getPostExternalLinks(rt.facets) : [];

	let post: AppBskyFeedPost.Record = {
		$type: "app.bsky.feed.post",
		text: rt.text,
		facets: rt.facets,
		langs: status.language ? [status.language] : ["en"],
		createdAt: new Date().toISOString(),
	};

	if (media_attachments && media_attachments.length > 0) {
		const media_attachmentsFiltered = media_attachments.filter(
			(media) => media.type === "image",
		);

		if (media_attachmentsFiltered.length > 0 && client) {
			const images: {
				image: BlobRef;
				alt: string;
				aspectRatio: {
					width: number;
					height: number;
				};
			}[] = [];
			for (const media of media_attachmentsFiltered) {
				const imageBlob = await handleBskyImageBlob(media.url, client);

				if (!imageBlob) continue;

				let width = 1200;
				let height = 1200;
				if (media.meta) {
					if (media.meta.original) {
						width = media.meta.original.width || width;
						height = media.meta.original.height || height;
					} else {
						width = media.meta.width || width;
						height = media.meta.height || height;
					}
				}

				images.push({
					image: imageBlob,
					alt: media.description ? media.description : "",
					aspectRatio: {
						width: width,
						height: height,
					},
				});
			}

			post = {
				...post,
				embed: {
					$type: "app.bsky.embed.images",
					images: images,
				},
			};
		}
	} else if (ogLinks.length > 0) {
		const ogEmbed = await getPostExternalEmbed(ogLinks, client);

		if (ogEmbed) {
			post = {
				...post,
				embed: {
					$type: "app.bsky.embed.external",
					external: ogEmbed,
				},
			};
		}
	}

	if (AppBskyFeedPost.isRecord(post)) {
		const res = AppBskyFeedPost.validateRecord(post);
		if (res.success) {
			return post;
		}
	}
	return undefined;
}

export function validateBlueskyHandle(handle: string): boolean {
	const handleRegex = new RegExp(
		/^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/,
	);
	return handleRegex.test(handle);
}

export function validateBlueskyAppPassword(password: string): boolean {
	const passwordRegex = new RegExp(/^(?:[a-zA-Z0-9]{4}-){3}[a-zA-Z0-9]{4}$/);
	return passwordRegex.test(password);
}

export async function validateBlueskyCredentials(
	pds: string,
	handle: string,
	token: string,
): Promise<boolean> {
	const agent = new AtpAgent({
		service: pds,
	});

	try {
		const res = await agent.login({ identifier: handle, password: token });
		return res.success;
	} catch (err) {
		return false;
	}
}
