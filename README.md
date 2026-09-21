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

## What you get

| Area | What you get |
| --- | --- |
| Boards | Pre-sales (Qualify → Discover → Scope → Prototype → Technical Win) and Post-sales (Kickoff → Build → Validate → Live → Adopt → Handed Off) kanbans. Drag to change phase; invalid moves are greyed out with the reason. |
| Engagement | Decision it unlocks, team (FDE, Engagement Manager, AE, CSM), outcome contract, milestones, threads and issues, stakeholders, handoffs, product-gap signals. |
| Accounts | Customer accounts with a stakeholder map (sponsor, technical owner, workflow owner, champion, user, blocker). Qualification warns when the three required roles are missing. |
| Threads and issues | Workstreams per engagement (Discovery, Data access, Prototype, Hardening…) plus internal threads. Issues get `ACME-42` / `INT-7` identifiers, rich descriptions, status, priority, assignee, labels, due dates, sub-issues, comments, and a per-field activity log. |
| Handoffs | Pre→Post and Post→CS records. Converting to post-sales requires an accepted handoff with no unresolved blocking gaps; closing a post-sales engagement requires the CS handoff. |
| Product gaps | Kanban raised → triaged → accepted → shipped / declined. Link gaps to engagements with impact and ARR influenced; drag a gap onto another to cluster it. |
| Handoff drafts (AI, optional) | Paste call notes or a transcript; the model proposes sections, stakeholders, outcome metrics, commitments and gaps, each with a verbatim quote and line number. Quotes are checked mechanically; anything unsupported is flagged and sections without evidence fall back to "not discussed". A person reviews, edits, and applies. See below. |
| Agent (AI, optional) | A chat and voice operator (`⌘J`) that runs the platform for you: "create a Hardening thread on this engagement with an issue for the audit log, assigned to Grace", "which handoffs are waiting for acceptance?", "move Claims to Validate". Reads run freely; every change pauses for an Approve / Deny card that says exactly what will happen. It resolves names before acting and asks when a request is ambiguous. |
| Attention | An inbox computed from your data: handoffs ready to accept, blocking or unowned gaps, missing owners or stakeholders, stale engagements, overdue milestones and issues, live deployments with no verified first value. Routed to the person who should act. |
| Metrics | Is the gate respected and does it pay off: time to accepted handoff, technical win to kickoff, time to first value, reopens after acceptance, gaps found after acceptance, thin confirmations, handoffs accepted with most sections never discussed. Computed from an event log, per engagement. |
| Command palette | `⌘K` jumps to accounts, engagements, issues, gaps; runs actions (new issue, move phase, assign FDE). `C` creates an issue in context. |
| Roles | owner, admin, FDE, engagement manager, account executive, customer success, product. |

Deferred: decisions/risks log, capacity view, realtime, Slack/CRM ingestion, custom phases, delivery risk review and cross-engagement gap analysis (the next two AI workflows).

## Quick start (no database required)

Requires Node 24+ and pnpm 12+ (`npm i -g pnpm`).

```bash
git clone https://github.com/dhruvladia/tesseract.git && cd tesseract
pnpm install
cp .env.example .env            # set BETTER_AUTH_SECRET to something random
SEED_DEMO=1 pnpm dev            # api on :3001, web on :5173
```

Open http://localhost:5173 and sign in as `ada@acme.ai` / `tesseract-demo` to explore a seeded FDE portfolio (five accounts, engagements on both boards, and three sitting at Technical Win with no handoff yet), or create your own account. Without `DATABASE_URL`, the API runs an embedded Postgres (PGlite) at `apps/api/data/pg`, so nothing else needs to be installed.

