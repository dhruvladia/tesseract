import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { auth } from './auth.ts'
import { accounts } from './routes/accounts.ts'
import { agent } from './routes/agent.ts'
import { attention } from './routes/attention.ts'
import { engagementExtras } from './routes/engagement-extras.ts'
import { engagements } from './routes/engagements.ts'
import { gaps } from './routes/gaps.ts'
import { handoffDrafts } from './routes/handoff-drafts.ts'
import { issues } from './routes/issues.ts'
import { labels } from './routes/labels.ts'
import { me } from './routes/me.ts'
import { members } from './routes/members.ts'
import { metrics } from './routes/metrics.ts'
import { search } from './routes/search.ts'
import { threads } from './routes/threads.ts'

// Postgres constraint violations become readable 4xx responses instead of a 500.
const UNIQUE_MESSAGES: Record<string, string> = {
  customer_account_org_key_idx: 'An account with that key already exists. Pick a different key.',
  label_org_name_idx: 'A label with that name already exists.',
  handoff_engagement_kind_idx: 'That handoff record already exists.',
  organization_slug_unique: 'That organization slug is taken.',
  user_email_unique: 'An account with that email already exists.',
  issue_org_identifier_idx: 'Identifier collision while creating the issue. Try again.',
}
function pgError(err: unknown): { status: 400 | 409; message: string } | null {
  const cause = (err as { cause?: { code?: string; constraint_name?: string; constraint?: string; detail?: string } })?.cause
  const code = cause?.code
  if (!code) return null
  const constraint = cause?.constraint_name ?? cause?.constraint ?? ''
  if (code === '23505') return { status: 409, message: UNIQUE_MESSAGES[constraint] ?? 'That already exists.' }
  if (code === '23503') return { status: 400, message: 'Something this refers to no longer exists. Refresh and try again.' }
  if (code === '22P02' || code === '22007' || code === '22003') return { status: 400, message: 'One of the values has the wrong format.' }
  return null
}

const trusted = (process.env.TRUSTED_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim())

// `core` is every route the typed clients (web + agent tools) see. The agent route is mounted on top
// so its types, which depend on `AppType`, do not feed back into it.
const core = new Hono()
  .use(
    '/api/*',
    cors({
      origin: trusted,
      credentials: true,
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    }),
  )
  .onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status)
    const pg = pgError(err)
    if (pg) return c.json({ error: pg.message }, pg.status)
    console.error(err)
    return c.json({ error: 'Something went wrong on the server. Try again; if it keeps happening, check the API logs.' }, 500)
  })
  .on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))
  .get('/api/health', (c) => c.json({ ok: true }))
  .route('/api/me', me)
  .route('/api/members', members)
  .route('/api/accounts', accounts)
  .route('/api/engagements', engagements)
  .route('/api/engagements', engagementExtras)
  .route('/api/engagements', handoffDrafts)
  .route('/api/threads', threads)
  .route('/api/issues', issues)
  .route('/api/labels', labels)
  .route('/api/gaps', gaps)
  .route('/api/metrics', metrics)
  .route('/api/attention', attention)
  .route('/api/search', search)

export type AppType = typeof core
export const app = core.route('/api/agent', agent)
