# Tesseract

[![CI](https://github.com/dhruvladia/tesseract/actions/workflows/ci.yml/badge.svg)](https://github.com/dhruvladia/tesseract/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

An open-source engagement tracker for Forward Deployed Engineering teams. Linear-shaped, but the unit of work is a **customer engagement** that moves through a **pre-sales** pipeline, converts through a **structured handoff**, then moves through a **post-sales** pipeline until it is handed to Customer Success. Built for teams at model labs, AI startups, and FDE agencies who work with sales, product, and customer success on the same accounts.

## Why this exists

FDE work does not fit an issue tracker or a CRM:

- The anchor is an **outcome**, not a ticket: a baseline metric, a target, and the moment first value is verified.
- Pre-sales asks "should scarce FDE capacity go here, and can we prove value?" Post-sales asks "can we make it production, adopted, and hand it off?" Different questions, different boards, one engagement.
- **The seam is where context dies.** Every hop between sales, delivery, and CS loses a third of what mattered. Tesseract makes the handoff a first-class artifact: eight sections marked Confirmed / Unclear / Not discussed, a gap log with severity and owners, and an acceptance gate that the lifecycle enforces.
- **Productization is what separates FDE from consulting.** Product gaps discovered in the field are captured, tied to the engagements and ARR they block, clustered across accounts, and tracked from raised to shipped.
- Trackers are tolerated, not loved. Keyboard-first, `⌘K` for everything, peek panels, minimal required fields.

## What is in v1

| Area | What you get |
| --- | --- |
| Boards | Pre-sales (Qualify → Discover → Scope → Prototype → Technical Win) and Post-sales (Kickoff → Build → Validate → Live → Adopt → Handed Off) kanbans. Drag to change phase; invalid moves are greyed out with the reason. |
| Engagement | Decision it unlocks, team (FDE, Engagement Manager, AE, CSM), outcome contract, milestones, threads and issues, stakeholders, handoffs, product-gap signals. |
| Accounts | Customer accounts with a stakeholder map (sponsor, technical owner, workflow owner, champion, user, blocker). Qualification warns when the three required roles are missing. |
| Threads and issues | Workstreams per engagement (Discovery, Data access, Prototype, Hardening…) plus internal threads. Issues get `ACME-42` / `INT-7` identifiers, rich descriptions, status, priority, assignee, labels, due dates, sub-issues, comments, and a per-field activity log. |
| Handoffs | Pre→Post and Post→CS records. Converting to post-sales requires an accepted handoff with no unresolved blocking gaps; closing a post-sales engagement requires the CS handoff. |
| Product gaps | Kanban raised → triaged → accepted → shipped / declined. Link gaps to engagements with impact and ARR influenced; drag a gap onto another to cluster it. |
| Command palette | `⌘K` jumps to accounts, engagements, issues, gaps; runs actions (new issue, move phase, assign FDE). `C` creates an issue in context. |
| Roles | owner, admin, FDE, engagement manager, account executive, customer success, product. |

Deferred to v2: metrics dashboard (time-to-first-value, pilot→production conversion, productization rate), decisions/risks log, capacity view, realtime, Slack/CRM sync, custom phases.

## Quick start (no database required)

Requires Node 24+ and pnpm 12+ (`npm i -g pnpm`).

```bash
git clone https://github.com/dhruvladia/tesseract.git && cd tesseract
pnpm install
cp .env.example .env            # set BETTER_AUTH_SECRET to something random
SEED_DEMO=1 pnpm dev            # api on :3001, web on :5173
```

Open http://localhost:5173 and sign in as `ada@acme.ai` / `tesseract-demo` to explore a seeded FDE portfolio, or create your own account. Without `DATABASE_URL`, the API runs an embedded Postgres (PGlite) at `apps/api/data/pg`, so nothing else needs to be installed.

## Self-hosting with Docker

```bash
cp .env.example .env
# edit .env: BETTER_AUTH_SECRET, BETTER_AUTH_URL=http://your-host:8080, TRUSTED_ORIGINS=http://your-host:8080
docker compose up -d --build
```

The web image (nginx) serves the SPA on port 8080 and proxies `/api` to the API container; Postgres 16 runs alongside. Migrations apply automatically when the API starts. To load the demo workspace, add `SEED_DEMO=1` to the `api` service environment for the first boot.

### Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | empty | Postgres connection string. Empty = embedded PGlite. |
| `PGLITE_DIR` | `apps/api/data/pg` | Where the embedded database lives. |
| `BETTER_AUTH_SECRET` | – | Session signing secret. Required. |
| `BETTER_AUTH_URL` | `http://localhost:3001` | Public URL the browser reaches the API on (through the proxy in Docker). |
| `TRUSTED_ORIGINS` | `http://localhost:5173` | Comma-separated origins allowed to call the API with cookies. |
| `AUTO_JOIN` | `true` | New sign-ups automatically join the first organization. Set `false` to require an admin to add members from Settings. |
| `SEED_DEMO` | – | `1` seeds the demo workspace on boot (idempotent). |

Tesseract's data model is multi-organization (every row carries an `organizationId`), but v1 ships a single-organization flow: the first person to sign up creates the workspace, and everyone after joins it.

## Development

```bash
pnpm dev          # both apps with hot reload
pnpm typecheck    # all packages
pnpm test         # lifecycle rules self-check (packages/shared)
pnpm db:generate  # regenerate a migration after editing apps/api/src/db/schema.ts
pnpm db:seed      # seed demo data into a running Postgres (for PGlite use SEED_DEMO=1 instead)
```

### Layout

```
apps/web         Vite + React 19 + TanStack Router/Query + shadcn/ui + Tailwind v4
apps/api         Hono + Drizzle + Better Auth (organization plugin) + Postgres/PGlite
packages/shared  zod schemas, enums, and the engagement lifecycle rules (phases.ts)
```

The lifecycle lives in one place, `packages/shared/src/phases.ts`. The API enforces it; the UI uses the same function to grey out invalid moves and explain why. The API is typed end to end with Hono's RPC client, so a route change fails the web typecheck.

## Research behind the model

The phase names, the eight handoff sections, the outcome contract, the stakeholder roles, and the product-gap loop come from how FDE functions actually operate at Palantir (Delta/Echo), OpenAI (FDE + Technical Deployment Lead), Anthropic (Applied AI FDE + Engagement Manager), and FDE agencies, and from the sales-to-CS handoff playbooks those teams borrow from. The short version: name the decision, name the owners, measure the outcome, hand off with a document not a conversation, and make sure something ships back into the product.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Practitioner feedback on the model (phases, handoff sections, roles) is as welcome as code. Security issues: see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
