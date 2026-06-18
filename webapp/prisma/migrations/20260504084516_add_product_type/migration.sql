-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('BOTTLE', 'CAPSULE', 'PILL', 'TOOTHBRUSH', 'ALL');

-- AlterTable
ALTER TABLE "Camera" ADD COLUMN     "productType" "ProductType" NOT NULL DEFAULT 'ALL';
