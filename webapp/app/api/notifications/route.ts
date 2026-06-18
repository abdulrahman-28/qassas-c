import { NextResponse } from "next/server";
import { getPublicUser, getNotificationsForUser } from "@/lib/server";

export async function GET() {
  const user = await getPublicUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notifications = await getNotificationsForUser(user.id);
  return NextResponse.json(notifications);
}
