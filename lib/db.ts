import type { AtpSessionData } from "@atproto/api";
import type { ReplyRef } from "@atproto/api/dist/client/types/app/bsky/feed/post";
import {
	count,
	eq,
	type InferInsertModel,
	type InferSelectModel,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { OAuth } from "megalodon";
import type { Account } from "megalodon/lib/esm/entities/account";
import type Response from "megalodon/lib/esm/response";
import { Client } from "pg";
import * as relations from "./../drizzle/relations";
import * as schema from "./../drizzle/schema";
import logger from "./logger";
import { logSchedulerEvent } from "./utils";

export const client = new Client({
	connectionString: process.env.POSTGRES_URL,
});

export const db = drizzle(client, { schema: { ...schema, ...relations } });

export async function getUserByMastodonUid(userId: string, instanceId: string) {
	return await db.query.user.findFirst({
		where: (user, { eq, and }) =>
			and(
				eq(user.mastodonUid, userId),
				eq(user.mastodonInstanceId, instanceId),
			),
	});
}

export async function getInstanceByDomain(url: string) {
	return await db.query.mastodonInstance.findFirst({
		where: (instance, { eq }) => eq(instance.url, url),
	});
}

export async function updateLastPostTime(userId: string, postTime: Date) {
	const user = await db.query.user.findFirst({
		where: (user, { eq }) => eq(user.id, userId),
	});
	if (!user) return;
	if (new Date(user?.lastTootTime) > postTime) return;
	return await db
		.update(schema.user)
		.set({
			updatedAt: new Date(),
			lastTootTime: postTime,
		})
		.where(eq(schema.user.id, userId));
}

export async function storeRepostRecord(
	userId: string,
	tootId: string,
	repRef: ReplyRef,
) {
	return await db
		.insert(schema.repost)
		.values({
			userId: userId,
			tootId: tootId,
			bsParentCid: repRef.parent.cid,
			bsRootCid: repRef.root.cid,
			bsRootUri: repRef.root.uri,
			bsParentUri: repRef.parent.uri,
		})
		.returning();
}

export async function findParentToot(
	userId: string,
	tootId: string,
): Promise<ReplyRef | null> {
	const repost = await db.query.repost.findFirst({
		where: (repost, { eq, and }) =>
			and(eq(repost.userId, userId), eq(repost.tootId, tootId)),
	});

	if (!repost) return null;

	const repRef: ReplyRef = {
		root: {
			cid: repost.bsRootCid,
			uri: repost.bsRootUri,
		},
		parent: {
			cid: repost.bsParentCid,
			uri: repost.bsParentUri,
		},
	};

	return repRef;
}

export async function persistBlueskySession(
	user: InferSelectModel<typeof schema.user> & {
		mastodonInstance: InferSelectModel<typeof schema.mastodonInstance>;
	},
	evt: string,
	sess?: AtpSessionData,
) {
	return await db
		.update(schema.user)
		.set({
			updatedAt: new Date(),
			blueskySession: sess,
			blueskySessionEvent: evt,
		})
		.where(eq(schema.user.id, user.id))
		.then(() => {
			logSchedulerEvent(
				user.name,
				user.mastodonInstance.url,
				"AGENT",
				"session persisted",
			);
		})
		.catch((err) => {
			logSchedulerEvent(
				user.name,
				user.mastodonInstance.url,
				"AGENT",
				"could not persist session",
			);
			logger.error(err);
		});
}

export async function clearBluskySession(
	user: InferSelectModel<typeof schema.user> & {
		mastodonInstance: InferSelectModel<typeof schema.mastodonInstance>;
	},
) {
	return await db
		.update(schema.user)
		.set({
			updatedAt: new Date(),
			blueskySession: null,
			blueskySessionEvent: null,
		})
		.where(eq(schema.user.id, user.id))
		.then(() => {
			logSchedulerEvent(
				user.name,
				user.mastodonInstance.url,
				"AGENT",
				"session cleared",
			);
		})
		.catch((err) => {
			logSchedulerEvent(
				user.name,
				user.mastodonInstance.url,
				"AGENT",
				"could not clear session",
			);
			logger.error(err);
		});
}

export async function clearBlueskyCreds(
	user: InferSelectModel<typeof schema.user> & {
		mastodonInstance: InferSelectModel<typeof schema.mastodonInstance>;
	},
) {
	return await db
		.update(schema.user)
		.set({
			updatedAt: new Date(),
			blueskySession: null,
			blueskySessionEvent: null,
			blueskyToken: null,
			blueskyHandle: null,
		})
		.where(eq(schema.user.id, user.id))
		.then(() => {
			logSchedulerEvent(
				user.name,
				user.mastodonInstance.url,
				"AGENT",
				"bluesky creds invalidated",
			);
		})
		.catch((err) => {
			logSchedulerEvent(
				user.name,
				user.mastodonInstance.url,
				"AGENT",
				"could not clear creds",
			);
			logger.error(err);
		});
}

export async function findUsers() {
	return await db.query.user.findMany({
		with: {
			mastodonInstance: true,
		},
	});
}

export async function findUserById(
	userid: string,
	withMastodonInstance = false,
) {
	return await db.query.user.findFirst({
		where: (user, { eq }) => eq(user.id, userid),
		with: withMastodonInstance ? { mastodonInstance: true } : undefined,
	});
}

export async function getAllUserInformation(userId: string) {
	return await db.query.user.findFirst({
		where: (user, { eq }) => eq(user.id, userId),
		columns: {
			createdAt: true,
			updatedAt: true,
			mastodonUid: true,
			mastodonToken: false,
			name: true,
			lastTootTime: true,
			blueskyHandle: true,
			blueskyToken: false,
			blueskySession: true,
			blueskyPDS: true,
		},
	});
}

export async function deleteUser(userId: string, userName: string) {
	return await db
		.delete(schema.user)
		.where(eq(schema.user.id, userId))
		.then(() => {
			logSchedulerEvent(userName, "---", "CREDENTIAL_CHECK", "User deleted");
		})
		.catch((err) => {
			logSchedulerEvent(
				userName,
				"---",
				"CREDENTIAL_CHECK",
				"Could not delete user",
			);
			logger.error(err);
		});
}

export async function getMastodonInstanceUsers() {
	return await db
		.select({
			id: schema.mastodonInstance.id,
			url: schema.mastodonInstance.url,
			count: count(schema.user.id),
		})
		.from(schema.mastodonInstance)
		.leftJoin(
			schema.user,
			eq(schema.user.mastodonInstanceId, schema.mastodonInstance.id),
		)
		.groupBy(schema.mastodonInstance.id);
}

export async function deleteMastodonInstance(
	instanceId: string,
	instanceUrl: string,
) {
	return await db
		.delete(schema.mastodonInstance)
		.where(eq(schema.mastodonInstance.id, instanceId))
		.then(() => {
			logSchedulerEvent(
				"SYSTEM",
				instanceUrl,
				"INSTANCE_USERS",
				"Instance deleted",
			);
		})
		.catch((err) => {
			logSchedulerEvent(
				"SYSTEM",
				instanceUrl,
				"INSTANCE_USERS",
				"Could not delete instance",
			);
			logger.error(err);
		});
}

export async function persistBlueskyCreds(
	userId: string,
	handle: string,
	token: string,
	pds: string,
) {
	return await db
		.update(schema.user)
		.set({
			updatedAt: new Date(),
			blueskyHandle: handle,
			blueskyToken: token,
			blueskyPDS: pds,
		})
		.where(eq(schema.user.id, userId))
		.returning();
}

export async function updateRelaySettings(
	userId: string,
	relayCriteria: InferInsertModel<typeof schema.user>["relayCriteria"],
	relayMarker: string,
	relayVisibility: InferInsertModel<typeof schema.user>["relayVisibility"],
	relayUnlistedAnswers: boolean,
	relayPostNumbering: boolean,
) {
	return await db
		.update(schema.user)
		.set({
			updatedAt: new Date(),
			relayCriteria: relayCriteria,
			relayMarker: relayMarker,
			relayVisibility: relayVisibility,
			relayUnlistedAnswers: relayUnlistedAnswers,
			relayPostNumbering: relayPostNumbering,
		})
		.where(eq(schema.user.id, userId))
		.returning();
}

export async function createMastodonInstance(
	instanceDomain: string,
	appData: OAuth.AppData,
) {
	return await db
		.insert(schema.mastodonInstance)
		.values({
			updatedAt: new Date(),
			url: instanceDomain,
			urlEncoded: btoa(instanceDomain),
			applicationId: appData.client_id,
			applicationSecret: appData.client_secret,
		})
		.returning();
}

export async function createUser(
	instanceId: string,
	verifiedCredentials: Response<Account>,
	token: OAuth.TokenData,
) {
	return await db
		.insert(schema.user)
		.values({
			updatedAt: new Date(),
			mastodonInstanceId: instanceId,
			mastodonUid: verifiedCredentials.data.id,
			mastodonToken: token.access_token,
			name: verifiedCredentials.data.username,
			lastTootTime: new Date(),
		})
		.returning();
}

export async function updateUser(
	userId: string,
	token: OAuth.TokenData,
	name: string,
) {
	return await db
		.update(schema.user)
		.set({
			updatedAt: new Date(),
			mastodonToken: token.access_token,
			name: name,
		})
		.where(eq(schema.user.id, userId))
		.returning();
}
