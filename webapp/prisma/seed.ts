import "dotenv/config";
import { PrismaClient, CameraStatus, ProductType } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // ── Cameras ────────────────────────────────────────────────────────────────
  const camerasData = [
    { name: "Bottle Inspection Line", location: "Factory Floor A", status: CameraStatus.ACTIVE, productType: ProductType.BOTTLE },
    { name: "Capsule Quality Control", location: "Factory Floor A", status: CameraStatus.ACTIVE, productType: ProductType.CAPSULE },
    { name: "Pill Packaging Line", location: "Factory Floor B", status: CameraStatus.ACTIVE, productType: ProductType.PILL },
    { name: "Label Verification Line", location: "Factory Floor B", status: CameraStatus.MAINTENANCE, productType: ProductType.ALL },
  ];

  const cameras = await Promise.all(
    camerasData.map((data) =>
      prisma.camera.upsert({
        where: { id: camerasData.indexOf(data) + 1 },
        update: data,
        create: data,
      })
    )
  );

  console.log(`Created ${cameras.length} cameras.`);

  // ── Input images + anomaly results ─────────────────────────────────────────
  // Spread images over the past 30 days across the first 3 active cameras
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const imageSeeds: {
    cameraId: number;
    captureTime: Date;
    isAnomalous: boolean;
    anomalyScore: number;
  }[] = [
    // Bottle line — 18 images, 2 anomalies
    ...Array.from({ length: 16 }, (_, i) => ({
      cameraId: cameras[0].id,
      captureTime: new Date(now - (i + 1) * (day / 2)),
      isAnomalous: false,
      anomalyScore: 0.1 + Math.random() * 0.15,
    })),
    {
      cameraId: cameras[0].id,
      captureTime: new Date(now - 3 * day),
      isAnomalous: true,
      anomalyScore: 0.82,
    },
    {
      cameraId: cameras[0].id,
      captureTime: new Date(now - 7 * day),
      isAnomalous: true,
      anomalyScore: 0.76,
    },

    // Capsule line — 14 images, 3 anomalies
    ...Array.from({ length: 11 }, (_, i) => ({
      cameraId: cameras[1].id,
      captureTime: new Date(now - (i + 2) * day),
      isAnomalous: false,
      anomalyScore: 0.08 + Math.random() * 0.12,
    })),
    {
      cameraId: cameras[1].id,
      captureTime: new Date(now - 5 * day),
      isAnomalous: true,
      anomalyScore: 0.91,
    },
    {
      cameraId: cameras[1].id,
      captureTime: new Date(now - 12 * day),
      isAnomalous: true,
      anomalyScore: 0.68,
    },
    {
      cameraId: cameras[1].id,
      captureTime: new Date(now - 20 * day),
      isAnomalous: true,
      anomalyScore: 0.73,
    },

    // Pill packaging line — 10 images, 1 anomaly
    ...Array.from({ length: 9 }, (_, i) => ({
      cameraId: cameras[2].id,
      captureTime: new Date(now - (i + 1) * day),
      isAnomalous: false,
      anomalyScore: 0.05 + Math.random() * 0.1,
    })),
    {
      cameraId: cameras[2].id,
      captureTime: new Date(now - 15 * day),
      isAnomalous: true,
      anomalyScore: 0.85,
    },
  ];

  let imageCount = 0;
  let resultCount = 0;

  for (const seed of imageSeeds) {
    const image = await prisma.inputImage.create({
      data: {
        cameraId: seed.cameraId,
        captureTime: seed.captureTime,
      },
    });
    imageCount++;

    await prisma.anomalyResult.create({
      data: {
        imageId: image.id,
        isAnomalous: seed.isAnomalous,
        anomalyScore: parseFloat(seed.anomalyScore.toFixed(4)),
      },
    });
    resultCount++;
  }

  console.log(`Created ${imageCount} images and ${resultCount} anomaly results.`);
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
