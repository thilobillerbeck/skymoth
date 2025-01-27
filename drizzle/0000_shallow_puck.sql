CREATE TYPE "public"."RelayCriteria" AS ENUM('all', 'favedBySelf', 'containsMarker', 'notContainsMarker');--> statement-breakpoint
CREATE TYPE "public"."StatusVisibility" AS ENUM('public', 'unlisted', 'private', 'direct');--> statement-breakpoint
CREATE TABLE "MastodonInstance" (
	"id" text PRIMARY KEY NOT NULL,
	"urlEncoded" text NOT NULL,
	"url" text NOT NULL,
	"applicationId" text NOT NULL,
	"applicationSecret" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Repost" (
	"id" text PRIMARY KEY NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"userId" text NOT NULL,
	"tootId" text NOT NULL,
	"bsRootUri" text NOT NULL,
	"bsRootCid" text NOT NULL,
	"bsParentUri" text NOT NULL,
	"bsParentCid" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" text PRIMARY KEY NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"lastTootTime" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"name" text NOT NULL,
	"mastodonUid" text NOT NULL,
	"mastodonToken" text NOT NULL,
	"blueskyToken" text,
	"blueskyHandle" text,
	"blueskySession" jsonb,
	"blueskySessionEvent" text,
	"mastodonInstanceId" text NOT NULL,
	"blueskyPDS" text DEFAULT 'https://bsky.social',
	"relayCriteria" "RelayCriteria" DEFAULT 'all' NOT NULL,
	"relayMarker" text DEFAULT '' NOT NULL,
	"relayVisibility" "StatusVisibility"[] DEFAULT '{"public"}'
);
--> statement-breakpoint
ALTER TABLE "Repost" ADD CONSTRAINT "Repost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "User" ADD CONSTRAINT "User_mastodonInstanceId_fkey" FOREIGN KEY ("mastodonInstanceId") REFERENCES "public"."MastodonInstance"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "MastodonInstance_urlEncoded_key" ON "MastodonInstance" USING btree ("urlEncoded" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "MastodonInstance_url_key" ON "MastodonInstance" USING btree ("url" text_ops);