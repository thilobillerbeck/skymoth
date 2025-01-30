import type { ReplyRef } from "@atproto/api/dist/client/types/app/bsky/feed/post";
import { logSchedulerEvent } from "./utils";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import * as schema from "./../drizzle/schema";
import * as relations from "./../drizzle/relations";
import { count, eq, type InferSelectModel } from "drizzle-orm";
import type { AtpSessionData } from "@atproto/api";

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
			console.error(err);
		});
}

export async function clearBluskySession(user: InferSelectModel<typeof schema.user> & {
	mastodonInstance: InferSelectModel<typeof schema.mastodonInstance>;
}) {
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
			console.error(err);
		});
}

export async function clearBlueskyCreds(user: InferSelectModel<typeof schema.user> & {
	mastodonInstance: InferSelectModel<typeof schema.mastodonInstance>;
}) {
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
			console.error(err);
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
	userid: any,
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

export async function deleteUser(user: InferSelectModel<typeof schema.user> & {
	mastodonInstance: InferSelectModel<typeof schema.mastodonInstance>;
}) {
	return await db
		.delete(schema.user)
		.where(eq(schema.user.id, user.id))
		.then(() => {
			logSchedulerEvent(user.name, "---", "CREDENTIAL_CHECK", "User deleted");
		})
		.catch((err) => {
			logSchedulerEvent(
				user.name,
				"---",
				"CREDENTIAL_CHECK",
				"Could not delete user",
			);
			console.error(err);
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

export async function deleteMastodonInstance(instance: InferSelectModel<typeof schema.mastodonInstance>) {
	return await db
		.delete(schema.mastodonInstance)
		.where(eq(schema.mastodonInstance.id, instance.id))
		.then(() => {
			logSchedulerEvent(
				"SYSTEM",
				instance.url,
				"INSTANCE_USERS",
				"Instance deleted",
			);
		})
		.catch((err) => {
			logSchedulerEvent(
				"SYSTEM",
				instance.url,
				"INSTANCE_USERS",
				"Could not delete instance",
			);
			console.error(err);
		});
}

export async function persistBlueskyCreds(
	userId: any,
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
	userId: any,
	relayCriteria: any,
	relayMarker: string,
	relayVisibility: any,
) {
	return await db
		.update(schema.user)
		.set({
			updatedAt: new Date(),
			relayCriteria: relayCriteria,
			relayMarker: relayMarker,
			relayVisibility: relayVisibility,
		})
		.where(eq(schema.user.id, userId))
		.returning();
}

export async function createMastodonInstance(
	instanceDomain: string,
	appData: any,
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
	instanceId: any,
	verifiedCredentials: any,
	token: any,
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

export async function updateUser(userId: any, token: any, name: string) {
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
