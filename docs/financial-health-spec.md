# Financial Health & Planning — Specification & Requirements (v2)

> **Companion to:** `docs/expense-splitter-spec.md` (v1). Read that first. v1 is built,
> deployed, and working — this document specifies what gets built **on top of it**. Nothing
> here replaces or changes the v1 settlement mechanics; v2 consumes them as an input.

---

## 1. Purpose & Vision

v1 answers a backward-looking question: *"where did the money go, and who owes whom?"*
v2 answers the forward-looking one: *"where is our money going, and will we get where we
want to be?"*

The two users are a couple with separate finances who split shared living costs
proportionally to income (v1). What they want from v2 is a **household money operating
system** — a tool they can run for years that keeps them:

1. **Fair to each other** — neither feels they're carrying the other.
2. **Free as individuals** — each has money that is truly theirs, no justification owed.
3. **Visibly building a shared future** — named goals with real progress and dates.

The deeply felt user problems v2 must solve, in the users' own framing:

- *"It is hard to know what is mine, what is savings, and what is what."* → a clean
  per-person monthly statement (§5, Layer 1).
- *"I want to make plans and project how the money of each of us is going to go."* → a
  projection engine with what-if scenarios (§5, Layer 2 — **the spine of v2**).
- *"How much are we both saving vs spending?"* → a small health dashboard (§5, Layer 4).
- *"Leverage the expense data we already track to make planning better."* → spending
  intelligence that feeds the forecast (§5, Layer 5).

---

## 2. The Financial Framework (domain model — read before designing anything)

v2 encodes a specific philosophy of household money. The tool's job is to make this
framework effortless to live by, not to be a generic budgeting app.

### 2.1 Order of operations (the core rule)

Each person's monthly money flows **top → bottom, in this order**:

```
① TOP — Future You (fixed %, paid FIRST, per person)
     • personal long-term savings        (their own wealth)
     • personal emergency fund           (their own safety)
     • shared goal fund(s)               (the couple's future — house, travel…)

② MIDDLE — Shared Life (ACTUAL cost, split proportionally to income)
     • the v1 settlement, unchanged: whoever fronted gets made whole;
       each person's share = income ratio × real shared spend

③ BOTTOM — Present You (the residual)
     • whatever remains is 100% that person's, untracked, no shame
```

