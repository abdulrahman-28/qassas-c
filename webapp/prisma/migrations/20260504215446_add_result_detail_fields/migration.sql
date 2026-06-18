-- AlterTable
ALTER TABLE "AnomalyResult" ADD COLUMN     "coverage" DOUBLE PRECISION,
ADD COLUMN     "heatmapData" TEXT,
ADD COLUMN     "metrics" JSONB,
ADD COLUMN     "reconstructedData" TEXT,
ADD COLUMN     "threshold" DOUBLE PRECISION;
