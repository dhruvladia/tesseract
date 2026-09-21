import { threadCreateSchema, threadUpdateSchema } from '@tesseract/shared'
import { and, asc, count, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { db, schema } from '../db/index.ts'
import { must, v } from '../lib/http.ts'
import { requireOrg, type OrgEnv } from '../middleware/org.ts'

const { thread, issue, engagement: eng, customerAccount: acct } = schema

export const threads = new Hono<OrgEnv>()
  .use(requireOrg)
  .get('/', async (c) => {
    const rows = await db
      .select({
        id: thread.id,
        name: thread.name,
        description: thread.description,
        engagementId: thread.engagementId,
        engagementName: eng.name,
        side: eng.side,
        accountKey: acct.key,
        accountName: acct.name,
        issueCount: count(issue.id),
        openCount: sql<number>`count(${issue.id}) filter (where ${issue.status} in ('backlog','todo','in_progress'))`.mapWith(Number),
        createdAt: thread.createdAt,
      })
      .from(thread)
      .leftJoin(eng, eq(eng.id, thread.engagementId))
      .leftJoin(acct, eq(acct.id, eng.accountId))
      .leftJoin(issue, eq(issue.threadId, thread.id))
      .where(eq(thread.organizationId, c.var.orgId))
      .groupBy(thread.id, eng.id, acct.id)
      .orderBy(asc(acct.name), asc(eng.name), asc(thread.createdAt))
    return c.json(rows)
  })
  .post('/', v('json', threadCreateSchema), async (c) => {
    const body = c.req.valid('json')
    if (body.engagementId) {
      must(
        await db.query.engagement.findFirst({
          columns: { id: true },
          where: and(eq(eng.id, body.engagementId), eq(eng.organizationId, c.var.orgId)),
        }),
        'Engagement',
      )
    }
    const [row] = await db
      .insert(thread)
      .values({ ...body, organizationId: c.var.orgId })
      .returning()
    return c.json(row!, 201)
  })
  .get('/:id', async (c) => {
    const row = must(
      await db.query.thread.findFirst({
        where: and(eq(thread.id, c.req.param('id')), eq(thread.organizationId, c.var.orgId)),
        with: { engagement: { columns: { id: true, name: true, side: true }, with: { account: { columns: { id: true, key: true, name: true } } } } },
      }),
      'Thread',
    )
    return c.json(row)
  })
  .patch('/:id', v('json', threadUpdateSchema), async (c) => {
    const [row] = await db
      .update(thread)
      .set(c.req.valid('json'))
      .where(and(eq(thread.id, c.req.param('id')), eq(thread.organizationId, c.var.orgId)))
      .returning()
    return c.json(must(row, 'Thread'))
  })
  .delete('/:id', async (c) => {
    const [row] = await db
      .delete(thread)
      .where(and(eq(thread.id, c.req.param('id')), eq(thread.organizationId, c.var.orgId)))
      .returning({ id: thread.id })
    return c.json(must(row, 'Thread'))
  })
