/**
 * Seeds the two fixed users from environment variables (spec §5). Signup isn't
 * needed for v1, so we upsert by email — running this repeatedly is safe and
 * will refresh the password/displayName from the current env values.
 *
 * Run with: pnpm db:seed
 */
import process from "node:process";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Load .env (DATABASE_URL + SEED_* vars); tsx doesn't do this automatically.
try {
  process.loadEnvFile();
} catch {
  // No .env file — rely on the ambient environment (e.g. in a container).
}

const prisma = new PrismaClient();

interface SeedUser {
  email: string;
  password: string;
  displayName: string;
}

function readSeedUser(index: 1 | 2): SeedUser {
  const email = process.env[`SEED_USER${index}_EMAIL`];
  const password = process.env[`SEED_USER${index}_PASSWORD`];
  const displayName = process.env[`SEED_USER${index}_NAME`];
  if (!email || !password || !displayName) {
    throw new Error(
      `Missing seed env vars for user ${index}: set SEED_USER${index}_EMAIL, ` +
        `SEED_USER${index}_PASSWORD and SEED_USER${index}_NAME (see .env.example).`,
    );
  }
  return { email: email.trim().toLowerCase(), password, displayName };
}

async function upsertUser(user: SeedUser) {
  const passwordHash = await bcrypt.hash(user.password, 12);
  const record = await prisma.user.upsert({
    where: { email: user.email },
    update: { passwordHash, displayName: user.displayName },
    create: { email: user.email, passwordHash, displayName: user.displayName },
  });
  console.log(`  ✓ ${record.displayName} <${record.email}>`);
}

async function main() {
  console.log("Seeding users…");
  await upsertUser(readSeedUser(1));
  await upsertUser(readSeedUser(2));
  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
