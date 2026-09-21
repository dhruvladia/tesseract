import { HANDOFF_SECTION_KEYS, PHASES, type HandoffKind, type Phase, type Side } from '@tesseract/shared'

// Pure: no DB. The route loads engagements and hands them here; tests can feed fixtures.

export const ATTENTION_KINDS = [
  'handoff_ready',
  'handoff_blocked',
  'handoff_missing',
  'gap_unowned',
  'missing_owner',
  'missing_stakeholders',
  'stale_engagement',
  'milestone_overdue',
  'issue_overdue',
  'no_first_value',
] as const
export type AttentionKind = (typeof ATTENTION_KINDS)[number]

export type AttentionItem = {
  kind: AttentionKind
  severity: 'high' | 'medium' | 'low'
  engagementId: string
  engagementName: string
  accountKey: string
  side: Side
  title: string
  detail: string
  ownerId: string | null
  tab: 'overview' | 'work' | 'stakeholders' | 'handoffs' | 'signals'
  issueId?: string
}

export type AttentionInput = {
  id: string
  name: string
  side: Side
  phase: Phase
  phaseEnteredAt: Date | string
  fdeId: string | null
  engagementManagerId: string | null
  aeId: string | null
  csmId: string | null
  account: { key: string; stakeholders: { role: string }[] }
  handoffs: {
    kind: HandoffKind
    acceptedAt: Date | string | null
    sections: Record<string, { state?: string } | undefined>
    gaps: { id: string; title: string; severity: string; ownerId: string | null; resolvedAt: string | null }[]
  }[]
  milestones: { title: string; targetDate: string | null; completedAt: Date | string | null }[]
  outcomes: { firstValueVerifiedAt: Date | string | null }[]
  overdueIssues: { id: string; identifier: string; title: string; assigneeId: string | null; dueDate: string }[]
}

// ponytail: fixed thresholds; a per-organization setting is the upgrade path.
export const STALE_DAYS = 21
export const VERY_STALE_DAYS = 45
const REQUIRED_ROLES = ['sponsor', 'technical_owner', 'workflow_owner'] as const
const ROLE_LABEL: Record<(typeof REQUIRED_ROLES)[number], string> = { sponsor: 'sponsor', technical_owner: 'technical owner', workflow_owner: 'workflow owner' }

const phaseIdx = (p: Phase) => PHASES.indexOf(p)
const daysBetween = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / 86_400_000)

