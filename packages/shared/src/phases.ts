import { POSTSALES_PHASES, PRESALES_PHASES, type HandoffKind, type Phase, type Side } from './enums.ts'

export type HandoffGate = {
  kind: HandoffKind
  acceptedAt: string | Date | null
  gaps: { severity: string; resolvedAt: string | Date | null }[]
}

export type EngagementLike = { side: Side; phase: Phase }

export const sideOf = (phase: Phase): Side | null =>
  (PRESALES_PHASES as readonly string[]).includes(phase)
    ? 'presales'
    : (POSTSALES_PHASES as readonly string[]).includes(phase)
      ? 'postsales'
      : null

export const phasesFor = (side: Side): readonly Phase[] => (side === 'presales' ? PRESALES_PHASES : POSTSALES_PHASES)

/** A handoff is complete when it has been accepted and no blocking gap remains unresolved. */
export function handoffComplete(h: HandoffGate | null | undefined): boolean {
  if (!h?.acceptedAt) return false
  return !h.gaps.some((g) => g.severity === 'blocking' && !g.resolvedAt)
}

export type TransitionResult = { ok: true } | { ok: false; reason: string }

/**
 * The one place the engagement lifecycle is defined. Server enforces, client greys out.
 *
 * - Free movement between phases on the same side (forward or back).
 * - technical_win -> kickoff (pre to post) requires a complete `pre_to_post` handoff.
 * - handed_off -> closed requires a complete `post_to_cs` handoff.
 * - Any pre-sales phase -> closed is allowed (lost / deferred).
 * - closed is terminal.
 */
export function canTransition(e: EngagementLike, to: Phase, handoffs: HandoffGate[] = []): TransitionResult {
  if (e.phase === 'closed') return { ok: false, reason: 'Engagement is closed' }
  if (to === e.phase) return { ok: true }
  const find = (k: HandoffKind) => handoffs.find((h) => h.kind === k)

  if (to === 'closed') {
    if (e.side === 'presales') return { ok: true }
    if (e.phase !== 'handed_off') return { ok: false, reason: 'Reach Handed Off before closing a post-sales engagement' }
    return handoffComplete(find('post_to_cs'))
      ? { ok: true }
      : { ok: false, reason: 'Post-sales to CS handoff must be accepted with no unresolved blocking gaps' }
  }

  const targetSide = sideOf(to)
  if (!targetSide) return { ok: false, reason: `Unknown phase ${to}` }
  if (targetSide === e.side) return { ok: true }

  if (e.side === 'presales' && to === 'kickoff') {
    if (e.phase !== 'technical_win') return { ok: false, reason: 'Reach Technical Win before converting to post-sales' }
    return handoffComplete(find('pre_to_post'))
      ? { ok: true }
      : { ok: false, reason: 'Pre-sales to post-sales handoff must be accepted with no unresolved blocking gaps' }
  }
  return { ok: false, reason: 'Cannot move across sides except Technical Win to Kickoff' }
}

/** Phases a card may be dropped into from its current state (used by the boards). */
export function allowedTargets(e: EngagementLike, handoffs: HandoffGate[] = []): Phase[] {
  const all: Phase[] = [...PRESALES_PHASES, ...POSTSALES_PHASES, 'closed']
  return all.filter((p) => canTransition(e, p, handoffs).ok)
}
