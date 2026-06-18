import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getPublicUser } from "@/lib/server";

export const maxDuration = 300;

const PYTHON_API_URL = process.env.PYTHON_API_URL;

type PythonResult = {
  is_anomalous: boolean;
  score: number;
  threshold: number;
  coverage: number;
  metrics: Record<string, number>;
  heatmap: string;
  reconstructed: string;
};

export async function POST(req: NextRequest) {
  try {
    const user = await getPublicUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!PYTHON_API_URL) {
      return NextResponse.json({ error: "PYTHON_API_URL is not configured on the server." }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const cameraIdRaw = formData.get("cameraId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const pythonForm = new FormData();
    pythonForm.append("file", file);

    const cameraId = cameraIdRaw ? parseInt(cameraIdRaw) : null;
    console.log(`[detect] cameraId received: ${cameraIdRaw} → parsed: ${cameraId}`);

    if (cameraId) {
      const camera = await prisma.camera.findUnique({
        where: { id: cameraId },
        select: { productType: true },
      });
      if (camera) {
        const normalizedType = camera.productType.toLowerCase();
        console.log(`[detect] camera.productType: '${camera.productType}' → sending to Python: '${normalizedType}'`);
        pythonForm.append("product_type", normalizedType);
      } else {
        console.log(`[detect] WARNING: camera id=${cameraId} not found in DB — product_type will default to 'all'`);
      }
    } else {
      console.log(`[detect] No cameraId provided — product_type will default to 'all'`);
    }

    let pythonResult: PythonResult;
    try {
      const res = await fetch(`${PYTHON_API_URL}/predict`, {
        method: "POST",
        headers: { "ngrok-skip-browser-warning": "true" },
        body: pythonForm,
      });
      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json(
          { error: `Model API returned an error: ${text.slice(0, 200)}` },
          { status: 502 },
        );
      }
      pythonResult = await res.json();
    } catch {
      return NextResponse.json(
        { error: "Could not reach the model API. Make sure the Python server is running and PYTHON_API_URL is correct." },
        { status: 502 },
      );
    }

    // Save to DB
    const image = await prisma.inputImage.create({ data: { cameraId } });
    const savedResult = await prisma.anomalyResult.create({
      data: {
        imageId: image.id,
        isAnomalous: pythonResult.is_anomalous,
        anomalyScore: pythonResult.score,
        threshold: pythonResult.threshold ?? null,
        coverage: pythonResult.coverage ?? null,
        metrics: pythonResult.metrics ?? undefined,
        heatmapData: pythonResult.heatmap ?? null,
        reconstructedData: pythonResult.reconstructed ?? null,
      },
    });

    if (pythonResult.is_anomalous) {
      const cam = cameraId
        ? await prisma.camera.findUnique({ where: { id: cameraId }, select: { name: true } })
        : null;
      await prisma.notification.create({
        data: {
          resultId: savedResult.id,
          message: `Anomaly detected on ${cam?.name ?? "unknown line"} — score ${pythonResult.score.toFixed(4)}`,
        },
      });
    }

    return NextResponse.json(pythonResult);
  } catch (err) {
    console.error("[/api/detect]", err);
    return NextResponse.json(
      { error: "An unexpected server error occurred. Check the server logs." },
      { status: 500 },
    );
  }
}
