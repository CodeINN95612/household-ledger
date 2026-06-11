"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

export interface LoginState {
  error?: string;
}

/** Server action for the login form (used with useActionState). */
export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (error) {
    // A successful sign-in throws a NEXT_REDIRECT we must let propagate.
    if (error instanceof AuthError) {
      return { error: "Incorrect email or password." };
    }
    throw error;
  }
  return {};
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
