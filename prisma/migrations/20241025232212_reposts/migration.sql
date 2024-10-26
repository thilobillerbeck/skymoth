-- CreateTable
CREATE TABLE "Repost" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "tootId" TEXT NOT NULL,
    "bsRootUri" TEXT NOT NULL,
    "bsRootCid" TEXT NOT NULL,
    "bsParentUri" TEXT NOT NULL,
    "bsParentCid" TEXT NOT NULL,

    CONSTRAINT "Repost_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Repost" ADD CONSTRAINT "Repost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
