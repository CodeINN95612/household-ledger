import "server-only";
import { auth } from "@/auth";
import type { SafeUser } from "./auth";

/**
 * The currently authenticated user (from the Auth.js session), or null.
 * Both the proxy and this read the same JWT, so they can never disagree.
 */
export async function getCurrentUser(): Promise<SafeUser | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return null;
  return {
    id: user.id,
    email: user.email ?? "",
    displayName: user.name ?? "",
  };
}

/** Like getCurrentUser but throws — for server actions that require auth. */
export async function requireUser(): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}