export function computeAttention(engagements: AttentionInput[], now = new Date()): AttentionItem[] {
  const out: AttentionItem[] = []
  const today = now.toISOString().slice(0, 10)

  for (const e of engagements) {
    if (e.phase === 'closed') continue
    const base = { engagementId: e.id, engagementName: e.name, accountKey: e.account.key, side: e.side }
    const push = (item: Omit<AttentionItem, keyof typeof base>) => out.push({ ...base, ...item })
    const coordinator = e.engagementManagerId ?? e.aeId ?? e.fdeId
    const builder = e.fdeId ?? e.engagementManagerId

    // --- handoffs: the gate that matters most ---
    const relevantKind: HandoffKind | null = e.phase === 'technical_win' ? 'pre_to_post' : e.phase === 'handed_off' ? 'post_to_cs' : null
    for (const h of e.handoffs) {
      if (h.acceptedAt) continue
      const marked = HANDOFF_SECTION_KEYS.filter((k) => h.sections[k]?.state).length
      const openGaps = h.gaps.filter((g) => !g.resolvedAt)
      const blocking = openGaps.filter((g) => g.severity === 'blocking')
      const unowned = openGaps.filter((g) => !g.ownerId)
      const receiver = h.kind === 'pre_to_post' ? (e.engagementManagerId ?? e.fdeId) : (e.csmId ?? e.engagementManagerId)
      const label = h.kind === 'pre_to_post' ? 'Pre-sales → post-sales' : 'Post-sales → CS'

      if (marked === HANDOFF_SECTION_KEYS.length && blocking.length === 0 && unowned.length === 0) {
        push({
          kind: 'handoff_ready',
          severity: 'high',
          title: `${label} handoff is ready to accept`,
          detail: 'All sections marked, no blocking gaps, every open gap owned. Acceptance unlocks the next phase.',
          ownerId: receiver,
          tab: 'handoffs',
        })
      }
      if (h.kind === relevantKind) {
        for (const g of blocking) {
          push({
            kind: 'handoff_blocked',
            severity: 'high',
            title: `Blocking gap: ${g.title || 'untitled'}`,
            detail: `${label} handoff cannot be accepted until this is resolved.`,
            ownerId: g.ownerId ?? builder,
            tab: 'handoffs',
          })
        }
      }
      for (const g of unowned) {
        push({
          kind: 'gap_unowned',
          severity: g.severity === 'blocking' ? 'high' : 'medium',
          title: `Gap without an owner: ${g.title || 'untitled'}`,
          detail: `${label} handoff · ${g.severity}. Acceptance requires every open gap to have an owner.`,
          ownerId: coordinator,
          tab: 'handoffs',
        })
      }
    }
    if (relevantKind && !e.handoffs.some((h) => h.kind === relevantKind)) {
      push({
        kind: 'handoff_missing',
        severity: 'high',
        title: relevantKind === 'pre_to_post' ? 'No handoff record yet; conversion is blocked' : 'No CS handoff record yet; close is blocked',
        detail: 'Start the handoff on the Handoffs tab. Sections can be drafted from call notes.',
        ownerId: relevantKind === 'pre_to_post' ? (e.aeId ?? builder) : builder,
        tab: 'handoffs',
      })
    }

    // --- ownership ---
    if (!e.fdeId && phaseIdx(e.phase) > phaseIdx('qualify')) {
      push({ kind: 'missing_owner', severity: 'high', title: 'No FDE assigned', detail: 'Past Qualify without a builder who owns the technical outcome.', ownerId: coordinator, tab: 'overview' })
    }
    if (e.side === 'postsales' && !e.engagementManagerId) {
      push({ kind: 'missing_owner', severity: 'medium', title: 'No engagement manager', detail: 'Post-sales needs someone who owns stakeholders, sequencing and adoption.', ownerId: e.fdeId ?? e.aeId, tab: 'overview' })
    }
    if (phaseIdx(e.phase) >= phaseIdx('scope')) {
      const have = new Set(e.account.stakeholders.map((s) => s.role))
      const missing = REQUIRED_ROLES.filter((r) => !have.has(r))
      if (missing.length) {
        push({
          kind: 'missing_stakeholders',
          severity: e.side === 'postsales' ? 'high' : 'medium',
          title: `Account has no named ${missing.map((r) => ROLE_LABEL[r]).join(', ')}`,
          detail: 'Qualification and handoff both need a sponsor, a technical owner and a workflow owner.',
          ownerId: coordinator,
          tab: 'stakeholders',
        })
      }
    }

    // --- momentum ---
    const inPhase = daysBetween(now, new Date(e.phaseEnteredAt))
    if (inPhase >= STALE_DAYS) {
      push({
        kind: 'stale_engagement',
        severity: inPhase >= VERY_STALE_DAYS ? 'high' : 'medium',
        title: `${inPhase} days in ${e.phase.replace('_', ' ')}`,
        detail: 'Move it, close it, or write down why it is waiting.',
        ownerId: builder,
        tab: 'overview',
      })
    }
    for (const m of e.milestones) {
      if (m.targetDate && !m.completedAt && m.targetDate < today) {
        push({ kind: 'milestone_overdue', severity: 'medium', title: `Milestone overdue: ${m.title}`, detail: `Target was ${m.targetDate}.`, ownerId: builder, tab: 'overview' })
      }
    }
    for (const i of e.overdueIssues) {
      push({ kind: 'issue_overdue', severity: 'low', title: `${i.identifier} overdue: ${i.title}`, detail: `Due ${i.dueDate}.`, ownerId: i.assigneeId ?? builder, tab: 'work', issueId: i.id })
    }
    if ((e.phase === 'live' || e.phase === 'adopt') && e.outcomes.length > 0 && !e.outcomes.some((o) => o.firstValueVerifiedAt)) {
      push({
        kind: 'no_first_value',
        severity: 'medium',
        title: 'Live, but first value never verified',
        detail: 'Record the first verified movement on an outcome metric, or the time-to-value clock never stops.',
        ownerId: builder,
        tab: 'overview',
      })
    }
  }

  const rank = { high: 0, medium: 1, low: 2 }
  return out.sort((a, b) => rank[a.severity] - rank[b.severity] || ATTENTION_KINDS.indexOf(a.kind) - ATTENTION_KINDS.indexOf(b.kind))
}
