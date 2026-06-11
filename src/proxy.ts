import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

/**
 * Edge route protection (Next.js "proxy" convention), driven by Auth.js. The
 * `authorized` callback in auth.config.ts decides access by reading the JWT
 * session — no DB access here. This is UX, not the security boundary: server
 * components and actions re-check the session via `auth()`.
 */
const { auth } = NextAuth(authConfig);

export const proxy = auth((req) => {
  // The `authorized` callback already decided access; nothing else to do.
  void req;
  return undefined;
});

export const config = {
  // Run on everything except Auth.js endpoints, Next internals, and static assets.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
