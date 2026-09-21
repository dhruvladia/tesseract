import assert from 'node:assert/strict'
import { test } from 'node:test'
import { HANDOFF_SECTION_KEYS } from './enums.ts'
import { verifyDraft, type HandoffDraftProposal } from './handoff-draft.ts'

const source = [
  'Call with Northwind, Sep 18.',
  'Helen Marsh (VP Claims Ops) said the target is 80 claims per adjuster per day, up from 42.',
  'Raj owns the SQL Server 2016 box; “no direct DB access” — nightly extract only.',
  'Open question: what share of intake is scanned PDFs?',
].join('\n')

const notDiscussed = { state: 'not_discussed' as const, notes: '', evidence: [] as { quote: string; line: number }[] }
const sections = Object.fromEntries(HANDOFF_SECTION_KEYS.map((k) => [k, notDiscussed])) as unknown as HandoffDraftProposal['sections']

const proposal: HandoffDraftProposal = {
  sections: {
    ...sections,
    goals_success_criteria: { state: 'confirmed', notes: '80/day from 42', evidence: [{ quote: 'target is 80 claims per adjuster per day', line: 1 }] },
    integrations_constraints: { state: 'confirmed', notes: 'Nightly extract', evidence: [{ quote: '"no direct db access"  -  nightly extract only', line: 3 }] },
    timeline_milestones: { state: 'confirmed', notes: 'Go-live in Q4', evidence: [{ quote: 'go-live before Q4 close', line: 2 }] },
  },
  stakeholders: [
    { name: 'Helen Marsh', title: 'VP Claims Ops', role: 'sponsor', evidence: [{ quote: 'Helen Marsh (VP Claims Ops)', line: 2 }] },
    { name: 'Tom Alvarez', title: null, role: 'workflow_owner', evidence: [{ quote: 'Tom runs the stand-up', line: 2 }] },
  ],
  outcomes: [{ metric: 'Claims per adjuster per day', unit: 'claims/day', baseline: 42, target: 80, direction: 'up', evidence: [{ quote: 'up from 42', line: 2 }] }],
  commitments: [],
  gaps: [{ title: 'Share of scanned PDFs unknown', severity: 'medium', evidence: [{ quote: 'what share of intake is scanned PDFs', line: 4 }] }],
}

test('verified quotes keep their item and get their line corrected', () => {
  const v = verifyDraft(proposal, source)
  assert.equal(v.sections.goals_success_criteria.state, 'confirmed')
  assert.equal(v.sections.goals_success_criteria.evidence[0]!.line, 2, 'model said line 1; found on line 2')
  assert.equal(v.stakeholders[0]!.verified, true)
  assert.equal(v.gaps[0]!.verified, true)
})

test('whitespace, case and smart punctuation differences still verify', () => {
  const v = verifyDraft(proposal, source)
  assert.equal(v.sections.integrations_constraints.verified, true)
  assert.equal(v.sections.integrations_constraints.state, 'confirmed')
})

test('unsupported section is forced back to not_discussed with empty notes', () => {
  const v = verifyDraft(proposal, source)
  assert.equal(v.sections.timeline_milestones.state, 'not_discussed')
  assert.equal(v.sections.timeline_milestones.notes, '')
  assert.equal(v.sections.timeline_milestones.verified, false)
})

test('unsupported items stay in the draft but are flagged', () => {
  const v = verifyDraft(proposal, source)
  assert.equal(v.stakeholders[1]!.verified, false)
  assert.equal(v.stakeholders[1]!.name, 'Tom Alvarez')
  assert.deepEqual(v.stats, { proposed: 7, verified: 5 })
})

test('empty or tiny quotes never verify', () => {
  const v = verifyDraft({ ...proposal, gaps: [{ title: 'x', severity: 'low', evidence: [{ quote: 'a', line: 1 }] }] }, source)
  assert.equal(v.gaps[0]!.verified, false)
})
