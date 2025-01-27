import { pgTable, varchar, timestamp, text, integer, uniqueIndex, foreignKey, jsonb, pgEnum } from "drizzle-orm/pg-core"
import { randomUUID } from "node:crypto";

export const relayCriteria = pgEnum("RelayCriteria", ['all', 'favedBySelf', 'containsMarker', 'notContainsMarker'])
export const statusVisibility = pgEnum("StatusVisibility", ['public', 'unlisted', 'private', 'direct'])

export const mastodonInstance = pgTable("MastodonInstance", {
	id: text().primaryKey().notNull().$defaultFn(() => randomUUID()),
	urlEncoded: text().notNull(),
	url: text().notNull(),
	applicationId: text().notNull(),
	applicationSecret: text().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).notNull().defaultNow(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
	uniqueIndex("MastodonInstance_urlEncoded_key").using("btree", table.urlEncoded.asc().nullsLast().op("text_ops")),
	uniqueIndex("MastodonInstance_url_key").using("btree", table.url.asc().nullsLast().op("text_ops")),
]);

export const repost = pgTable("Repost", {
	id: text().primaryKey().notNull().$defaultFn(() => randomUUID()),
	createdAt: timestamp({ precision: 3, mode: 'date' }).defaultNow(),
	userId: text().notNull(),
	tootId: text().notNull(),
	bsRootUri: text().notNull(),
	bsRootCid: text().notNull(),
	bsParentUri: text().notNull(),
	bsParentCid: text().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "Repost_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const user = pgTable("User", {
	id: text().primaryKey().notNull().$defaultFn(() => randomUUID()),
	createdAt: timestamp({ precision: 3, mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).defaultNow().notNull(),
	lastTootTime: timestamp({ precision: 3, mode: 'date' }).defaultNow().notNull(),
	name: text().notNull(),
	mastodonUid: text().notNull(),
	mastodonToken: text().notNull(),
	blueskyToken: text(),
	blueskyHandle: text(),
	blueskySession: jsonb(),
	blueskySessionEvent: text(),
	mastodonInstanceId: text().notNull(),
	blueskyPDS: text().default('https://bsky.social'),
	relayCriteria: relayCriteria().default('all').notNull(),
	relayMarker: text().default('').notNull(),
	relayVisibility: statusVisibility().array().default(['public']),
}, (table) => [
	foreignKey({
			columns: [table.mastodonInstanceId],
			foreignColumns: [mastodonInstance.id],
			name: "User_mastodonInstanceId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);
