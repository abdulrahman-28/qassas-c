"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { authServer, getPublicUser } from "@/lib/server";
import { UserRole } from "@/app/generated/prisma/enums";

// Neon Auth session cookie name (from @neondatabase/auth internals)
const SESSION_COOKIE = "__Secure-neon-auth.session_token";

export async function createUserAction(
  _prevState: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const me = await getPublicUser();
  if (me?.role !== "ADMIN") return { error: "Unauthorized" };

  const email = (formData.get("email") as string ?? "").trim();
  const name = (formData.get("name") as string ?? "").trim();
  const password = (formData.get("password") as string) ?? "";
  const role = formData.get("role") as UserRole;

  if (!email || !name || !password || !role) return { error: "All fields are required" };
  if (password.length < 8) return { error: "Password must be at least 8 characters" };

  // Check name uniqueness before touching the auth system to avoid orphaned auth accounts
  const existingName = await prisma.user.findUnique({ where: { username: name } });
  if (existingName) return { error: `A user named "${name}" already exists` };

  // Save admin's session before signUp.email — that call creates a new session
  // for the new user and overwrites the admin's session cookie
  const cookieStore = await cookies();
  const adminSession = cookieStore.get(SESSION_COOKIE);

  try {
    const authResult = await authServer.signUp.email({ email, password, name });

    if (authResult.error) {
      return { error: authResult.error.message ?? "Failed to create account" };
    }

    const uid = authResult.data?.user?.id;
    if (!uid) return { error: "Auth service did not return a user ID" };

    await prisma.user.create({
      data: { id: uid, username: name, role, passwordHash: "not null" },
    });

    // Restore admin's session so the admin stays logged in
    if (adminSession) {
      cookieStore.set(SESSION_COOKIE, adminSession.value, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
      });
    }

    revalidatePath("/operators");
    revalidatePath("/dashboard");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong" };
  }
}

export async function deleteUserAction(userId: string): Promise<{ error?: string }> {
  const me = await getPublicUser();
  if (me?.role !== "ADMIN") return { error: "Unauthorized" };
  if (me.id === userId) return { error: "You cannot delete your own account" };

  try {
    await prisma.user.delete({ where: { id: userId } });
    revalidatePath("/operators");
    revalidatePath("/dashboard");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong" };
  }
}
