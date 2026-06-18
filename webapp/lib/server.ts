import { createAuthServer } from "@neondatabase/auth/next/server";
import prisma from "./prisma";
import { CameraStatus, UserRole } from "@/app/generated/prisma/enums";

export const authServer = createAuthServer();

//gets the current user from the session and returns it
export async function getCurrentUser() {
  const session = await authServer.getSession();
  const user = session?.data?.user || null;
  console.log("Current user:", user?.id);

  return user;
}

//gets the public user from the database using the current user's id
export async function getPublicUser() {
  const uid = (await getCurrentUser())?.id;
  if (!uid) {
    console.log("No user ID found in session.");
    return null;
  }
  const user = await prisma.user.findUnique({
    where: { id: uid },
  });
  console.log("Public user:", user);
  return user;
}

export async function getAllUsers() {
  const users = await prisma.user.findMany();
  console.log("All users:", users);
  return users;
}

export async function getOperators() {
  return prisma.user.findMany({
    where: { role: "OPERATOR" },
    select: { id: true, username: true },
    orderBy: { username: "asc" },
  });
}

export async function createAuthUser(
  email: string,
  password: string,
  name: string,
) {
  const newUser = await authServer.signUp.email({
    email,
    password,
    name,
  });
  console.log("Created auth user:", newUser);
  return newUser;
}

export async function createPublicUser(
  uid: string,
  name: string,
  role: UserRole,
) {
  const publicUser = await prisma.user.create({
    data: {
      id: uid,
      username: name,
      role,
      passwordHash: "not null", // no password needed here — auth is handled by Better Auth
    },
  });
  return publicUser;
}

export async function getDashboardStats() {
  const [totalCameras, activeCameras, totalImages, totalAnomalies] =
    await Promise.all([
      prisma.camera.count(),
      prisma.camera.count({ where: { status: CameraStatus.ACTIVE } }),
      prisma.inputImage.count(),
      prisma.anomalyResult.count({ where: { isAnomalous: true } }),
    ]);
  return { totalCameras, activeCameras, totalImages, totalAnomalies };
}

export async function getCamerasWithStats() {
  const cameras = await prisma.camera.findMany({
    include: {
      assignedTo: { select: { username: true } },
      images: {
        select: {
          captureTime: true,
          result: { select: { isAnomalous: true } },
        },
      },
    },
    orderBy: { id: "asc" },
  });

  return cameras.map((cam) => {
    const sorted = [...cam.images].sort(
      (a, b) => b.captureTime.getTime() - a.captureTime.getTime(),
    );
    return {
      id: cam.id,
      name: cam.name,
      location: cam.location,
      status: cam.status,
      productType: cam.productType,
      assignedToId: cam.assignedToId ?? null,
      assignedTo: cam.assignedTo?.username ?? null,
      imageCount: cam.images.length,
      anomalyCount: cam.images.filter((img) => img.result?.isAnomalous).length,
      lastActive: sorted[0]?.captureTime ?? null,
    };
  });
}

export async function getCameraById(id: number) {
  return prisma.camera.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      location: true,
      status: true,
      productType: true,
      assignedTo: { select: { username: true } },
    },
  });
}

export async function getCameraHistory(cameraId: number, limit = 25) {
  const images = await prisma.inputImage.findMany({
    where: { cameraId, result: { isNot: null } },
    include: { result: { select: { isAnomalous: true, anomalyScore: true } } },
    orderBy: { captureTime: "desc" },
    take: limit,
  });
  return images.map((img) => ({
    id: img.id,
    captureTime: img.captureTime,
    isAnomalous: img.result!.isAnomalous,
    anomalyScore: img.result!.anomalyScore,
  }));
}

