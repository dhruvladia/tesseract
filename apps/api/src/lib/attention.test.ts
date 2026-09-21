import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeAttention, type AttentionInput } from './attention.ts'

const now = new Date('2026-09-21T12:00:00Z')
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000)
const allMarked = Object.fromEntries(
  ['customer_overview', 'goals_success_criteria', 'use_cases_scope', 'configuration_requirements', 'integrations_constraints', 'stakeholders_roles', 'timeline_milestones', 'risks_open_questions'].map((k) => [k, { state: 'confirmed' }]),
)
const base = (over: Partial<AttentionInput>): AttentionInput => ({
  id: 'e1',
  name: 'Claims',
  side: 'presales',
  phase: 'technical_win',
  phaseEnteredAt: daysAgo(2),
  fdeId: 'fde',
  engagementManagerId: 'em',
  aeId: 'ae',
  csmId: 'csm',
  account: { key: 'NWB', stakeholders: [{ role: 'sponsor' }, { role: 'technical_owner' }, { role: 'workflow_owner' }] },
  handoffs: [],
  milestones: [],
  outcomes: [],
  overdueIssues: [],
  ...over,
})
const kinds = (items: ReturnType<typeof computeAttention>) => items.map((i) => i.kind)

test('technical win with no handoff record is flagged, routed to the AE', () => {
  const items = computeAttention([base({})], now)
  assert.deepEqual(kinds(items), ['handoff_missing'])
  assert.equal(items[0]!.ownerId, 'ae')
})

test('ready handoff routes to the receiving side; blocking and unowned gaps route to their owners', () => {
  const ready = base({ handoffs: [{ kind: 'pre_to_post', acceptedAt: null, sections: allMarked, gaps: [] }] })
  const r = computeAttention([ready], now)
  assert.deepEqual(kinds(r), ['handoff_ready'])
  assert.equal(r[0]!.ownerId, 'em')

  const blocked = base({
    handoffs: [{ kind: 'pre_to_post', acceptedAt: null, sections: allMarked, gaps: [{ id: 'g', title: 'No replica', severity: 'blocking', ownerId: null, resolvedAt: null }] }],
  })
  const b = computeAttention([blocked], now)
  assert.deepEqual(kinds(b).sort(), ['gap_unowned', 'handoff_blocked'])
  assert.equal(b.find((i) => i.kind === 'handoff_blocked')!.ownerId, 'fde', 'unowned blocking gap falls back to the builder')
})

test('accepted handoffs and closed engagements produce nothing', () => {
  const e = base({ phase: 'closed', handoffs: [{ kind: 'pre_to_post', acceptedAt: daysAgo(1), sections: {}, gaps: [] }] })
  assert.deepEqual(computeAttention([e], now), [])
})

test('ownership and stakeholder checks', () => {
  const e = base({ phase: 'scope', fdeId: null, account: { key: 'X', stakeholders: [{ role: 'sponsor' }] } })
  const items = computeAttention([e], now)
  assert.deepEqual(kinds(items).sort(), ['missing_owner', 'missing_stakeholders'])
  assert.match(items.find((i) => i.kind === 'missing_stakeholders')!.title, /technical owner, workflow owner/)
  // qualify is exempt from both
  assert.deepEqual(computeAttention([base({ phase: 'qualify', fdeId: null, account: { key: 'X', stakeholders: [] } })], now), [])
})

test('momentum: stale phase, overdue milestone and issue, missing first value; sorted by severity', () => {
  const e = base({
    side: 'postsales',
    phase: 'live',
    phaseEnteredAt: daysAgo(50),
    milestones: [{ title: 'Prod', targetDate: '2026-09-01', completedAt: null }, { title: 'Done', targetDate: '2026-09-01', completedAt: daysAgo(3) }],
    outcomes: [{ firstValueVerifiedAt: null }],
    overdueIssues: [{ id: 'i1', identifier: 'NWB-4', title: 'PII masking', assigneeId: 'grace', dueDate: '2026-09-20' }],
  })
  const items = computeAttention([e], now)
  assert.deepEqual(kinds(items), ['stale_engagement', 'milestone_overdue', 'no_first_value', 'issue_overdue'])
  assert.equal(items[0]!.severity, 'high', '50 days is very stale')
  assert.equal(items.find((i) => i.kind === 'issue_overdue')!.ownerId, 'grace')
})
