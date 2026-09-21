import { HANDOFF_SECTION_KEYS, type HandoffEvent } from '@tesseract/shared'
import { db, schema, type Db } from '../db/index.ts'

const { handoffEvent } = schema

type HandoffRow = typeof schema.handoff.$inferSelect
type EventInsert = typeof handoffEvent.$inferInsert

/** Notes shorter than this on a `confirmed` section count as a "thin confirmation" (gate worked around). */
export const THIN_NOTES_CHARS = 20

export function thinConfirmations(sections: HandoffRow['sections']) {
  return HANDOFF_SECTION_KEYS.filter((k) => sections[k]?.state === 'confirmed' && (sections[k]?.notes ?? '').trim().length < THIN_NOTES_CHARS).length
}

/** Diff a handoff draft save into discrete events so metrics can be computed later. */
export function diffHandoff(before: HandoffRow | undefined, after: HandoffRow, actorId: string): EventInsert[] {
  const base = { organizationId: after.organizationId, handoffId: after.id, engagementId: after.engagementId, kind: after.kind, actorId }
  const ev = (event: HandoffEvent, meta?: Record<string, unknown>): EventInsert => ({ ...base, event, meta })
  const out: EventInsert[] = []
  if (!before) out.push(ev('created'))

  for (const k of HANDOFF_SECTION_KEYS) {
    const b = before?.sections[k]?.state
    const a = after.sections[k]?.state
    if (a && a !== b) out.push(ev('section_marked', { section: k, state: a, from: b ?? null }))
  }

  const prev = new Map((before?.gaps ?? []).map((g) => [g.id, g]))
  for (const g of after.gaps) {
    const p = prev.get(g.id)
    if (!p) out.push(ev('gap_added', { gapId: g.id, severity: g.severity, title: g.title, afterAcceptance: !!before?.acceptedAt }))
    else if (!p.resolvedAt && g.resolvedAt) out.push(ev('gap_resolved', { gapId: g.id, severity: g.severity }))
    else if (p.resolvedAt && !g.resolvedAt) out.push(ev('gap_reopened', { gapId: g.id, severity: g.severity }))
  }
  return out
}

export async function logHandoffEvents(rows: EventInsert[], tx: Db = db) {
  if (rows.length) await tx.insert(handoffEvent).values(rows)
}
