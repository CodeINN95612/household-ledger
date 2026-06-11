import "server-only";
import bcrypt from "bcryptjs";

/**
 * Password helpers. Session handling now lives in Auth.js (see `auth.ts` and
 * `auth.config.ts`); this module only owns credential hashing/verification and
 * the app's safe user shape. Kept free of any `@/auth` import to avoid a cycle.
 */

/** A user as exposed to the app — never includes the password hash. */
export interface SafeUser {
  id: string;
  email: string;
  displayName: string;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
