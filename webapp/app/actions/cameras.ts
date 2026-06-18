"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getPublicUser } from "@/lib/server";
import { ProductType, CameraStatus } from "@/app/generated/prisma/enums";

export async function updateCamera(
  cameraId: number,
  operatorId: string | null,
  productType: ProductType,
  status: CameraStatus,
  name: string,
  location: string,
) {
  const me = await getPublicUser();
  if (me?.role !== "ADMIN") throw new Error("Unauthorized");

  await prisma.camera.update({
    where: { id: cameraId },
    data: { assignedToId: operatorId, productType, status, name, location },
  });

  revalidatePath("/dashboard");
  revalidatePath("/lines");
}

export async function createCamera(
  _prevState: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const me = await getPublicUser();
  if (me?.role !== "ADMIN") return { error: "Unauthorized" };

  const name = (formData.get("name") as string ?? "").trim();
  const location = (formData.get("location") as string ?? "").trim();
  const productType = formData.get("productType") as ProductType;
  const operatorId = (formData.get("operatorId") as string ?? "").trim();

  if (!name || !location || !productType) return { error: "Name, location, and product type are required" };

  try {
    await prisma.camera.create({
      data: {
        name,
        location,
        productType,
        status: CameraStatus.ACTIVE,
        assignedToId: operatorId || null,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/lines");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong" };
  }
}
