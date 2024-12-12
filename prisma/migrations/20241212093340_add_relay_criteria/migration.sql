-- AlterTable
ALTER TABLE "User" ADD COLUMN     "relayCriteria" "RelayCriteria" NOT NULL DEFAULT 'all',
ADD COLUMN     "relayMarker" TEXT NOT NULL DEFAULT '';
