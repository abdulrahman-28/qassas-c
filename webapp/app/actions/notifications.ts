"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getPublicUser } from "@/lib/server";

export async function markAllNotificationsRead(): Promise<void> {
  const me = await getPublicUser();
  if (!me) return;

  const cameras = await prisma.camera.findMany({
    where: { assignedToId: me.id },
    select: { id: true },
  });
  const cameraIds = cameras.map((c) => c.id);
  if (cameraIds.length === 0) return;

  const toMark = await prisma.notification.findMany({
    where: {
      isRead: false,
      result: { image: { cameraId: { in: cameraIds } } },
    },
    select: { id: true },
  });

  if (toMark.length > 0) {
    await prisma.notification.updateMany({
      where: { id: { in: toMark.map((n) => n.id) } },
      data: { isRead: true },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/");
}
