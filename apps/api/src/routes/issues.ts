import { commentCreateSchema, issueCreateSchema, issueListQuerySchema, issueUpdateSchema } from '@tesseract/shared'
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { db, schema } from '../db/index.ts'
import { badRequest, must, v } from '../lib/http.ts'
import { requireOrg, type OrgEnv } from '../middleware/org.ts'

const { issue, thread, counter, activity, comment, issueLabel } = schema

/** Atomic per-scope counter: one statement, safe under concurrency. */
async function nextNumber(scope: string) {
  const [row] = await db
    .insert(counter)
    .values({ scope, n: 1 })
    .onConflictDoUpdate({ target: counter.scope, set: { n: sql`${counter.n} + 1` } })
    .returning({ n: counter.n })
  return row!.n
}

// Fields whose changes are recorded in the activity log.
const TRACKED = ['title', 'status', 'priority', 'assigneeId', 'dueDate', 'parentId'] as const

const listWith = {
  assignee: { columns: { id: true, name: true, image: true } },
  labels: { with: { label: true } },
  thread: { columns: { id: true, name: true, engagementId: true } },
} as const

export const issues = new Hono<OrgEnv>()
  .use(requireOrg)
  .get('/', v('query', issueListQuerySchema), async (c) => {
    const q = c.req.valid('query')
    const rows = await db.query.issue.findMany({
      where: and(
        eq(issue.organizationId, c.var.orgId),
        q.threadId ? eq(issue.threadId, q.threadId) : undefined,
        q.engagementId ? eq(issue.engagementId, q.engagementId) : undefined,
        q.accountId ? eq(issue.accountId, q.accountId) : undefined,
        q.assigneeId ? eq(issue.assigneeId, q.assigneeId === 'me' ? c.var.userId : q.assigneeId) : undefined,
        q.status ? eq(issue.status, q.status) : undefined,
        q.q ? or(ilike(issue.title, `%${q.q}%`), ilike(issue.identifier, `%${q.q}%`)) : undefined,
      ),
      with: listWith,
      orderBy: [desc(issue.createdAt)],
    })
    return c.json(rows)
  })
  .post('/', v('json', issueCreateSchema), async (c) => {
    const { labelIds, ...body } = c.req.valid('json')
    const t = must(
      await db.query.thread.findFirst({
        where: and(eq(thread.id, body.threadId), eq(thread.organizationId, c.var.orgId)),
        with: { engagement: { columns: { id: true, accountId: true }, with: { account: { columns: { key: true } } } } },
      }),
      'Thread',
    )
    if (body.parentId) {
      must(
        await db.query.issue.findFirst({
          columns: { id: true },
          where: and(eq(issue.id, body.parentId), eq(issue.organizationId, c.var.orgId)),
        }),
        'Parent issue',
      )
    }
    const key = t.engagement?.account.key ?? 'INT'
    const scope = t.engagement ? `acct:${t.engagement.accountId}` : `org:${c.var.orgId}`
    const n = await nextNumber(scope)
    const row = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(issue)
        .values({
          ...body,
          identifier: `${key}-${n}`,
          organizationId: c.var.orgId,
          engagementId: t.engagement?.id ?? null,
          accountId: t.engagement?.accountId ?? null,
          createdById: c.var.userId,
          completedAt: body.status === 'done' ? new Date() : null,
        })
        .returning()
      if (labelIds?.length) await tx.insert(issueLabel).values(labelIds.map((labelId) => ({ issueId: row!.id, labelId })))
      await tx.insert(activity).values({ organizationId: c.var.orgId, issueId: row!.id, actorId: c.var.userId, field: 'created' })
      return row!
    })
    return c.json(row, 201)
  })
  .get('/:id', async (c) => {
    const row = must(
      await db.query.issue.findFirst({
        where: and(eq(issue.id, c.req.param('id')), eq(issue.organizationId, c.var.orgId)),
        with: {
          ...listWith,
          thread: { columns: { id: true, name: true, engagementId: true }, with: { engagement: { columns: { id: true, name: true, side: true } } } },
          parent: { columns: { id: true, identifier: true, title: true } },
          subIssues: { columns: { id: true, identifier: true, title: true, status: true, priority: true, assigneeId: true }, orderBy: asc(issue.createdAt) },
          comments: { orderBy: asc(comment.createdAt) },
          activities: { orderBy: asc(activity.createdAt) },
        },
      }),
      'Issue',
    )
    return c.json(row)
  })
  .patch('/:id', v('json', issueUpdateSchema), async (c) => {
    const { labelIds, ...patch } = c.req.valid('json')
    const before = must(
      await db.query.issue.findFirst({ where: and(eq(issue.id, c.req.param('id')), eq(issue.organizationId, c.var.orgId)) }),
      'Issue',
    )
    if (patch.parentId === before.id) throw badRequest('An issue cannot be its own parent')
    const row = await db.transaction(async (tx) => {
      const completedAt = patch.status ? (patch.status === 'done' ? (before.completedAt ?? new Date()) : null) : undefined
      const [row] = await tx
        .update(issue)
        .set({ ...patch, ...(completedAt !== undefined ? { completedAt } : {}) })
        .where(eq(issue.id, before.id))
        .returning()
      // one activity row per changed tracked field
      const changes = TRACKED.filter((f) => f in patch && String(before[f] ?? '') !== String(row![f] ?? '')).map((f) => ({
        organizationId: c.var.orgId,
        issueId: before.id,
        actorId: c.var.userId,
        field: f,
        from: before[f] == null ? null : String(before[f]),
        to: row![f] == null ? null : String(row![f]),
      }))
      if (changes.length) await tx.insert(activity).values(changes)
      if (labelIds) {
        await tx.delete(issueLabel).where(eq(issueLabel.issueId, before.id))
        if (labelIds.length) await tx.insert(issueLabel).values(labelIds.map((labelId) => ({ issueId: before.id, labelId })))
      }
      return row!
    })
    return c.json(row)
  })
  .delete('/:id', async (c) => {
    const [row] = await db
      .delete(issue)
      .where(and(eq(issue.id, c.req.param('id')), eq(issue.organizationId, c.var.orgId)))
      .returning({ id: issue.id })
    return c.json(must(row, 'Issue'))
  })
  .post('/:id/comments', v('json', commentCreateSchema), async (c) => {
    const i = must(
      await db.query.issue.findFirst({ columns: { id: true }, where: and(eq(issue.id, c.req.param('id')), eq(issue.organizationId, c.var.orgId)) }),
      'Issue',
    )
    const [row] = await db
      .insert(comment)
      .values({ ...c.req.valid('json'), issueId: i.id, organizationId: c.var.orgId, authorId: c.var.userId })
      .returning()
    return c.json(row!, 201)
  })
  .delete('/:id/comments/:cid', async (c) => {
    const [row] = await db
      .delete(comment)
      .where(and(eq(comment.id, c.req.param('cid')), eq(comment.issueId, c.req.param('id')), eq(comment.organizationId, c.var.orgId)))
      .returning({ id: comment.id })
    return c.json(must(row, 'Comment'))
  })

