/*
  Warnings:

  - Added the required column `name` to the `Camera` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CameraStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');

-- AlterTable
ALTER TABLE "Camera" ADD COLUMN     "assignedToId" TEXT,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "status" "CameraStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Camera_status_idx" ON "Camera"("status");

-- CreateIndex
CREATE INDEX "Camera_assignedToId_idx" ON "Camera"("assignedToId");

-- AddForeignKey
ALTER TABLE "Camera" ADD CONSTRAINT "Camera_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
