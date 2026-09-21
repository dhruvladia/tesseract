import {
  HANDOFF_SECTION_KEYS,
  handoffKindSchema,
  handoffUpsertSchema,
  milestoneCreateSchema,
  milestoneUpdateSchema,
  outcomeCreateSchema,
  outcomeUpdateSchema,
} from '@tesseract/shared'
import { and, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { db, schema } from '../db/index.ts'
import { diffHandoff, logHandoffEvents, thinConfirmations } from '../lib/events.ts'
import { badRequest, must, v } from '../lib/http.ts'
import { requireOrg, type OrgEnv } from '../middleware/org.ts'

const { engagement: eng, outcome, milestone, handoff } = schema

const own = (id: string, orgId: string) => and(eq(eng.id, id), eq(eng.organizationId, orgId))
const toDate = (s: string | null | undefined) => (s === undefined ? undefined : s ? new Date(s) : null)

// Outcomes, milestones and handoffs all hang off /api/engagements/:id/...
export const engagementExtras = new Hono<OrgEnv>()
  .use(requireOrg)
  // ---- outcome contract ----
  .post('/:id/outcomes', v('json', outcomeCreateSchema), async (c) => {
    const e = must(await db.query.engagement.findFirst({ columns: { id: true }, where: own(c.req.param('id'), c.var.orgId) }), 'Engagement')
    const b = c.req.valid('json')
    const [row] = await db
      .insert(outcome)
      .values({ ...b, firstValueVerifiedAt: toDate(b.firstValueVerifiedAt), engagementId: e.id, organizationId: c.var.orgId })
      .returning()
    return c.json(row!, 201)
  })
  .patch('/:id/outcomes/:oid', v('json', outcomeUpdateSchema), async (c) => {
    const b = c.req.valid('json')
    const [row] = await db
      .update(outcome)
      .set({ ...b, firstValueVerifiedAt: toDate(b.firstValueVerifiedAt) })
      .where(and(eq(outcome.id, c.req.param('oid')), eq(outcome.engagementId, c.req.param('id')), eq(outcome.organizationId, c.var.orgId)))
      .returning()
    return c.json(must(row, 'Outcome'))
  })
  .delete('/:id/outcomes/:oid', async (c) => {
    const [row] = await db
      .delete(outcome)
      .where(and(eq(outcome.id, c.req.param('oid')), eq(outcome.organizationId, c.var.orgId)))
      .returning({ id: outcome.id })
    return c.json(must(row, 'Outcome'))
  })
  // ---- milestones ----
  .post('/:id/milestones', v('json', milestoneCreateSchema), async (c) => {
    const e = must(await db.query.engagement.findFirst({ columns: { id: true }, where: own(c.req.param('id'), c.var.orgId) }), 'Engagement')
    const b = c.req.valid('json')
    const [row] = await db
      .insert(milestone)
      .values({ ...b, completedAt: toDate(b.completedAt), engagementId: e.id, organizationId: c.var.orgId })
      .returning()
    return c.json(row!, 201)
  })
  .patch('/:id/milestones/:mid', v('json', milestoneUpdateSchema), async (c) => {
    const b = c.req.valid('json')
    const [row] = await db
      .update(milestone)
      .set({ ...b, completedAt: toDate(b.completedAt) })
      .where(and(eq(milestone.id, c.req.param('mid')), eq(milestone.engagementId, c.req.param('id')), eq(milestone.organizationId, c.var.orgId)))
      .returning()
    return c.json(must(row, 'Milestone'))
  })
  .delete('/:id/milestones/:mid', async (c) => {
    const [row] = await db
      .delete(milestone)
      .where(and(eq(milestone.id, c.req.param('mid')), eq(milestone.organizationId, c.var.orgId)))
      .returning({ id: milestone.id })
    return c.json(must(row, 'Milestone'))
  })
  // ---- handoffs: one record per (engagement, kind); PUT upserts the working draft ----
  .put('/:id/handoffs/:kind', v('param', z.object({ id: z.string(), kind: handoffKindSchema })), v('json', handoffUpsertSchema), async (c) => {
    const { id, kind } = c.req.valid('param')
    const e = must(await db.query.engagement.findFirst({ columns: { id: true }, where: own(id, c.var.orgId) }), 'Engagement')
    const b = c.req.valid('json')
    const ownerIds = [...new Set(b.gaps.map((g) => g.ownerId).filter((x): x is string => !!x))]
    if (ownerIds.length) {
      const members = await db.select({ userId: schema.member.userId }).from(schema.member).where(and(eq(schema.member.organizationId, c.var.orgId), inArray(schema.member.userId, ownerIds)))
      const known = new Set(members.map((m) => m.userId))
      const bad = ownerIds.filter((o) => !known.has(o))
      if (bad.length) throw badRequest(`Gap owner must be a member of this organization (${bad.length} unknown). Pick people from the member list.`)
    }
    const row = await db.transaction(async (tx) => {
      const before = await tx.query.handoff.findFirst({ where: and(eq(handoff.engagementId, e.id), eq(handoff.kind, kind)) })
      const [row] = await tx
        .insert(handoff)
        .values({ engagementId: e.id, organizationId: c.var.orgId, kind, sections: b.sections, gaps: b.gaps, createdById: c.var.userId })
        .onConflictDoUpdate({ target: [handoff.engagementId, handoff.kind], set: { sections: b.sections, gaps: b.gaps } })
        .returning()
      await logHandoffEvents(diffHandoff(before, row!, c.var.userId), tx)
      return row!
    })
    return c.json(row)
  })
  // Acceptance is the receiving side saying "I can execute from this". Requires every section
  // marked and no unresolved blocking gap (Medium/Low gaps may carry forward with an owner).
  .post('/:id/handoffs/:kind/accept', v('param', z.object({ id: z.string(), kind: handoffKindSchema })), async (c) => {
    const { id, kind } = c.req.valid('param')
    const h = must(
      await db.query.handoff.findFirst({
        where: and(eq(handoff.engagementId, id), eq(handoff.kind, kind), eq(handoff.organizationId, c.var.orgId)),
      }),
      'Handoff',
    )
    const missing = HANDOFF_SECTION_KEYS.filter((k) => !h.sections[k]?.state)
    if (missing.length) throw badRequest(`Mark every section first (${missing.length} unmarked)`)
    const untitled = h.gaps.filter((g) => !g.title.trim())
    if (untitled.length) throw badRequest(`${untitled.length} gap${untitled.length > 1 ? 's have' : ' has'} no title`)
    const blocking = h.gaps.filter((g) => g.severity === 'blocking' && !g.resolvedAt)
    if (blocking.length) throw badRequest(`${blocking.length} blocking gap${blocking.length > 1 ? 's' : ''} must be resolved before acceptance`)
    const unowned = h.gaps.filter((g) => !g.resolvedAt && !g.ownerId)
    if (unowned.length) throw badRequest(`${unowned.length} open gap${unowned.length > 1 ? 's need' : ' needs'} an owner`)
    const row = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(handoff)
        .set({ acceptedById: c.var.userId, acceptedAt: new Date() })
        .where(eq(handoff.id, h.id))
        .returning()
      await logHandoffEvents(
        [
          {
            organizationId: c.var.orgId,
            handoffId: h.id,
            engagementId: h.engagementId,
            kind,
            actorId: c.var.userId,
            event: 'accepted',
            meta: {
              thinConfirmations: thinConfirmations(h.sections),
              confirmed: Object.values(h.sections).filter((s) => s?.state === 'confirmed').length,
              unclear: Object.values(h.sections).filter((s) => s?.state === 'unclear').length,
              notDiscussed: Object.values(h.sections).filter((s) => s?.state === 'not_discussed').length,
              openGaps: h.gaps.filter((g) => !g.resolvedAt).length,
            },
          },
        ],
        tx,
      )
      return row!
    })
    return c.json(row)
  })
  .post('/:id/handoffs/:kind/reopen', v('param', z.object({ id: z.string(), kind: handoffKindSchema })), async (c) => {
    const { id, kind } = c.req.valid('param')
    const row = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(handoff)
        .set({ acceptedById: null, acceptedAt: null })
        .where(and(eq(handoff.engagementId, id), eq(handoff.kind, kind), eq(handoff.organizationId, c.var.orgId)))
        .returning()
      const h = must(row, 'Handoff')
      await logHandoffEvents([{ organizationId: c.var.orgId, handoffId: h.id, engagementId: h.engagementId, kind, actorId: c.var.userId, event: 'reopened' }], tx)
      return h
    })
    return c.json(row)
  })