export async function getRecentResults(limit = 15) {
  const results = await prisma.anomalyResult.findMany({
    include: {
      image: {
        include: { camera: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return results.map((r) => ({
    id: r.id,
    isAnomalous: r.isAnomalous,
    anomalyScore: r.anomalyScore,
    createdAt: r.createdAt,
    cameraId: r.image.camera?.id ?? null,
    cameraName: r.image.camera?.name ?? "Unknown",
  }));
}

export async function getAdminDashboardData() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [cameras, operators, recentResults, scansToday, anomaliesToday] = await Promise.all([
    // cameras with per-line scan/anomaly counts
    prisma.camera.findMany({
      include: {
        assignedTo: { select: { id: true, username: true } },
        images: {
          select: {
            captureTime: true,
            result: { select: { isAnomalous: true } },
          },
        },
      },
      orderBy: { id: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "OPERATOR" },
      select: { id: true, username: true },
      orderBy: { username: "asc" },
    }),
    prisma.anomalyResult.findMany({
      include: {
        image: { include: { camera: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.inputImage.count({ where: { captureTime: { gte: startOfDay } } }),
    prisma.anomalyResult.count({ where: { isAnomalous: true, createdAt: { gte: startOfDay } } }),
  ]);

  const cameraStats = cameras.map((cam) => {
    const sorted = [...cam.images].sort(
      (a, b) => b.captureTime.getTime() - a.captureTime.getTime(),
    );
    return {
      id: cam.id,
      name: cam.name,
      location: cam.location,
      status: cam.status as string,
      productType: cam.productType as string,
      assignedToId: cam.assignedTo?.id ?? null,
      assignedTo: cam.assignedTo?.username ?? null,
      imageCount: cam.images.length,
      anomalyCount: cam.images.filter((img) => img.result?.isAnomalous).length,
      lastActive: sorted[0]?.captureTime ?? null,
    };
  });

  const totalScans = cameraStats.reduce((s, c) => s + c.imageCount, 0);
  const totalAnomalies = cameraStats.reduce((s, c) => s + c.anomalyCount, 0);

  const operatorStats = operators.map((op) => {
    const opCameras = cameraStats.filter((c) => c.assignedToId === op.id);
    const scans = opCameras.reduce((s, c) => s + c.imageCount, 0);
    const anomalies = opCameras.reduce((s, c) => s + c.anomalyCount, 0);
    const lastActive =
      opCameras
        .map((c) => c.lastActive)
        .filter(Boolean)
        .sort((a, b) => b!.getTime() - a!.getTime())[0] ?? null;
    return {
      id: op.id,
      username: op.username,
      lineCount: opCameras.length,
      scans,
      anomalies,
      rate: scans > 0 ? Math.round((anomalies / scans) * 100) : null,
      lastActive,
    };
  }).sort((a, b) => b.scans - a.scans);

  const recentResultsMapped = recentResults.map((r) => ({
    id: r.id,
    isAnomalous: r.isAnomalous,
    anomalyScore: r.anomalyScore,
    createdAt: r.createdAt,
    cameraId: r.image.camera?.id ?? null,
    cameraName: r.image.camera?.name ?? "Unknown",
  }));

  return {
    cameras: cameraStats,
    operatorStats,
    recentResults: recentResultsMapped,
    totals: {
      lines: cameraStats.length,
      activeLines: cameraStats.filter((c) => c.status === "ACTIVE").length,
      inactiveLines: cameraStats.filter((c) => c.status === "INACTIVE").length,
      maintenanceLines: cameraStats.filter((c) => c.status === "MAINTENANCE").length,
      unassignedLines: cameraStats.filter((c) => !c.assignedToId).length,
      operators: operators.length,
      totalScans,
      totalAnomalies,
      overallRate: totalScans > 0 ? Math.round((totalAnomalies / totalScans) * 100) : 0,
      scansToday,
      anomaliesToday,
    },
  };
}

export async function getLineSummaries(userId: string, role: string) {
  const where = role === "ADMIN" ? {} : { assignedToId: userId };
  return prisma.camera.findMany({
    where,
    select: { id: true, name: true, status: true },
    orderBy: { id: "asc" },
  });
}

export async function getCamerasByOperator(userId: string) {
  return prisma.camera.findMany({
    where: { assignedToId: userId },
    orderBy: { id: "asc" },
  });
}

export async function getOperatorCamerasWithStats(userId: string) {
  const cameras = await prisma.camera.findMany({
    where: { assignedToId: userId },
    include: {
      images: {
        select: {
          captureTime: true,
          result: { select: { isAnomalous: true } },
        },
      },
    },
    orderBy: { id: "asc" },
  });

  return cameras.map((cam) => {
    const sorted = [...cam.images].sort(
      (a, b) => b.captureTime.getTime() - a.captureTime.getTime(),
    );
    return {
      id: cam.id,
      name: cam.name,
      location: cam.location,
      status: cam.status,
      productType: cam.productType,
      imageCount: cam.images.length,
      anomalyCount: cam.images.filter((img) => img.result?.isAnomalous).length,
      lastActive: sorted[0]?.captureTime ?? null,
    };
  });
}

export async function getOperatorStats(userId: string) {
  const cameras = await prisma.camera.findMany({
    where: { assignedToId: userId },
    select: { id: true },
  });
  const cameraIds = cameras.map((c) => c.id);
  if (cameraIds.length === 0) {
    return { scansToday: 0, anomaliesToday: 0, anomalyRate: 0, totalScans: 0 };
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [scansToday, anomaliesToday, totalScans] = await Promise.all([
    prisma.inputImage.count({
      where: { cameraId: { in: cameraIds }, captureTime: { gte: startOfDay } },
    }),
    prisma.anomalyResult.count({
      where: {
        isAnomalous: true,
        image: { cameraId: { in: cameraIds }, captureTime: { gte: startOfDay } },
      },
    }),
    prisma.inputImage.count({
      where: { cameraId: { in: cameraIds } },
    }),
  ]);

  const anomalyRate = scansToday > 0 ? Math.round((anomaliesToday / scansToday) * 100) : 0;
  return { scansToday, anomaliesToday, anomalyRate, totalScans };
}

export async function getRecentAnomaliesForOperator(userId: string, limit = 15) {
  const cameras = await prisma.camera.findMany({
    where: { assignedToId: userId },
    select: { id: true },
  });
  const cameraIds = cameras.map((c) => c.id);
  if (cameraIds.length === 0) return [];

  const results = await prisma.anomalyResult.findMany({
    where: {
      isAnomalous: true,
      image: { cameraId: { in: cameraIds } },
    },
    include: {
      image: {
        select: {
          captureTime: true,
          camera: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return results.map((r) => ({
    id: r.id,
    anomalyScore: r.anomalyScore,
    createdAt: r.createdAt,
    captureTime: r.image.captureTime,
    cameraId: r.image.camera?.id ?? null,
    cameraName: r.image.camera?.name ?? "Unknown",
  }));
}

export async function getUnreadNotificationCount(userId: string) {
  const cameras = await prisma.camera.findMany({
    where: { assignedToId: userId },
    select: { id: true },
  });
  const cameraIds = cameras.map((c) => c.id);
  if (cameraIds.length === 0) return 0;

  return prisma.notification.count({
    where: {
      isRead: false,
      result: { image: { cameraId: { in: cameraIds } } },
    },
  });
}

export async function getNotificationsForUser(userId: string, limit = 20) {
  const cameras = await prisma.camera.findMany({
    where: { assignedToId: userId },
    select: { id: true },
  });
  const cameraIds = cameras.map((c) => c.id);
  if (cameraIds.length === 0) return [];

  const notifications = await prisma.notification.findMany({
    where: {
      result: { image: { cameraId: { in: cameraIds } } },
    },
    include: {
      result: {
        select: {
          anomalyScore: true,
          image: {
            select: { camera: { select: { id: true, name: true } } },
          },
        },
      },
    },
    orderBy: { timestamp: "desc" },
    take: limit,
  });

  return notifications.map((n) => ({
    id: n.id,
    message: n.message,
    isRead: n.isRead,
    timestamp: n.timestamp,
    cameraId: n.result.image.camera?.id ?? null,
    cameraName: n.result.image.camera?.name ?? "Unknown",
    anomalyScore: n.result.anomalyScore,
  }));
}

export async function getOperatorTrendData(userId: string) {
  const cameras = await prisma.camera.findMany({
    where: { assignedToId: userId },
    select: { id: true },
  });
  const cameraIds = cameras.map((c) => c.id);

  const days: { date: string; ts: number; anomalies: number; normal: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push({
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      ts: d.getTime(),
      anomalies: 0,
      normal: 0,
    });
  }

  if (cameraIds.length > 0) {
    const results = await prisma.anomalyResult.findMany({
      where: {
        image: { cameraId: { in: cameraIds } },
        createdAt: { gte: new Date(days[0].ts) },
      },
      select: { isAnomalous: true, createdAt: true },
    });

    results.forEach((r) => {
      const d = new Date(r.createdAt);
      d.setHours(0, 0, 0, 0);
      const day = days.find((x) => x.ts === d.getTime());
      if (day) {
        if (r.isAnomalous) day.anomalies++;
        else day.normal++;
      }
    });
  }

  return days.map(({ date, anomalies, normal }) => ({ date, anomalies, normal }));
}

export async function getOperatorHistory(
  userId: string,
  options: {
    lineId?: number;
    resultType?: "all" | "normal" | "anomaly";
    page?: number;
    limit?: number;
  } = {},
) {
  const { resultType = "all", page = 1, limit = 30 } = options;

  const cameras = await prisma.camera.findMany({
    where: { assignedToId: userId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const cameraIds = cameras.map((c) => c.id);
  if (cameraIds.length === 0) return { results: [], total: 0, cameras: [] };

  // Validate lineId belongs to this operator
  const lineId =
    options.lineId && cameraIds.includes(options.lineId)
      ? options.lineId
      : undefined;

  const where = {
    image: { cameraId: lineId ? lineId : { in: cameraIds } },
    ...(resultType === "anomaly"
      ? { isAnomalous: true }
      : resultType === "normal"
      ? { isAnomalous: false }
      : {}),
  };

  const [results, total] = await Promise.all([
    prisma.anomalyResult.findMany({
      where,
      include: {
        image: {
          select: {
            captureTime: true,
            camera: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.anomalyResult.count({ where }),
  ]);

  return {
    results: results.map((r) => ({
      id: r.id,
      isAnomalous: r.isAnomalous,
      anomalyScore: r.anomalyScore,
      createdAt: r.createdAt,
      cameraId: r.image.camera?.id ?? null,
      cameraName: r.image.camera?.name ?? "Unknown",
    })),
    total,
    cameras,
  };
}

export async function getAdminHistory(options: {
  lineId?: number;
  resultType?: "all" | "normal" | "anomaly";
  page?: number;
  limit?: number;
} = {}) {
  const { resultType = "all", page = 1, limit = 30 } = options;

  const cameras = await prisma.camera.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const where = {
    ...(options.lineId ? { image: { cameraId: options.lineId } } : {}),
    ...(resultType === "anomaly"
      ? { isAnomalous: true }
      : resultType === "normal"
      ? { isAnomalous: false }
      : {}),
  };

  const [results, total] = await Promise.all([
    prisma.anomalyResult.findMany({
      where,
      include: {
        image: {
          select: {
            captureTime: true,
            camera: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.anomalyResult.count({ where }),
  ]);

  return {
    results: results.map((r) => ({
      id: r.id,
      isAnomalous: r.isAnomalous,
      anomalyScore: r.anomalyScore,
      createdAt: r.createdAt,
      cameraId: r.image.camera?.id ?? null,
      cameraName: r.image.camera?.name ?? "Unknown",
    })),
    total,
    cameras,
  };
}

export async function getResultDetail(resultId: number, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  const result = await prisma.anomalyResult.findUnique({
    where: { id: resultId },
    include: {
      image: {
        include: {
          camera: {
            select: { id: true, name: true, location: true, productType: true, assignedToId: true },
          },
        },
      },
    },
  });
  if (!result) return null;
  // Operators can only view results from their own cameras
  if (user?.role !== "ADMIN" && result.image.camera?.assignedToId !== userId) return null;
  return result;
}

export async function createUser(
  email: string,
  password: string,
  name: string,
  role: UserRole,
) {
  const authUser = await createAuthUser(email, password, name);
  const uid = authUser.data?.user.id || "";

  const publicUser = await createPublicUser(uid, name, role);

  return publicUser;
}