Why this ordering matters (it is the fix for the users' previously failed plan):

- Savings are **percentages of actual income**, committed first — protected from
  lifestyle creep, and they auto-shrink in lean months (never overcommitted).
- The shared pool is **never pre-funded**. It settles at actual cost. This kills the
  "we pre-paid an envelope and the money is stuck / short" failure mode.
- **All month-to-month variability lands in discretionary** — the most flexible bucket.
  A heavy shared month just means a lighter discretionary month. Nothing else breaks.
- Discretionary is a **residual, not a budget**. It is not tracked or judged.

### 2.2 The float (a permanent, accepted fact — model it, don't fix it)

One user (the "fronting partner") pays effectively **all shared expenses during the
month** and is reimbursed by the other at month-end ("pay me when you get paid"). This
creates a permanent one-month offset: at any moment, a chunk of the fronting partner's
cash is locked in not-yet-reimbursed shared spending. It revolves and **never returns to
zero**.

Decisions already made by the users — the tool must respect these, not argue with them:

- **The offset stays.** Do NOT design prepayment of fixed costs or any mechanism that
  asks the non-fronting partner to pay twice or pay early. This was explicitly rejected.
- The non-fronting partner values knowing her leftover the moment she's paid; the
  current arrangement gives her that. Keep it.
- The fix is **conceptual**: treat the float as a carved-out reserve. Size it from
  history (≈ the peak out-of-pocket amount before reimbursement ≈ the other partner's
  share of one month's shared spend, rounded up). Show it, but **exclude it from the
  fronting partner's discretionary math** so it stops polluting "what's available."

### 2.3 Fixed vs variable shared spend

Shared expenses split into a **stable core** (rent, internet, gym — known on day one)
and a **wobbly edge** (food and other variable costs). The variable slice is a small
fraction of the total but 100% of the *uncertainty*. Projections and float sizing must
treat the two differently (rolling averages + seasonality for variable; face value for
fixed). See §5 Layer 5 and §7.

### 2.4 Deliberate fairness choices (configuration, not code)

These are values decisions the couple makes explicitly; the tool stores them as
settings and never hard-codes an answer:

- Couple-goal contributions: **proportional to income** vs **equal dollars**.
- Personal savings rate: same % for both, or deliberately different.
- The shared/personal boundary for expenses (already handled per-expense in v1).

### 2.5 The cadence (the tool must serve a rhythm, not just store data)

- **Monthly — "Settle & Sweep" (~15 min, together):** enter incomes, settle shared
  (v1), record each person's savings-bucket contributions, glance at the residual.
- **Quarterly — Check-in (~45 min):** review the health dashboard, goal progress,
  adherence; adjust a % if income changed.
- **Annually — Vision reset:** revisit the goals themselves; re-baseline percentages.

v2 should generate the quarterly and annual review summaries automatically (§5 Layer 7).

---

## 3. Glossary

| Term | Meaning |
|---|---|
| **Allocation rule** | A person's *intent*: "X% of my income goes to bucket Y each month." |
| **Fund** | A named pot of money with a purpose: personal or couple scope, optional target amount and target date. E.g. "House", "Emergency (A)", "Japan 2027". |
| **Sinking fund** | A fund for a known lumpy bill (insurance, car registration, holidays) fed monthly so the bill is pre-saved. Mechanically identical to any other fund. |
| **Contribution** | An actual movement of money into a fund in a given month (the *actual*, vs the allocation rule's *plan*). |
| **Statement** | The per-person monthly view: income − allocations − shared share = discretionary. |
| **Float / float reserve** | The fronting partner's permanently locked working capital (§2.2): live outstanding amount + the fixed reserve size carved out of discretionary. |
| **Discretionary (residual)** | What remains after allocations and shared share. Never budgeted, never judged. |
| **Scenario** | A what-if copy of the plan with one or more inputs changed, projected forward and compared to the baseline. |
| **Health dashboard** | The six summary metrics in §5 Layer 4. |

---

## 4. Scope

### In scope (v2)

- Allocation rules per person (percent-of-income, with optional fixed-amount override).
- Funds (personal & couple), contributions, targets, progress, projected completion dates.
- Per-person monthly statement (Layer 1).
- Projection engine, 6–24 months forward, with what-if scenarios (Layer 2).
- Health dashboard — the six metrics (Layer 4).
- Spending intelligence: fixed/variable classification, rolling averages, trends,
  gentle anomaly flags (Layer 5).
- Float tracker for the fronting partner (Layer 6).
- Plan-vs-actual adherence and auto-generated quarterly/annual review summaries (Layer 7).
- Privacy extended to personal funds/amounts (§6).

### Out of scope for v2 (future only — don't block, don't build)

- Bank syncing / account aggregation; balances are user-entered or derived from
  recorded contributions.
- Investment performance tracking (returns, tickers). A fund balance may grow only via
  contributions and optional manual balance corrections.
- Debt/loan management modules.
- More than the two users; multi-currency; native mobile apps.
- AI/chat features.

v1 functionality (expenses, incomes, settlement, history, privacy) is **untouched** —
v2 reads from it.

---

## 5. Features, by layer

Layer 2 (projection + scenarios) is the spine; everything else feeds it or makes its
output emotionally real. Layers are listed in dependency order, which is also a sensible
build order.

### Layer 1 — Per-person monthly statement (foundation)

For each user, for any month, one clean statement:

```
Income (this month)                          $3,000
  − Personal savings (10%)                    −$300   → fund: "Savings (A)"
  − Emergency (10%)                           −$300   → fund: "Emergency (A)"
  − Couple goal (10%)                         −$300   → fund: "House"
  − Shared living share (from settlement)     −$525   ← ACTUAL cost, floats
  ─────────────────────────────────────────────────
  = Discretionary (yours)                    $1,575
  [Float reserve: $800 — carved out, not counted]     ← fronting partner only
```

Requirements:
- Allocation lines come from the user's allocation rules applied to that month's
  **actual entered income**.
- The shared-living line is the user's `owedCents` from the v1 settlement for that
  month. If settlement is `pending` (an income missing), show the statement with the
  shared line marked *estimated* (from the spending-intelligence forecast, Layer 5)
  and clearly labeled as such.
- Show **planned** allocation (rule × income) and **actual** contribution side by side
  once contributions are recorded; the discretionary residual uses actuals when
  present, plan otherwise.
- The float-reserve line appears only on the fronting partner's statement (§2.2),
  visually separated, never subtracted twice.

### Layer 2 — Projection engine & scenarios (the spine)

Project each person's statement and every fund balance forward **6–24 months**
(user-selectable horizon).

Inputs (auto-derived, each manually overridable):
- **Income**: per-person expected monthly income, defaulting to recent actuals
  (e.g. median of last 3 entered months), with per-month manual overrides for known
  raises/bonuses/lean months.
- **Allocation rules**: as configured.
- **Shared spend forecast**: from Layer 5 — fixed lines at face value + variable lines
  at rolling average, with seasonality if detectable (e.g. December food bump).
- **One-off planned events**: optional user-entered future items ("car insurance $1,200
  in March", "vacation $2,000 in August"), assignable as shared or personal and to a
  sinking fund.

Outputs:
- Month-by-month projected discretionary for each person.
- Each fund's projected balance curve and **projected completion date**
  ("House reaches $40,000 in March 2029").
- Emergency-runway trajectory.

Scenarios (the killer feature):
- Clone the baseline plan, change any input(s) — an allocation %, expected income, a
  shared-cost assumption, a one-off event — and see the deltas side-by-side:
  > "House contribution 10% → 15%: down payment arrives **8 months sooner**, your
  > discretionary drops **~$240/month**."
- Scenarios are saveable, nameable, comparable against baseline, and can be
  **promoted to become the new plan** (which just updates the allocation rules /
  assumptions).
- Always show *both sides of the trade-off* (goal date moved AND discretionary impact,
  for each person) — this is a couples' decision tool, not an optimizer.

### Layer 3 — Funds & goals

- CRUD for funds: name, scope (`personal` | `couple`), owner (personal only), optional
  target amount, optional target date, optional `isPrivate` (personal funds only),
  optional "sinking fund" flavor (linked recurring bill description).
- Funds are **named after the dream** — encourage this in UI copy ("House", "Japan
  2027"), not "Savings Account 2".
- Each fund shows: current balance (sum of contributions ± manual corrections),
  progress bar vs target, contribution rate, and projected completion date from
  Layer 2.
- Contributions are recorded per user / per month / per fund — normally during the
  monthly Settle & Sweep. Quick-entry: one screen that pre-fills each fund with the
  planned amount (rule × actual income) and lets the user confirm/adjust all at once.
- Manual balance correction entries are allowed (e.g. interest earned, a withdrawal),
  recorded as explicit adjustment line items so history stays honest.
- Withdrawals from a fund (goal achieved, emergency used) are first-class: they reduce
  the balance and are visible in fund history.

### Layer 4 — Health dashboard (six numbers)

One screen, computed from existing data, glanceable in 30 seconds:

1. **Combined savings rate** = (sum of both users' contributions) ÷ (combined income),
   this month and trailing 3/12-month averages.
2. **Per-person savings rate** — same, per user (respecting privacy, §6).
3. **Emergency runway** = emergency-fund balances ÷ trailing average monthly essential
   spend (shared total + an optional per-user personal-essentials estimate). Show as
   "4.2 months". Target band 3–6 months, visually indicated.
4. **Goal funding ratio + ETA** per couple fund = balance ÷ target, plus the Layer-2
   projected date.
5. **Shared burn trend** — trailing shared spend per month, sparkline, flag sustained
   creep (e.g. 3 consecutive months above the prior 6-month average).
6. **Discretionary comfort** — is each person's *actual* spending pattern consistent
   with their residual? In v2, without bank data, approximate honestly: show the
   residual trend and (optionally) let a user self-report "overshot / fine / under" each
   month. Do **not** fake precision the data can't support.

### Layer 5 — Spending intelligence (leveraging the v1 tracker)

- **Fixed/variable classification** of shared expenses. Heuristic auto-detection
  (same description ± same amount recurring monthly ⇒ fixed) with manual override —
  e.g. a simple per-expense or per-description "recurring/fixed" tag. Rent, internet,
  gym ⇒ fixed; food ⇒ variable.
- **Rolling averages** (3- and 6-month) per category/description-group of variable
  shared spend; these feed the Layer-2 forecast and the float sizing.
- **Trend lines** per group — surface lifestyle creep early.
- **Anomaly flags** — "groceries ran 30% above your 6-month average" — gentle and
  informational, never nagging or judging. One line, dismissible.
- v1 has no category field; v2 may add an optional lightweight `category` to expenses
  (or derive groups from descriptions). Keep entry friction near zero — category must
  be optional and the app fully functional without it.

### Layer 6 — Float tracker (fronting partner)

- Show the fronting partner's **live outstanding float**: shared spend they've fronted
  this month minus reimbursements received — i.e., the v1 running balance, reframed.
- Show the **recommended reserve size**: max observed month-end out-of-pocket over the
  trailing N months (default 6), rounded up to a friendly number; user can pin a manual
  value.
- The reserve appears on the statement (Layer 1) as carved-out, and Layer-2 projections
  exclude it from the fronting partner's available cash.
- Tone: this is *visibility and quarantine*, not a problem to be fixed. No nudges to
  change the arrangement (§2.2).

### Layer 7 — Plan vs actual + review rhythm

- **Adherence view**: per user per month, planned allocation vs actual contribution per
  fund, with a simple hit/partial/missed indicator and a trailing adherence %.
  Accountability without spreadsheets; never shame-y copy.
- **Quarterly check-in summary** (auto-generated page for any quarter): the six health
  numbers vs last quarter, goal progress with ETAs, adherence, shared-burn trend, and
  any flagged anomalies — designed to be read together in ~5 minutes and discussed
  in ~45.
- **Annual reset summary**: the year in review (totals saved per fund, rates, goal
  movement) plus a guided "re-baseline" flow that walks through each allocation rule
  and fund target for the new year.
- Optional, low-key reminder surface (a banner when a quarter ends, not emails) —
  v2 needs no notification infrastructure.

---

## 6. Privacy (extends v1 §4 — same rules, same enforcement style)

The v1 income-privacy model carries over verbatim and extends to v2 objects:

- **Personal funds** may be marked private by their owner. The other user then sees the
  fund's existence only as an aggregate health signal (it counts toward "per-person
  savings rate: on track ✓") but **never the balance, target, or contribution amounts**.
  Owner always sees everything of their own.
- **Couple-scope funds are always fully visible to both** — they cannot be private.
- A user's statement (Layer 1) is **theirs**: the other user never sees someone else's
  discretionary amount or personal allocation detail; they see only what v1 already
  reveals (ratio, owed, paid) plus couple-fund activity and non-private aggregates.
- Health dashboard: combined metrics are computed on real amounts server-side; where a
  component is private, display degrades gracefully (e.g. per-person savings rate may
  show as "on track / behind" rather than a number, mirroring how v1 hides income but
  keeps ratio).
- Privacy is enforced **server-side in the data layer**, per requesting user — exactly
  the existing pattern in `src/lib/data.ts`. Raw private values never reach the client.
- Privacy is frozen per record into history (as v1 does for income).

---

## 7. Computation requirements (pure-function core, like v1's settlement engine)

All money in **integer cents**. All engines are pure, DB-agnostic, unit-tested first —
mirroring `src/lib/settlement.ts`. Round only at display, using largest-remainder where
a split must sum exactly.

1. **`computeStatement`** — inputs: income cents, allocation rules, settlement owed (or
   estimated shared share + flag), actual contributions (optional), float reserve
   (optional). Output: bucket lines (plan & actual), discretionary residual, flags
   (estimated shared, missing income).
2. **`computeProjection`** — inputs: per-month income assumptions, allocation rules,
   shared-spend forecast (fixed list + variable averages + seasonality factors),
   one-off events, starting fund balances. Output: per-month statements per user +
   per-month fund balances + per-fund completion date (or "not reached in horizon").
   Deterministic; no randomness.
3. **`compareScenarios`** — two projection outputs → per-fund ETA deltas and per-user
   monthly discretionary deltas.
4. **`computeHealthMetrics`** — the six dashboard numbers from incomes, contributions,
   fund balances, and expense history.
5. **`forecastSharedSpend`** — expense history → fixed lines + variable rolling
   averages (3/6-month) + optional monthly seasonality multipliers; used by 1, 2 and 6.
6. **`computeFloat`** — expense + settlement history → live outstanding float and
   recommended reserve (trailing-max method, §5 Layer 6).

Edge cases that must be handled (tests required):

- Missing income for a month → statement runs in "estimated" mode, clearly flagged;
  projections fall back to income assumptions.
- Zero or near-zero income month → allocations scale to ~0 gracefully; no divide-by-zero.
- Allocation rules summing to ≥100% of income → valid math (negative discretionary),
  loud warning in UI.
- Fund target reached mid-horizon → projection stops contributing or redirects per a
  user choice ("on completion: stop | redirect to fund X"), default stop.
- Negative discretionary in a projected month → highlighted, never hidden.
- Sparse history (< 3 months of data) → forecasts label themselves low-confidence and
  prefer face-value fixed costs over averages.
- Withdrawals/corrections interleaved with contributions → balances always replayable
  from the ledger of entries.

---

## 8. Data model sketch (extends v1 schema; names indicative)

```
AllocationRule
  id, userId, fundId (fk -> Fund)
  percentBps        (basis points of monthly income, e.g. 1000 = 10%)
  fixedCentsOverride (nullable — if set, use instead of percent)
  active, createdAt, updatedAt

Fund
  id, name
  scope            ("personal" | "couple")
  ownerUserId      (nullable; required when scope = personal)
  targetCents      (nullable)
  targetDate       (nullable)
  isPrivate        (boolean; only meaningful for personal scope)
  isSinking        (boolean) + sinkingNote (nullable)
  createdAt, updatedAt

FundEntry                       // one ledger, replayable balance
  id, fundId, userId, monthKey
  amountCents                   // + contribution / − withdrawal
  kind             ("contribution" | "withdrawal" | "adjustment")
  note (nullable), createdAt

PlanAssumption                  // projection inputs that aren't rules
  id, userId (nullable = household-level), monthKey (nullable = default)
  kind             ("income" | "one-off-shared" | "one-off-personal" | "shared-forecast-override")
  amountCents, note

Scenario
  id, name, createdByUserId
  baseline         (boolean — exactly one active baseline)
  overridesJson    (the changed inputs vs baseline)
  createdAt, updatedAt

Expense (v1, extended)
  + category        (nullable string — optional, zero-friction)
  + isRecurringFixed (nullable boolean — manual override of auto-detection)

Settings (household-level key/value or table)
  frontingUserId, floatReserveCentsOverride (nullable),
  coupleGoalSplitMode ("proportional" | "equal"), projectionHorizonMonths, …
```

SQLite + Prisma remain. Integer cents everywhere. `monthKey` strings ("2026-06") as in v1.

---

## 9. Key screens / flows (user-friendly requirements)

1. **My month (statement)** — Layer 1, the new per-user home alongside the v1 dashboard.
   One glance answers "what's mine / saved / shared this month."
2. **Plan (projection)** — horizon selector, the baseline projection table/curves,
   fund completion dates, "new scenario" button, scenario comparison view with the
   trade-off sentence rendered prominently.
3. **Funds** — fund list with progress bars and ETAs; fund detail with ledger history;
   the monthly quick-entry "Sweep" screen (pre-filled planned contributions, confirm all).
4. **Health** — the six numbers, one screen, trailing trends.
5. **Float** — small panel (can live inside the fronting partner's statement) with
   outstanding amount and reserve.
6. **Reviews** — quarterly and annual summaries, listable by period.
7. **Settings** — allocation rules editor (with live "this implies $X/month at your
   recent income" preview), fund management, fairness choices (§2.4), fronting user,
   horizon.

UX principles (hard requirements, not suggestions):

- **Zero added friction to the monthly habit.** The whole monthly ritual — incomes,
  settle, sweep contributions — must be completable in ~15 minutes together. Every new
  required input must justify itself; prefer derived/prefilled values everywhere.
- **No judgment language.** Discretionary is never called "spending problem"; anomalies
  inform, adherence reports, nothing scolds.
- **Trade-offs always shown two-sided** (goal date AND monthly discretionary impact,
  per person).
- **Honest uncertainty.** Estimated/forecast values are visually distinct from actuals;
  low-confidence forecasts say so.
- Responsive web, Tailwind, same minimal aesthetic as v1.

---

## 10. Acceptance criteria (v2 is "done" when…)

1. Each user can define allocation rules and funds (personal & couple, with targets),
   and record monthly contributions via the quick-entry sweep.
2. Each user sees their monthly statement with planned vs actual allocations, the real
   settlement-derived shared share (or a clearly-flagged estimate), and their
   discretionary residual; the fronting partner additionally sees the float reserve
   carved out.
3. The projection shows ≥12 months forward per user and per fund, with completion dates,
   driven by income assumptions + allocation rules + a shared-spend forecast derived
   from actual v1 expense history.
4. A user can create a scenario, change at least an allocation % and an income
   assumption, and see side-by-side deltas (fund ETA shift + per-person monthly
   discretionary change), then promote it to baseline.
5. The health dashboard shows all six metrics computed from real data.
6. Fixed vs variable shared expenses are distinguished (auto + manual override) and
   demonstrably drive the forecast.
7. The float panel shows live outstanding and recommended reserve; the reserve is
   excluded from the fronting partner's discretionary and projections.
8. Quarterly and annual summaries render for any completed period.
9. All privacy rules in §6 are enforced server-side; a private personal fund's amounts
   are never present in any API response to the other user.
10. All v1 acceptance criteria still pass unchanged; all engines in §7 have unit tests
    including the listed edge cases; deploys exactly as v1 does (single Dokploy Compose
    service, SQLite volume).

---

## 11. Suggested build order (for the planning session)

1. §7 engines as pure functions + tests (`computeStatement`, `forecastSharedSpend`
   first — they unlock Layer 1 with zero new UI complexity).
2. Schema additions (§8) + migrations + seed updates.
3. Layer 1 statement screen, then Layer 3 funds + sweep flow (gives the monthly ritual).
4. Layer 2 projection + scenarios (the spine — biggest single piece).
5. Layers 4–7 (dashboard, intelligence, float panel, reviews) in any order; each is
   small once the engines exist.

Throughout: copy the v1 patterns — pure engines in `src/lib/`, server-side privacy
filtering in the data layer, server actions for writes, integer cents, monthKey periods.
