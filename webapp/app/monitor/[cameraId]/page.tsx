import { notFound, redirect } from "next/navigation";
import { getCameraById, getCameraHistory, getLineSummaries, getPublicUser } from "@/lib/server";
import MonitorClient from "./MonitorClient";

export default async function MonitorPage({ params }: { params: Promise<{ cameraId: string }> }) {
  const { cameraId } = await params;
  const id = parseInt(cameraId);

  const user = await getPublicUser();
  if (!user) redirect("/auth/sign-in");

  const [camera, history, lines] = await Promise.all([
    getCameraById(id),
    getCameraHistory(id, 25),
    getLineSummaries(user.id, user.role),
  ]);

  if (!camera) notFound();

  return <MonitorClient camera={camera} history={history} lines={lines} />;
}
