-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OPERATOR');

-- CreateEnum
CREATE TYPE "ModelStatus" AS ENUM ('TRAINING', 'READY', 'FAILED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'OPERATOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingDataset" (
    "id" SERIAL NOT NULL,
    "datasetName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploadedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT,

    CONSTRAINT "TrainingDataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelConfig" (
    "id" SERIAL NOT NULL,
    "thresholds" DOUBLE PRECISION NOT NULL,
    "learningRate" DOUBLE PRECISION NOT NULL,
    "epochs" INTEGER NOT NULL,
    "batchSize" INTEGER NOT NULL,
    "loraAlpha" DOUBLE PRECISION NOT NULL,
    "baseModelVersion" TEXT NOT NULL,
    "loraRank" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "ModelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiffusionModel" (
    "id" SERIAL NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "status" "ModelStatus" NOT NULL DEFAULT 'TRAINING',
    "lastTrained" TIMESTAMP(3),
    "accuracyScore" DOUBLE PRECISION,
    "modelConfigId" INTEGER NOT NULL,

    CONSTRAINT "DiffusionModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Camera" (
    "id" SERIAL NOT NULL,
    "location" TEXT NOT NULL,

    CONSTRAINT "Camera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InputImage" (
    "id" SERIAL NOT NULL,
    "captureTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cameraSourceId" TEXT,
    "imagePath" TEXT,
    "imageBytes" BYTEA,
    "cameraId" INTEGER,

    CONSTRAINT "InputImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnomalyResult" (
    "id" SERIAL NOT NULL,
    "isAnomalous" BOOLEAN NOT NULL,
    "anomalyScore" DOUBLE PRECISION NOT NULL,
    "heatmapPath" TEXT,
    "operatorVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imageId" INTEGER NOT NULL,
    "modelId" INTEGER,
    "verifiedById" TEXT,

    CONSTRAINT "AnomalyResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultId" INTEGER NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingRun" (
    "id" SERIAL NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "status" "ModelStatus" NOT NULL DEFAULT 'TRAINING',
    "datasetId" INTEGER NOT NULL,
    "configId" INTEGER NOT NULL,
    "modelId" INTEGER NOT NULL,

    CONSTRAINT "TrainingRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "SystemLog_userId_time_idx" ON "SystemLog"("userId", "time");

-- CreateIndex
CREATE INDEX "TrainingDataset_uploadedDate_idx" ON "TrainingDataset"("uploadedDate");

-- CreateIndex
CREATE INDEX "ModelConfig_createdAt_idx" ON "ModelConfig"("createdAt");

-- CreateIndex
CREATE INDEX "DiffusionModel_status_idx" ON "DiffusionModel"("status");

-- CreateIndex
CREATE INDEX "DiffusionModel_modelConfigId_idx" ON "DiffusionModel"("modelConfigId");

-- CreateIndex
CREATE INDEX "InputImage_captureTime_idx" ON "InputImage"("captureTime");

-- CreateIndex
CREATE INDEX "InputImage_cameraId_idx" ON "InputImage"("cameraId");

-- CreateIndex
CREATE UNIQUE INDEX "AnomalyResult_imageId_key" ON "AnomalyResult"("imageId");

-- CreateIndex
CREATE INDEX "AnomalyResult_createdAt_idx" ON "AnomalyResult"("createdAt");

-- CreateIndex
CREATE INDEX "AnomalyResult_isAnomalous_idx" ON "AnomalyResult"("isAnomalous");

-- CreateIndex
CREATE INDEX "AnomalyResult_operatorVerified_idx" ON "AnomalyResult"("operatorVerified");

-- CreateIndex
CREATE INDEX "Notification_resultId_timestamp_idx" ON "Notification"("resultId", "timestamp");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "TrainingRun_startedAt_idx" ON "TrainingRun"("startedAt");

-- CreateIndex
CREATE INDEX "TrainingRun_modelId_startedAt_idx" ON "TrainingRun"("modelId", "startedAt");

-- AddForeignKey
ALTER TABLE "SystemLog" ADD CONSTRAINT "SystemLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingDataset" ADD CONSTRAINT "TrainingDataset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelConfig" ADD CONSTRAINT "ModelConfig_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiffusionModel" ADD CONSTRAINT "DiffusionModel_modelConfigId_fkey" FOREIGN KEY ("modelConfigId") REFERENCES "ModelConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InputImage" ADD CONSTRAINT "InputImage_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "Camera"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnomalyResult" ADD CONSTRAINT "AnomalyResult_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "InputImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnomalyResult" ADD CONSTRAINT "AnomalyResult_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "DiffusionModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnomalyResult" ADD CONSTRAINT "AnomalyResult_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "AnomalyResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRun" ADD CONSTRAINT "TrainingRun_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "TrainingDataset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRun" ADD CONSTRAINT "TrainingRun_configId_fkey" FOREIGN KEY ("configId") REFERENCES "ModelConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRun" ADD CONSTRAINT "TrainingRun_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "DiffusionModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
