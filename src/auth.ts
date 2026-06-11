import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { prisma } from "./lib/prisma";
import { verifyPassword } from "./lib/auth";
import { loginSchema } from "./lib/validation";

/**
 * Full Auth.js setup (Node runtime). Credentials provider verifies email +
 * password against our own User table with bcrypt — no DB adapter or external
 * service. Sessions are stateless JWTs (see auth.config.ts).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        // Always run a compare to avoid leaking which emails exist via timing.
        const hash =
          user?.passwordHash ??
          "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
        const ok = await verifyPassword(parsed.data.password, hash);
        if (!user || !ok) return null;

        return { id: user.id, email: user.email, name: user.displayName };
      },
    }),
  ],
});
