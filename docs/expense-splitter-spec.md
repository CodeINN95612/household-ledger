# Shared Expense Splitter — Specification & Requirements

## 1. Purpose

A small web app for two people (extensible later) who live together and split shared
("partner") expenses **proportionally to each month's income**. One person typically fronts
costs during the month; at month-end the app computes who owes whom and how much.

The core problem this solves: today the bookkeeping is done manually, and whenever the
non-fronting partner pays for a shared expense, the whole calculation has to be redone by
hand. This app makes who-paid-what just another input to a single settlement formula, so
order and timing never require manual revision.

---

## 2. Core Concept (read this first — it drives the whole design)

Do **not** model expenses as "X owes Y." Model a **shared pool** and settle once per period.

For each settlement period (a calendar month):

1. **Total shared cost** = sum of all expenses tagged `shared` in that month.
2. Each member enters their **income for that month**. Their **share ratio** =
   their income ÷ combined income.
3. Each member's **owed** = share ratio × total shared cost.
4. Each member's **paid** = sum of shared expenses they fronted that month.
5. Each member's **balance** = paid − owed.
   - Positive balance → they are owed money.
   - Negative balance → they owe money.
6. Settlement: members with negative balances pay members with positive balances until
   everyone is at zero. For two people this is a single transfer.

This formula is order-independent. A partner paying for a shared expense simply increases
their `paid`, which automatically reduces what they owe at settlement. Nothing needs
recalculating by hand.

**Worked example (two people):**
Combined month income = $5,000 (A: $3,000 = 60%, B: $2,000 = 40%).
Shared expenses total = $1,000. A fronted $900, B fronted $100.
- A owed = $600, paid = $900 → balance +$300.
- B owed = $400, paid = $100 → balance −$300.
- Settlement: B sends A $300.

---

## 3. Scope

### In scope (v1 — minimal working version)
- Simple email + password auth for a fixed small set of users (you and your partner).
- Add / edit / delete expenses, each tagged `shared` or `personal`.
- Personal expenses are recorded but **excluded** from the shared pool (e.g. solo McDonald's,
  paying for a date). They exist only so a user can keep their own record; they never affect
  settlement.
- Per-month income entry per user, with an optional **private** flag.
- Month-end settlement view: total shared cost, each person's share / paid / owed / balance,
  and the final transfer(s).
- History of past months (expenses, settlements) that respects the privacy flag.

### Explicitly out of scope for v1 (note as "future" only)
- More than the initial members / open group management.
- Reporting dashboards, charts, analytics, AI analysis.
- Joint-account integration or bank syncing.
- Multi-currency.
- Mobile app (responsive web is enough).

Keep v1 deliberately small. These are listed only so the architecture doesn't actively
block them later — not to be built now.

---

## 4. Privacy Requirement (important — get this exactly right)

Income for a given month can be marked **private** by the user who entered it.

- The **exact private income amount** must never be shown to the other user, anywhere,
  including all historical views.
- The settlement math still uses the real amount (the ratio and the resulting "owed" share
  are still correct and visible — only the raw income number is hidden).
- In history, the other user should see the income as hidden/private (e.g. "Private") with
  **no indication of the value**. The owner always sees their own real values.
- The privacy flag is stored **per income record per month** — it is part of the saved
  history, not a live toggle that retroactively reveals or hides past months. If a month
  was entered private, it stays private in history for the other user permanently.

Rule of thumb for implementation: the API must filter private income amounts **server-side**
based on the requesting user, never send the raw value to the client and hide it in the UI.

---

## 5. Tech Stack (cheap, Docker-deployable to the existing DigitalOcean Droplet)

The Droplet is already paid for, so the goal is a single self-contained app deployed with
`docker compose up -d`. No external paid services.

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js + TypeScript | One language across stack; great Docker support. |
| Framework | Next.js (App Router) | Frontend + API routes in one deployable container; simple. |
| DB | SQLite (via Prisma) | Zero-cost, file-based, perfect for 2 users; one file to back up. Prisma makes a later move to Postgres trivial. |
| ORM | Prisma | Type-safe queries, easy migrations. |
| Auth | Auth.js (NextAuth) credentials provider, or Lucia | Simple email+password for a fixed user set. No third-party billing. |
| Styling | Tailwind CSS | Fast, no design overhead. |
| Reverse proxy / TLS | **Handled by Dokploy (Traefik)** — do NOT add Caddy/nginx | Dokploy already runs Traefik and issues Let's Encrypt certs from its dashboard. A second proxy would conflict. |
| Container / deploy | Docker Compose **via Dokploy** | The Droplet already runs Dokploy; deploy this as a Compose service in its dashboard. |

Notes for the builder:
- SQLite DB file lives on a Docker volume so it survives container rebuilds. In Dokploy,
  use a **named volume or a bind mount under the service's persistent path** so redeploys
  don't wipe it. **This file is the single backup target.**
- The Compose file needs only **one** service: `app` (Next.js). No Caddy, no nginx — Dokploy's
  Traefik handles routing and HTTPS. (SQLite needs no separate DB service.)
- The app must listen on a fixed internal port (e.g. 3000); Dokploy/Traefik routes the domain
  to it. Do not publish host ports manually or add reverse-proxy labels by hand unless the
  Dokploy UI doesn't cover it.
