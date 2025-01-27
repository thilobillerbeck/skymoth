import { relations } from "drizzle-orm/relations";
import { mastodonInstance, user, repost } from "./schema";

export const userRelations = relations(user, ({one, many}) => ({
	mastodonInstance: one(mastodonInstance, {
		fields: [user.mastodonInstanceId],
		references: [mastodonInstance.id]
	}),
	reposts: many(repost),
}));

export const mastodonInstanceRelations = relations(mastodonInstance, ({many}) => ({
	users: many(user),
}));

export const repostRelations = relations(repost, ({one}) => ({
	user: one(user, {
		fields: [repost.userId],
		references: [user.id]
	}),
}));