import {
  canTransition,
  engagementCreateSchema,
  engagementUpdateSchema,
  phaseChangeSchema,
  phasesFor,
  SIDES,
  sideOf,
} from '@tesseract/shared'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { db, schema } from '../db/index.ts'
import { badRequest, must, v } from '../lib/http.ts'
import { requireOrg, type OrgEnv } from '../middleware/org.ts'

const { engagement: eng, customerAccount: acct, handoff, engagementGap, productGap, milestone } = schema

const listQuery = z.object({
  side: z.enum(SIDES).optional(),
  accountId: z.string().optional(),
  includeClosed: z.enum(['1', '0']).optional(),
})

const userCols = { id: true, name: true, image: true } as const

export const engagements = new Hono<OrgEnv>()
  .use(requireOrg)
  .get('/', v('query', listQuery), async (c) => {
    const q = c.req.valid('query')
    const rows = await db.query.engagement.findMany({
      where: and(
        eq(eng.organizationId, c.var.orgId),
        q.side ? eq(eng.side, q.side) : undefined,
        q.accountId ? eq(eng.accountId, q.accountId) : undefined,
        q.includeClosed === '1' ? undefined : inArray(eng.phase, [...phasesFor('presales'), ...phasesFor('postsales')]),
      ),
      with: {
        account: { columns: { id: true, name: true, key: true } },
        fde: { columns: userCols },
        engagementManager: { columns: userCols },
        milestones: {
          columns: { id: true, kind: true, title: true, targetDate: true, completedAt: true },
          orderBy: asc(milestone.targetDate),
        },
        handoffs: { columns: { kind: true, acceptedAt: true, gaps: true } },
        gaps: { columns: { impact: true } },
      },
      orderBy: [asc(eng.phaseEnteredAt)],
    })
    return c.json(rows)
  })
  .post('/', v('json', engagementCreateSchema), async (c) => {
    const body = c.req.valid('json')
    const a = must(
      await db.query.customerAccount.findFirst({
        columns: { id: true },
        where: and(eq(acct.id, body.accountId), eq(acct.organizationId, c.var.orgId)),
      }),
      'Account',
    )
    const phase = body.phase ?? phasesFor(body.side)[0]!
    if (sideOf(phase) !== body.side) throw badRequest(`Phase ${phase} is not on the ${body.side} side`)
    const [row] = await db
      .insert(eng)
      .values({ ...body, phase, accountId: a.id, organizationId: c.var.orgId })
      .returning()
    return c.json(row!, 201)
  })
  .get('/:id', async (c) => {
    const row = must(
      await db.query.engagement.findFirst({
        where: and(eq(eng.id, c.req.param('id')), eq(eng.organizationId, c.var.orgId)),
        with: {
          account: { with: { stakeholders: true } },
          fde: { columns: userCols },
          engagementManager: { columns: userCols },
          ae: { columns: userCols },
          csm: { columns: userCols },
          outcomes: true,
          milestones: { orderBy: asc(milestone.targetDate) },
          handoffs: true,
          threads: { orderBy: asc(schema.thread.createdAt) },
          gaps: { with: { gap: true } },
        },
      }),
      'Engagement',
    )
    return c.json(row)
  })
  .patch('/:id', v('json', engagementUpdateSchema), async (c) => {
    const [row] = await db
      .update(eng)
      .set(c.req.valid('json'))
      .where(and(eq(eng.id, c.req.param('id')), eq(eng.organizationId, c.var.orgId)))
      .returning()
    return c.json(must(row, 'Engagement'))
  })
  .delete('/:id', async (c) => {
    const [row] = await db
      .delete(eng)
      .where(and(eq(eng.id, c.req.param('id')), eq(eng.organizationId, c.var.orgId)))
      .returning({ id: eng.id })
    return c.json(must(row, 'Engagement'))
  })
  // Phase transitions are gated by the shared lifecycle rules (handoff completeness etc.).
  .post('/:id/phase', v('json', phaseChangeSchema), async (c) => {
    const { phase, outcome } = c.req.valid('json')
    const e = must(
      await db.query.engagement.findFirst({
        where: and(eq(eng.id, c.req.param('id')), eq(eng.organizationId, c.var.orgId)),
        with: { handoffs: { columns: { kind: true, acceptedAt: true, gaps: true } } },
      }),
      'Engagement',
    )
    const verdict = canTransition(e, phase, e.handoffs)
    if (!verdict.ok) throw badRequest(verdict.reason)
    const closing = phase === 'closed'
    const crossing = sideOf(phase) === 'postsales' && e.side === 'presales'
    const row = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(eng)
        .set({
          phase,
          side: crossing ? 'postsales' : e.side,
          phaseEnteredAt: new Date(),
          closedAt: closing ? new Date() : null,
          outcome: closing ? (outcome ?? (e.side === 'postsales' ? 'handed_off' : 'lost')) : crossing ? 'won' : e.outcome,
        })
        .where(eq(eng.id, e.id))
        .returning()
      if (phase !== e.phase) {
        await tx.insert(schema.phaseEvent).values({ organizationId: c.var.orgId, engagementId: e.id, from: e.phase, to: phase, actorId: c.var.userId })
      }
      return row!
    })
    return c.json(row)
  })
  // Lightweight list of gaps raised on this engagement (used by the Signals tab and boards).
  .get('/:id/gaps', async (c) => {
    const rows = await db
      .select({
        gapId: productGap.id,
        title: productGap.title,
        status: productGap.status,
        impact: engagementGap.impact,
        arrInfluenced: engagementGap.arrInfluenced,
        note: engagementGap.note,
      })
      .from(engagementGap)
      .innerJoin(productGap, eq(productGap.id, engagementGap.gapId))
      .innerJoin(eng, eq(eng.id, engagementGap.engagementId))
      .where(and(eq(engagementGap.engagementId, c.req.param('id')), eq(eng.organizationId, c.var.orgId)))
      .orderBy(desc(productGap.createdAt))
    return c.json(rows)
  })

// exported for other route files that need to assert ownership
export const engagementOwned = (id: string, orgId: string) => and(eq(eng.id, id), eq(eng.organizationId, orgId))
export type _Handoff = typeof handoff.$inferSelect