- Seed the two users at first boot (or a one-off script), since signup isn't needed for v1.
- If Postgres is preferred later, Dokploy can provision a managed Postgres from its dashboard
  and you'd point Prisma at it via an env var — but SQLite is the cheaper/simpler default here.

---

## 5b. Deployment on Dokploy (notes for me, not the agent)

The Droplet already runs Dokploy, so deployment is done through its dashboard rather than
SSH + `docker compose up`. Rough flow:

1. **Push the repo** (with `Dockerfile` + `docker-compose.yml`) to GitHub/GitLab.
2. In Dokploy: create a project → add a service of type **Compose** → point it at the repo
   and the path to `docker-compose.yml`. (Dokploy also supports auto-deploy via a webhook on
   push, if you want that later.)
3. **Persistent storage:** make sure the SQLite file maps to a persistent volume/mount in the
   service config so a redeploy doesn't wipe your data. This is the one thing easy to get
   wrong — verify it before entering real data.
4. **Domain + HTTPS:** in the service's Domains settings, add a subdomain (e.g.
   `split.yourdomain.com`) and enable **HTTPS with Let's Encrypt**. First create an `A` record
   pointing that subdomain at the Droplet's IP. Dokploy/Traefik handles the cert — you don't
   add Caddy or nginx yourself.
5. **Env vars:** set secrets (auth secret, etc.) in Dokploy's UI; it writes them to a `.env`
   beside the compose file. Reference them with `${VAR_NAME}` in `docker-compose.yml`, or use
   `env_file` to inject them all.
6. **Backups:** the SQLite file on its volume is the only backup target. Dokploy has scheduled
   backup support for its managed databases, but since SQLite is just a file, the simplest
   route is a periodic copy of that file off the Droplet (cron + `scp`/rclone, or snapshot the
   volume). Worth setting up once there's real data you'd hate to lose.

Key correction vs. a generic Docker setup: **no Caddy.** Dokploy runs Traefik under the hood
and terminates TLS for you, so the compose file is just the app itself.

---


```
User
  id            (pk)
  email         (unique)
  passwordHash
  displayName

Expense
  id            (pk)
  date          (the expense date)
  monthKey      (e.g. "2026-06" — the settlement period it belongs to)
  description
  amount        (decimal, store as integer cents to avoid float errors)
  type          (enum: "shared" | "personal")
  paidByUserId  (fk -> User)
  createdAt
  updatedAt

Income
  id            (pk)
  userId        (fk -> User)
  monthKey      (e.g. "2026-06")
  amount        (integer cents)
  isPrivate     (boolean)        // frozen into history per record
  createdAt
  updatedAt
  // unique constraint on (userId, monthKey)

Settlement   (optional in v1 — can be computed on the fly)
  id
  monthKey
  computedAt
  // store a JSON snapshot of the result if you want immutable history,
  // otherwise recompute from Expense + Income each time the month is viewed.
```

Money: store all amounts as **integer cents**, never floats. Round shares at the final
display step only.

---

## 7. Key Screens / Flows

1. **Login** — email + password.
2. **Current month dashboard**
   - List of this month's expenses (description, amount, paid by, shared/personal).
   - Quick "add expense" form (date, description, amount, shared/personal, paid by).
   - Each user's income-entry field for the month + a "keep private" checkbox.
   - Live settlement summary once both incomes are entered.
3. **Settlement summary** (per month)
   - Total shared cost, each person's ratio, owed, paid, balance, and the resulting transfer.
   - Respects privacy: other user's private income shows as "Private," ratio/owed still shown.
4. **History** — list of past months; click in to see that month's expenses and settlement,
   with the same privacy rules applied server-side.

---

## 8. Edge Cases to Handle
- Income not yet entered by one/both users → show settlement as "pending," don't compute a
  misleading ratio.
- Zero combined income for a month → avoid divide-by-zero; show a clear message.
- Editing an expense after a month was viewed → recompute settlement (don't cache stale
  numbers unless you snapshot settlements deliberately).
- Deleting an expense → settlement updates accordingly.
- Rounding: the sum of each person's rounded "owed" must equal the total shared cost (assign
  any 1-cent rounding remainder to one person deterministically).

---

## 9. Acceptance Criteria (v1 is "done" when…)
1. Both users can log in with email + password.
2. Either user can add shared and personal expenses; personal ones never affect settlement.
3. Either user can enter their monthly income and optionally mark it private.
4. The settlement view correctly computes share / paid / owed / balance and the final
   transfer per the formula in section 2.
5. A user can never see the other user's private income amount, in current or historical
   views, and this is enforced server-side.
6. Past months are viewable in history with privacy preserved.
7. The whole thing deploys on the existing Droplet as a Dokploy Compose service, is served
   over HTTPS on a domain/subdomain (TLS via Dokploy's Let's Encrypt), and the SQLite data
   persists across redeploys and container restarts.

---

## 10. Build Notes for Claude Code
- Start with the data model and the settlement function (section 2) — write unit tests for
  the settlement math first, including the rounding and divide-by-zero cases.
- Enforce income privacy in the API layer (server-side filtering by requesting user), not
  in the UI.
- Provide a `Dockerfile` and a `docker-compose.yml` with a **single `app` service** (no
  reverse-proxy service — Dokploy's Traefik handles that), a seed script for the two users,
  and a documented persistent volume path for the SQLite file. Note in the README how the
  file is backed up.
- Keep the UI minimal and responsive; no design system beyond Tailwind defaults is needed.