The AI features are off until you add a model. To try them, set the `LLM_*` variables described under [AI-assisted handoffs](#ai-assisted-handoffs) and restart the API; the Draft button, the agent button and the mic appear on their own.

## AI-assisted handoffs

The handoff record is Tesseract's strongest feature and also the most administrative one to fill in. With a model configured, the Handoffs tab gets a **Draft from notes** button:

1. Paste call notes or a transcript and give the source a label. The text is stored with the engagement.
2. The model returns a proposal: section states and notes, stakeholders with roles, outcome metrics with baseline and target, commitments (which become milestones), and gaps with severity. Every item must cite a verbatim quote and its line number.
3. Tesseract checks each quote against the source. Quotes that are not there are flagged; sections with no verified evidence are forced back to "not discussed" with empty notes. Nothing unsupported looks confident.
4. You review: untick, edit, change severity or role, open any quote in its surrounding lines. Then apply. Only what you applied is written, with the quotes attached as provenance you can open later from the record.

The boundary is deliberate: **the model proposes, an accountable person accepts commitments and verifies outcomes.** Every generation and application is logged, so the Metrics page can show how many proposed items people actually kept.

Bring your own model. Set on the API:

```bash
LLM_PROVIDER=openai           # or anthropic, or openai-compatible
LLM_MODEL=gpt-4.1-mini        # any model id the provider accepts; the agent needs one that supports tool calling
LLM_API_KEY=...
# LLM_BASE_URL=http://localhost:11434/v1        # openai-compatible only (Ollama, vLLM, gateways)
# LLM_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe   # voice input; openai provider only
```

Drafts, the agent and the simulation were exercised end to end with `openai` / `gpt-4.1-mini`, a small, cheap model; the tools are shaped so that a small model cannot damage data (see below). Anthropic and OpenAI-compatible endpoints use the same code paths; voice needs the OpenAI provider.

Leave `LLM_PROVIDER` unset and every AI surface (drafts, agent, voice) disappears. What gets sent to the provider for drafts: the pasted notes, the engagement name, account name, decision, existing stakeholder names and roles, existing outcome metric names, and the current section states. Nothing else.

## The agent

With a model configured, a small beam-ringed button appears bottom-right (or press `⌘J`). Type, or press the mic, speak, and press it again.

It can operate everything a person can from the UI: accounts and stakeholders, engagements and their team, phase moves, threads, issues and comments, labels, handoff sections and gaps (mark, add, assign, resolve, accept, reopen), outcomes and milestones, product gaps and their links, member roles, and the draft-from-notes flow. It sees the page you are on, so "this engagement" resolves.

- **Reads are free.** "What needs attention today?", "summarize the Claims triage agent engagement", "which gaps block Meridian?" run immediately; the lookups are shown collapsed under the answer.
- **Writes wait for you.** Every create, update, phase move, acceptance, or delete produces a card such as *Move Claims triage agent (NWB) to Validate* or *Delete thread "Discovery" and all its issues. This cannot be undone.* Nothing happens until you press Approve. Deny and the agent says so and stops.
- **Ambiguity becomes a question.** "Move the engagement to prototype" with three open engagements gets you a list to pick from, not a guess. People are referred to by name ("Grace"); ids are never invented.
- **The gates still apply.** The agent uses the same API as the UI, so the handoff gate, validation, and org scoping bind it exactly as they bind a person. If acceptance is refused, it relays the reason and does not quietly mark sections or resolve gaps to get past it.
- **Handoff edits are merges by construction.** The agent can mark sections, add or update gaps, and assign owners, but it has no tool that can blank a section with content or drop a gap.

Voice uses the provider's transcription model (`LLM_TRANSCRIBE_MODEL`, OpenAI only); the clip is transcribed and dropped into the input for you to edit before sending. Set it to `off` to hide the mic.

What gets sent to the provider: your messages, the ids of the page you are on, and the results of the lookups the agent makes on your behalf (names, states, notes, comments of whatever it reads). The agent can only see and do what your account can. Nothing is sent when the panel is closed.

### Design-partner simulation

`pnpm sim` (with the API running and `LLM_*` set) plays the reviewer's test: three seeded partners at Technical Win, each driven by an AE, an EM and an FDE persona through the agent: draft the handoff from a messy call transcript, tidy it, try to accept, resolve what blocks, convert to kickoff. Deletes are denied to exercise the deny path. It prints every approval decision as an audit line and a summary per partner: whether kickoff was reached and the handoff accepted, sections confirmed / unclear / not discussed, gaps open, draft items proposed vs applied by a person, and the effort it took (user messages, model rounds, tool calls, approvals, denials, platform refusals, wall-clock time). The events land on the Metrics page like any real run, so you can compare against your own team's numbers.

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
| `PORT` | `3001` | Port the API listens on. |
| `BETTER_AUTH_SECRET` | – | Session signing secret. Required. |
| `BETTER_AUTH_URL` | `http://localhost:3001` | Public URL the browser reaches the API on (through the proxy in Docker). |
| `TRUSTED_ORIGINS` | `http://localhost:5173` | Comma-separated origins allowed to call the API with cookies. |
| `AUTO_JOIN` | `true` | New sign-ups automatically join the first organization. Set `false` to require an admin to add members from Settings. |
| `SEED_DEMO` | – | `1` seeds the demo workspace on boot (idempotent). |
| `LLM_PROVIDER` | unset | `anthropic`, `openai`, or `openai-compatible`. Unset disables AI features. |
| `LLM_MODEL` | – | Model id passed to the provider. |
| `LLM_API_KEY` | – | Provider key (optional for some openai-compatible endpoints). |
| `LLM_BASE_URL` | – | Base URL for `openai-compatible` endpoints. |
| `LLM_TRANSCRIBE_MODEL` | `gpt-4o-mini-transcribe` | Voice input model for the agent (OpenAI provider only). `off` disables the mic. |
| `VITE_API_URL` (web) | `http://localhost:3001` | Where the dev web app reaches the API. Unused in the Docker image, which proxies `/api`. |

Tesseract's data model is multi-organization (every row carries an `organizationId`), but v1 ships a single-organization flow: the first person to sign up creates the workspace, and everyone after joins it.

## Development

```bash
pnpm dev          # both apps with hot reload
pnpm typecheck    # all packages
pnpm test         # lifecycle rules, draft verification, attention rules
pnpm sim          # design-partner simulation through the agent (needs a running API with LLM_* set)
pnpm db:generate  # regenerate a migration after editing apps/api/src/db/schema.ts
pnpm db:seed      # seed demo data into a running Postgres (for PGlite use SEED_DEMO=1 instead)
```

### Layout

```
apps/web                 Vite + React 19 + TanStack Router/Query + shadcn/ui + Tailwind v4
apps/api                 Hono + Drizzle + Better Auth (organization plugin) + Postgres/PGlite
apps/api/src/agent       agent tools (typed calls into our own API), approval descriptions, system prompt
apps/api/src/sim         design-partner simulation and its transcripts
apps/api/src/lib         attention rules, handoff event log, LLM provider factory
packages/shared          zod schemas, enums, the lifecycle rules (phases.ts), draft verification (handoff-draft.ts)
```

The lifecycle lives in one place, `packages/shared/src/phases.ts`. The API enforces it; the UI uses the same function to grey out invalid moves and explain why. The API is typed end to end with Hono's RPC client, so a route change fails the web typecheck, and the agent's tools are built on the same client, so a route change fails their typecheck too.

## Research behind the model

The phase names, the eight handoff sections, the outcome contract, the stakeholder roles, and the product-gap loop come from how FDE functions actually operate at Palantir (Delta/Echo), OpenAI (FDE + Technical Deployment Lead), Anthropic (Applied AI FDE + Engagement Manager), and FDE agencies, and from the sales-to-CS handoff playbooks those teams borrow from. The short version: name the decision, name the owners, measure the outcome, hand off with a document not a conversation, and make sure something ships back into the product.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Practitioner feedback on the model (phases, handoff sections, roles) is as welcome as code. Security issues: see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
