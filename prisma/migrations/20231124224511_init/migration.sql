-- CreateEnum
CREATE TYPE "StatusVisibility" AS ENUM ('public', 'unlisted', 'private', 'direct');

-- CreateTable
CREATE TABLE "MastodonInstance" (
    "id" TEXT NOT NULL,
    "urlEncoded" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "applicationSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MastodonInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastTootTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "mastodonUid" TEXT NOT NULL,
    "mastodonToken" TEXT NOT NULL,
    "blueskyToken" TEXT,
    "blueskyHandle" TEXT,
    "mastodonInstanceId" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "statusVisibility" "StatusVisibility" NOT NULL DEFAULT 'public',
    "excludeReplies" BOOLEAN NOT NULL DEFAULT false,
    "excludeReblogs" BOOLEAN NOT NULL DEFAULT false,
    "excludeMentions" BOOLEAN NOT NULL DEFAULT false,
    "excludeSensitive" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MastodonInstance_urlEncoded_key" ON "MastodonInstance"("urlEncoded");

-- CreateIndex
CREATE UNIQUE INDEX "MastodonInstance_url_key" ON "MastodonInstance"("url");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_mastodonInstanceId_fkey" FOREIGN KEY ("mastodonInstanceId") REFERENCES "MastodonInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
