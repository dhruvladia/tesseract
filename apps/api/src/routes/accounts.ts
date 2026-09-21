import { accountCreateSchema, accountUpdateSchema, stakeholderCreateSchema, stakeholderUpdateSchema } from '@tesseract/shared'
import { and, asc, count, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { db, schema } from '../db/index.ts'
import { must, v } from '../lib/http.ts'
import { requireOrg, type OrgEnv } from '../middleware/org.ts'

const { customerAccount: acct, stakeholder, engagement } = schema

export const accounts = new Hono<OrgEnv>()
  .use(requireOrg)
  .get('/', async (c) => {
    const rows = await db
      .select({
        id: acct.id,
        name: acct.name,
        key: acct.key,
        domain: acct.domain,
        arr: acct.arr,
        createdAt: acct.createdAt,
        engagementCount: count(engagement.id),
        activeCount: sql<number>`count(${engagement.id}) filter (where ${engagement.phase} <> 'closed')`.mapWith(Number),
      })
      .from(acct)
      .leftJoin(engagement, eq(engagement.accountId, acct.id))
      .where(eq(acct.organizationId, c.var.orgId))
      .groupBy(acct.id)
      .orderBy(asc(acct.name))
    return c.json(rows)
  })
  .post('/', v('json', accountCreateSchema), async (c) => {
    const body = c.req.valid('json')
    const [row] = await db
      .insert(acct)
      .values({ ...body, organizationId: c.var.orgId })
      .returning()
    return c.json(row!, 201)
  })
  .get('/:id', async (c) => {
    const row = must(
      await db.query.customerAccount.findFirst({
        where: and(eq(acct.id, c.req.param('id')), eq(acct.organizationId, c.var.orgId)),
        with: {
          stakeholders: { orderBy: asc(stakeholder.createdAt) },
          engagements: { orderBy: asc(engagement.createdAt) },
        },
      }),
      'Account',
    )
    return c.json(row)
  })
  .patch('/:id', v('json', accountUpdateSchema), async (c) => {
    const [row] = await db
      .update(acct)
      .set(c.req.valid('json'))
      .where(and(eq(acct.id, c.req.param('id')), eq(acct.organizationId, c.var.orgId)))
      .returning()
    return c.json(must(row, 'Account'))
  })
  .delete('/:id', async (c) => {
    const [row] = await db
      .delete(acct)
      .where(and(eq(acct.id, c.req.param('id')), eq(acct.organizationId, c.var.orgId)))
      .returning({ id: acct.id })
    return c.json(must(row, 'Account'))
  })
  // ---- stakeholders (nested under the account they belong to) ----
  .post('/:id/stakeholders', v('json', stakeholderCreateSchema), async (c) => {
    const a = must(
      await db.query.customerAccount.findFirst({
        columns: { id: true },
        where: and(eq(acct.id, c.req.param('id')), eq(acct.organizationId, c.var.orgId)),
      }),
      'Account',
    )
    const body = c.req.valid('json')
    const [row] = await db
      .insert(stakeholder)
      .values({ ...body, email: body.email || null, accountId: a.id, organizationId: c.var.orgId })
      .returning()
    return c.json(row!, 201)
  })
  .patch('/:id/stakeholders/:sid', v('json', stakeholderUpdateSchema), async (c) => {
    const body = c.req.valid('json')
    const [row] = await db
      .update(stakeholder)
      .set({ ...body, email: body.email === '' ? null : body.email })
      .where(
        and(
          eq(stakeholder.id, c.req.param('sid')),
          eq(stakeholder.accountId, c.req.param('id')),
          eq(stakeholder.organizationId, c.var.orgId),
        ),
      )
      .returning()
    return c.json(must(row, 'Stakeholder'))
  })
  .delete('/:id/stakeholders/:sid', async (c) => {
    const [row] = await db
      .delete(stakeholder)
      .where(and(eq(stakeholder.id, c.req.param('sid')), eq(stakeholder.organizationId, c.var.orgId)))
      .returning({ id: stakeholder.id })
    return c.json(must(row, 'Stakeholder'))
  })
