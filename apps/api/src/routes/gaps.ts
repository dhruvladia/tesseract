import { engagementGapLinkSchema, productGapCreateSchema, productGapUpdateSchema } from '@tesseract/shared'
import { and, asc, count, desc, eq, sql, sum } from 'drizzle-orm'
import { Hono } from 'hono'
import { db, schema } from '../db/index.ts'
import { badRequest, must, v } from '../lib/http.ts'
import { requireOrg, type OrgEnv } from '../middleware/org.ts'

const { productGap: gap, engagementGap: link, engagement: eng, customerAccount: acct } = schema
const own = (id: string, orgId: string) => and(eq(gap.id, id), eq(gap.organizationId, orgId))

async function assertEngagement(id: string, orgId: string) {
  return must(await db.query.engagement.findFirst({ columns: { id: true }, where: and(eq(eng.id, id), eq(eng.organizationId, orgId)) }), 'Engagement')
}

// The field -> product loop. Gaps are raised from engagements, clustered (one level) under a parent,
// and tracked raised -> triaged -> accepted -> shipped (or declined).
export const gaps = new Hono<OrgEnv>()
  .use(requireOrg)
  .get('/', async (c) => {
    const rows = await db
      .select({
        id: gap.id,
        title: gap.title,
        status: gap.status,
        parentId: gap.parentId,
        linkedIssueUrl: gap.linkedIssueUrl,
        createdAt: gap.createdAt,
        shippedAt: gap.shippedAt,
        engagementCount: count(link.engagementId),
        arrInfluenced: sum(link.arrInfluenced).mapWith(Number),
        blockerCount: sql<number>`count(${link.engagementId}) filter (where ${link.impact} = 'blocker')`.mapWith(Number),
      })
      .from(gap)
      .leftJoin(link, eq(link.gapId, gap.id))
      .where(eq(gap.organizationId, c.var.orgId))
      .groupBy(gap.id)
      .orderBy(desc(gap.createdAt))
    return c.json(rows)
  })
  .post('/', v('json', productGapCreateSchema), async (c) => {
    const { engagementId, impact, arrInfluenced, linkedIssueUrl, ...body } = c.req.valid('json')
    if (engagementId) await assertEngagement(engagementId, c.var.orgId)
    if (body.parentId) {
      const p = must(await db.query.productGap.findFirst({ columns: { parentId: true }, where: own(body.parentId, c.var.orgId) }), 'Parent gap')
      if (p.parentId) throw badRequest('Clusters are one level deep')
    }
    const row = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(gap)
        .values({ ...body, linkedIssueUrl: linkedIssueUrl || null, organizationId: c.var.orgId, createdById: c.var.userId })
        .returning()
      if (engagementId) await tx.insert(link).values({ gapId: row!.id, engagementId, impact: impact ?? 'major', arrInfluenced })
      return row!
    })
    return c.json(row, 201)
  })
  .get('/:id', async (c) => {
    const row = must(
      await db.query.productGap.findFirst({
        where: own(c.req.param('id'), c.var.orgId),
        with: {
          parent: { columns: { id: true, title: true, status: true } },
          children: { columns: { id: true, title: true, status: true }, orderBy: asc(gap.createdAt) },
          engagements: { with: { engagement: { columns: { id: true, name: true, side: true, phase: true }, with: { account: { columns: { key: true, name: true } } } } } },
        },
      }),
      'Product gap',
    )
    // roll children's links into the cluster view
    const childLinks = row.children.length
      ? await db
          .select({ gapId: link.gapId, engagementId: link.engagementId, impact: link.impact, arrInfluenced: link.arrInfluenced, name: eng.name, accountKey: acct.key })
          .from(link)
          .innerJoin(eng, eq(eng.id, link.engagementId))
          .innerJoin(acct, eq(acct.id, eng.accountId))
          .where(
            sql`${link.gapId} in ${row.children.map((ch) => ch.id)}`,
          )
      : []
    return c.json({ ...row, childLinks })
  })
  .patch('/:id', v('json', productGapUpdateSchema), async (c) => {
    const id = c.req.param('id')
    const body = c.req.valid('json')
    if (body.parentId === id) throw badRequest('A gap cannot be its own parent')
    if (body.parentId) {
      const p = must(await db.query.productGap.findFirst({ columns: { parentId: true }, where: own(body.parentId, c.var.orgId) }), 'Parent gap')
      if (p.parentId) throw badRequest('Clusters are one level deep')
      const [hasChildren] = await db.select({ n: count() }).from(gap).where(eq(gap.parentId, id))
      if (hasChildren!.n > 0) throw badRequest('This gap is already a cluster parent; move its children first')
    }
    const [row] = await db
      .update(gap)
      .set({
        ...body,
        linkedIssueUrl: body.linkedIssueUrl === '' ? null : body.linkedIssueUrl,
        ...(body.status ? { shippedAt: body.status === 'shipped' ? sql`coalesce(${gap.shippedAt}, now())` : null } : {}),
      })
      .where(own(id, c.var.orgId))
      .returning()
    return c.json(must(row, 'Product gap'))
  })
  .delete('/:id', async (c) => {
    const [row] = await db.delete(gap).where(own(c.req.param('id'), c.var.orgId)).returning({ id: gap.id })
    return c.json(must(row, 'Product gap'))
  })
  // ---- engagement links: which accounts hit this gap, how hard, and what revenue rides on it ----
  .post('/:id/engagements', v('json', engagementGapLinkSchema), async (c) => {
    const g = must(await db.query.productGap.findFirst({ columns: { id: true }, where: own(c.req.param('id'), c.var.orgId) }), 'Product gap')
    const body = c.req.valid('json')
    await assertEngagement(body.engagementId, c.var.orgId)
    const [row] = await db
      .insert(link)
      .values({ ...body, gapId: g.id })
      .onConflictDoUpdate({ target: [link.engagementId, link.gapId], set: { impact: body.impact, arrInfluenced: body.arrInfluenced, note: body.note } })
      .returning()
    return c.json(row!, 201)
  })
  .patch('/:id/engagements/:eid', v('json', engagementGapLinkSchema.omit({ engagementId: true }).partial()), async (c) => {
    must(await db.query.productGap.findFirst({ columns: { id: true }, where: own(c.req.param('id'), c.var.orgId) }), 'Product gap')
    const [row] = await db
      .update(link)
      .set(c.req.valid('json'))
      .where(and(eq(link.gapId, c.req.param('id')), eq(link.engagementId, c.req.param('eid'))))
      .returning()
    return c.json(must(row, 'Link'))
  })
  .delete('/:id/engagements/:eid', async (c) => {
    must(await db.query.productGap.findFirst({ columns: { id: true }, where: own(c.req.param('id'), c.var.orgId) }), 'Product gap')
    const [row] = await db
      .delete(link)
      .where(and(eq(link.gapId, c.req.param('id')), eq(link.engagementId, c.req.param('eid'))))
      .returning({ gapId: link.gapId })
    return c.json(must(row, 'Link'))
  })

