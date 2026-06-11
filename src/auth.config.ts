import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config. Contains NO providers (those pull in bcrypt/Prisma,
 * which can't run at the edge) — only what `proxy.ts` needs to gate routes by
 * reading the JWT session. The full config with providers lives in `auth.ts`.
 */
export const authConfig = {
  trustHost: true, // self-hosted: trust the deployment host
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    /**
     * Route protection. Runs in the proxy (edge). Returning false redirects to
     * the signIn page; returning a Response performs a custom redirect. Because
     * both the proxy and server components read the same JWT, they always agree
     * — no split-brain redirect loop.
     */
    authorized({ auth, request }) {
      const isLoggedIn = Boolean(auth?.user);
      const isLoginPage = request.nextUrl.pathname === "/login";

      if (isLoginPage) {
        if (isLoggedIn) return Response.redirect(new URL("/", request.nextUrl));
        return true;
      }
      return isLoggedIn;
    },
    // Carry the user id onto the token and expose it on the session.
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
