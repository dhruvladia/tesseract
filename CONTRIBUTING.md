# Contributing to Tesseract

Thanks for helping build a tracker that fits how forward deployed teams actually work. Issues, bug reports, design feedback from practitioners, and pull requests are all welcome.

## Setup

Node 24+ and pnpm 12+ (`npm i -g pnpm`). No database needed for development; the API runs embedded Postgres (PGlite) when `DATABASE_URL` is unset.

```bash
pnpm install
cp .env.example .env           # set BETTER_AUTH_SECRET to anything random
SEED_DEMO=1 pnpm dev           # api :3001, web :5173
```

Sign in as `ada@acme.ai` / `tesseract-demo` for the seeded workspace.

## Before you open a PR

```bash
pnpm typecheck   # all three packages, must be clean
pnpm test        # lifecycle rules self-check
pnpm -C apps/web build
```

CI runs the same three commands.

## How the code is organized

| Path | What lives there |
| --- | --- |
| `packages/shared/src/enums.ts` | Every enum (phases, statuses, roles) as `as const` tuples, shared by zod and Drizzle |
| `packages/shared/src/schemas.ts` | zod input schemas. Update schemas derive from a default-free base so PATCH never resets fields |
| `packages/shared/src/phases.ts` | The engagement lifecycle. The API enforces it, the UI greys out invalid moves with it. Change it here and nowhere else, and extend `phases.test.ts` |
| `apps/api/src/db/schema.ts` | Drizzle tables and relations. Every domain table carries `organizationId` |
| `apps/api/src/routes/*` | One Hono sub-app per domain, all behind `requireOrg`. Every query filters on `c.var.orgId` |
| `apps/api/src/lib/events.ts` | Lifecycle events (`phase_event`, `handoff_event`) are written by the phase and handoff endpoints; the Metrics page only reads these. If you add a state change that should be measurable, log it here |
| `apps/api/src/lib/attention.ts` | Pure rules behind the Attention inbox, with tests. Add a rule here, not in the UI |
| `packages/shared/src/handoff-draft.ts` | Model output schema and `verifyDraft`, the trust boundary for AI drafts. Anything the model proposes passes through here |
| `apps/api/src/agent/` | The agent: `tools.ts` (one `tool()` per operation, each a typed call into our own API in-process), `describe.ts` (the one-sentence approval prompt), `prompt.ts` (rules), `core.ts` (shared by the chat route and the sim). Adding a capability = a zod schema + one fetch; put it in `WRITE_TOOLS` if it changes data. Prefer merge-shaped tools over full-replace ones: small models will pass whatever they believe the state is |
| `apps/api/src/sim/` | Design-partner simulation (`pnpm sim`). Run it after touching the agent; it is the fastest way to see a small model misuse a tool |
| `apps/web/src/lib/queries*.ts` | TanStack Query options and mutations, typed from the API via Hono RPC |
| `apps/web/src/features/*` | UI per domain; `src/routes` is file-based routing |
| `apps/web/src/components/ui` | shadcn primitives, generated; edit sparingly |

### Database changes

Edit `apps/api/src/db/schema.ts`, then `pnpm db:generate` and commit the new file under `apps/api/drizzle/`. Migrations apply automatically on API start.

### Conventions

- Prefer the smallest change that works. Reuse what is in `components/common.tsx` before adding a component.
- Keep heavy dependencies (editors, charts) behind lazy route boundaries.
- New endpoints: validate input with `v('json', schema)` from `apps/api/src/lib/http.ts`, return `{ error }` on failure, and add a line to the relevant `queries*.ts`.
- If you touch anything that a self-hoster configures, update the table in `README.md`.
- Mark deliberate simplifications with a `ponytail:` comment naming the ceiling and the upgrade path.

## Proposing product changes

Tesseract is opinionated about how FDE work runs: the engagement is the unit, the handoff is a document, the outcome is a metric, and gaps flow back to product. If you want to change the model (new phase, new handoff section, new role), open an issue first and say which team's practice it comes from. Field experience is the best argument.

## Reporting bugs

Open an issue with what you did, what you expected, and what happened. Include the browser console or API log if there is one. If it is a security problem, see `SECURITY.md` instead.
