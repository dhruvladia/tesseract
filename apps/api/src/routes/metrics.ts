import type { HandoffKind } from '@tesseract/shared'
import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db, schema } from '../db/index.ts'
import { requireOrg, type OrgEnv } from '../middleware/org.ts'

const { engagement: eng } = schema
const HOUR = 3_600_000
const DAY = 24 * HOUR

const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}
const round1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10)

export type HandoffMetric = {
  createdAt: string
  acceptedAt: string | null
  hoursToAccept: number | null
  reopens: number
  gapsAddedAfterAcceptance: number
  thinConfirmations: number | null
  unclearAtAcceptance: number | null
  notDiscussedAtAcceptance: number | null
  draftItemsProposed: number
  draftItemsApplied: number
}

// Everything the reviewer asked to watch: how long the gate takes, whether it is respected,
// and whether kickoff produces clarification loops. Computed from event logs, not snapshots.
export const metrics = new Hono<OrgEnv>().use(requireOrg).get('/handoffs', async (c) => {
  const rows = await db.query.engagement.findMany({
    where: eq(eng.organizationId, c.var.orgId),
    columns: { id: true, name: true, side: true, phase: true, createdAt: true, closedAt: true },
    with: {
      account: { columns: { key: true } },
      handoffs: { columns: { id: true, kind: true, createdAt: true, acceptedAt: true }, with: { events: { orderBy: asc(schema.handoffEvent.createdAt) } } },
      phaseEvents: { orderBy: asc(schema.phaseEvent.createdAt) },
      outcomes: { columns: { firstValueVerifiedAt: true } },
    },
  })

  const perEngagement = rows.map((e) => {
    const handoffs: Partial<Record<HandoffKind, HandoffMetric>> = {}
    for (const h of e.handoffs) {
      const accepted = [...h.events].reverse().find((ev) => ev.event === 'accepted')
      const meta = (accepted?.meta ?? {}) as Record<string, number>
      const draft = h.events.filter((ev) => ev.event === 'draft_applied').map((ev) => (ev.meta ?? {}) as Record<string, number>)
      handoffs[h.kind] = {
        createdAt: h.createdAt.toISOString(),
        acceptedAt: h.acceptedAt?.toISOString() ?? null,
        hoursToAccept: h.acceptedAt ? round1(Math.max(0, h.acceptedAt.getTime() - h.createdAt.getTime()) / HOUR) : null,
        reopens: h.events.filter((ev) => ev.event === 'reopened').length,
        gapsAddedAfterAcceptance: h.events.filter((ev) => ev.event === 'gap_added' && (ev.meta as { afterAcceptance?: boolean } | null)?.afterAcceptance).length,
        thinConfirmations: accepted ? (meta.thinConfirmations ?? 0) : null,
        unclearAtAcceptance: accepted ? (meta.unclear ?? 0) : null,
        notDiscussedAtAcceptance: accepted ? (meta.notDiscussed ?? 0) : null,
        draftItemsProposed: draft.reduce((n, m) => n + (m.proposed ?? 0), 0),
        draftItemsApplied: draft.reduce((n, m) => n + (m.applied ?? 0), 0),
      }
    }
    const tw = e.phaseEvents.find((p) => p.to === 'technical_win')
    const ko = e.phaseEvents.find((p) => p.to === 'kickoff')
    const techWinToKickoffDays = tw && ko && ko.createdAt > tw.createdAt ? round1((ko.createdAt.getTime() - tw.createdAt.getTime()) / DAY) : null
    const start = ko?.createdAt ?? (e.side === 'postsales' ? e.createdAt : null)
    const fv = e.outcomes.map((o) => o.firstValueVerifiedAt).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0]
    const timeToFirstValueDays = start && fv ? round1(Math.max(0, (fv.getTime() - start.getTime()) / DAY)) : null
    return {
      engagementId: e.id,
      name: e.name,
      accountKey: e.account.key,
      side: e.side,
      phase: e.phase,
      handoffs,
      techWinToKickoffDays,
      timeToFirstValueDays,
      phaseChanges: e.phaseEvents.length,
    }
  })

  const all = perEngagement.flatMap((r) => Object.values(r.handoffs))
  const byKind = (k: HandoffKind) => perEngagement.map((r) => r.handoffs[k]).filter((h): h is HandoffMetric => !!h)
  const aggregates = {
    handoffs: all.length,
    accepted: all.filter((h) => h.acceptedAt).length,
    medianHoursToAcceptPreToPost: round1(median(byKind('pre_to_post').map((h) => h.hoursToAccept).filter((x): x is number => x != null))),
    medianHoursToAcceptPostToCs: round1(median(byKind('post_to_cs').map((h) => h.hoursToAccept).filter((x): x is number => x != null))),
    medianTechWinToKickoffDays: round1(median(perEngagement.map((r) => r.techWinToKickoffDays).filter((x): x is number => x != null))),
    medianTimeToFirstValueDays: round1(median(perEngagement.map((r) => r.timeToFirstValueDays).filter((x): x is number => x != null))),
    reopens: all.reduce((n, h) => n + h.reopens, 0),
    gapsAddedAfterAcceptance: all.reduce((n, h) => n + h.gapsAddedAfterAcceptance, 0),
    thinConfirmations: all.reduce((n, h) => n + (h.thinConfirmations ?? 0), 0),
    acceptedWithThinConfirmations: all.filter((h) => (h.thinConfirmations ?? 0) > 0).length,
    acceptedMostlyNotDiscussed: all.filter((h) => (h.notDiscussedAtAcceptance ?? 0) >= 5).length,
    draftItemsProposed: all.reduce((n, h) => n + h.draftItemsProposed, 0),
    draftItemsApplied: all.reduce((n, h) => n + h.draftItemsApplied, 0),
  }

  return c.json({ aggregates, rows: perEngagement })
})
