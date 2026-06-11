# Household Ledger

A small web app for two people who live together and split shared ("partner")
expenses **proportionally to each month's income**. One person typically fronts
costs during the month; at month-end the app computes who owes whom.

The settlement is a single, order-independent formula (see
[`expense-splitter-spec.md`](./expense-splitter-spec.md) §2): whoever fronts a
shared expense simply raises their "paid", which lowers what they owe at
settlement — so timing and order never require manual recalculation.

## Stack

- **Next.js 16** (App Router, React 19) — UI + server actions in one app.
- **SQLite via Prisma 6** — file-based, zero-cost, perfect for two users.
- **Auth.js (NextAuth v5)** — Credentials provider over our own `User` table
  (bcrypt), stateless JWT sessions, no DB adapter or third-party service.
- **Tailwind CSS v4** — design tokens live in `app/globals.css`.
- **Vitest** — unit tests for the settlement math.

## Getting started

```bash
pnpm install

# 1. Configure environment
cp .env.example .env
#    then edit .env: set a strong AUTH_SECRET and the two seed users.
#    Generate a secret with:
#    node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"

# 2. Create the database schema
pnpm db:migrate

# 3. Seed the two users (idempotent — safe to re-run)
pnpm db:seed

# 4. Run the app
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with one of the
seeded accounts. There's no signup — the two users are fixed (spec §3) and seeded
from `SEED_USER*` env vars.

## Scripts

| Command            | What it does                                  |
| ------------------ | --------------------------------------------- |
| `pnpm dev`         | Run the dev server.                           |
| `pnpm build`       | Production build.                             |
| `pnpm test`        | Run the settlement unit tests (Vitest).       |
| `pnpm db:migrate`  | Apply Prisma migrations (creates the DB).     |
| `pnpm db:seed`     | Upsert the two users from `.env`.             |
| `pnpm db:studio`   | Browse the database with Prisma Studio.       |

## How it works

- **Money** is stored and computed as integer **cents** everywhere; rounding
  happens only when splitting the shared total into each person's share, using
  the largest-remainder method so the rounded shares always sum to the exact
  total. The engine is a pure function in `lib/settlement.ts` (fully unit-tested).
- **Income privacy** (spec §4) is enforced **server-side** in `lib/data.ts`: when
  a user marks a month's income private, the raw amount is stripped from any
  response sent to the *other* user — it never reaches their browser. The ratio
  and resulting "owed" share stay visible (the split is still correct); only the
  raw number is hidden. The privacy flag is frozen per income record, so a month
  entered private stays private in history.
- **Auth** is handled by Auth.js v5. `auth.config.ts` holds the edge-safe config
  (used by `proxy.ts` to gate routes via the JWT `authorized` callback);
  `auth.ts` adds the Credentials provider (bcrypt against the `User` table). The
  proxy and server components read the *same* JWT, so they can't disagree — which
  is what eliminated the earlier redirect loop. The proxy is UX only; pages
  re-check the session with `auth()`.

## Data & backups

The entire database is a single SQLite file (`prisma/dev.db` locally; in
production, point `DATABASE_URL` at a file on a persistent volume). **That file
is the only backup target** — copy it off-host periodically (cron + `scp`/rclone,
or a volume snapshot) once it holds real data.

## Docker

The Docker files live in `docker/` (`Dockerfile`, `docker-compose.yml`,
`docker-entrypoint.sh`). The build context is the **repo root** — `.dockerignore`
stays there because that's where Docker reads it from. On boot the container
applies migrations (`prisma migrate deploy`) and seeds the two users (idempotent),
then starts Next.js on port 3000. SQLite lives on a mounted volume at
`/data/app.db`.

Run it locally (from the repo root):

```bash
docker compose -f docker/docker-compose.yml up --build
# then add a temporary port mapping if you want to reach it from the host:
#   docker build -f docker/Dockerfile -t household-ledger .
#   docker run -p 3000:3000 -v hl-data:/data \
#     -e DATABASE_URL=file:/data/app.db -e AUTH_SECRET=… \
#     -e SEED_USER1_EMAIL=… (etc) household-ledger
```

The compose file deliberately has **no host port mapping and no reverse-proxy
service** — that's handled by Dokploy's Traefik (see below).

## Deploying on Dokploy

The Droplet already runs Dokploy, so deployment is done through its dashboard
(spec §5b). Traefik handles routing and TLS — **do not add Caddy/nginx.**

1. **Push** this repo (the `docker/` folder holds the build files) to GitHub/GitLab.
2. In Dokploy: create a project → add a **Compose** service → point its Compose Path
   at `docker/docker-compose.yml`. (The build context is the repo root, set via
   `context: ..` in the compose file.)
3. **Persistent storage:** the compose file declares a named volume `db-data`
   mounted at `/data`. Confirm it's preserved across redeploys before entering real
   data — this is the one thing easy to get wrong. The DB is `file:/data/app.db`.
4. **Environment:** in the service's Environment settings, set:
   - `AUTH_SECRET` — a long random string
     (`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`).
   - `SEED_USER1_EMAIL` / `SEED_USER1_PASSWORD` / `SEED_USER1_NAME` and the same for
     `SEED_USER2_*`.
   `DATABASE_URL` is already fixed to the volume path in `docker-compose.yml`.
5. **Domain + HTTPS:** add an `A` record for your subdomain (e.g.
   `split.yourdomain.com`) → Droplet IP, then in the service's Domains settings add
   that subdomain with **HTTPS / Let's Encrypt** and target **port 3000**. Auth.js
   runs with `trustHost`, so it honors the host/proto Traefik forwards — no
   `AUTH_URL` needed.
6. **Redeploys** re-run migrations and the idempotent seed automatically; the volume
   keeps your data.

> Verified locally: image builds, first boot migrates + seeds, login works, and the
> database persists across a full container recreation on the same volume.

## Project layout

All application code lives under `src/`; configuration, `prisma/`, `public/`, and
the Docker files stay at the repository root.

```
src/                        ── all application code ──
  auth.config.ts            Edge-safe Auth.js config (route protection)
  auth.ts                   Auth.js + Credentials provider (bcrypt)
  proxy.ts                  Edge route protection (wraps Auth.js)
  app/
    api/auth/[...nextauth]/ Auth.js route handler
    login/                  Sign-in page
    month/[monthKey]/       Month dashboard (settlement, income, expenses)
    history/                Past months
    auth-actions.ts         signIn / signOut server actions
    month-actions.ts        create / edit / delete expense, save income
  components/               UI primitives (ui/) and composite components
  lib/
    settlement.ts(.test.ts) Pure settlement engine + tests
    data.ts                 Server-side data layer (enforces income privacy)
    auth.ts                 Password hashing/verification + SafeUser type
    current-user.ts         getCurrentUser / requireUser via the Auth.js session
    money.ts / month.ts     Cents and monthKey helpers
    validation.ts           Zod input schemas
  types/next-auth.d.ts      Session/JWT type augmentation (user id)

── repository root ──
docker/                     Dockerfile, docker-compose.yml, docker-entrypoint.sh
prisma/                     Schema, migrations, seed
public/                     Static assets
.dockerignore               (must stay at root — it's the build-context root)
next.config.mjs, tsconfig.json, package.json, .env(.example)
```

The `@/` import alias points at `src/` (e.g. `@/lib/data` → `src/lib/data`).
