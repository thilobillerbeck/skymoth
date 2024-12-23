/*
  Warnings:

  - You are about to drop the `UserSettings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "UserSettings" DROP CONSTRAINT "UserSettings_userId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "relayVisibility" "StatusVisibility"[] DEFAULT ARRAY['public']::"StatusVisibility"[];

-- DropTable
DROP TABLE "UserSettings";
