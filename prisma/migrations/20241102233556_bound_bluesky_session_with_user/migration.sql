/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `BlueskySession` will be added. If there are existing duplicate values, this will fail.
  - The required column `userId` was added to the `BlueskySession` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "BlueskySession" ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "legacyAuth" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "BlueskySession_userId_key" ON "BlueskySession"("userId");

-- AddForeignKey
ALTER TABLE "BlueskySession" ADD CONSTRAINT "BlueskySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
