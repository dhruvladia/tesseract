import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { auth } from './auth.ts'
import { accounts } from './routes/accounts.ts'
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

const trusted = (process.env.TRUSTED_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim())

export const app = new Hono()
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
    console.error(err)
    return c.json({ error: 'Internal error' }, 500)
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

export type AppType = typeof app
