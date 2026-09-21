import { z } from 'zod'
import { GAP_SEVERITIES, HANDOFF_SECTION_KEYS, HANDOFF_SECTION_STATES, OUTCOME_DIRECTIONS, STAKEHOLDER_ROLES, type HandoffSectionKey } from './enums.ts'

// ---- What the model returns -------------------------------------------------------
// Every field is required or nullable (never optional) so strict JSON-schema modes accept it.

export const evidenceSchema = z.object({
  quote: z.string().min(1).describe('Verbatim excerpt from the source, 3 to 40 words'),
  line: z.number().int().min(1).describe('1-based line number in the source where the quote appears'),
})
export type Evidence = z.infer<typeof evidenceSchema>

const sectionProposal = z.object({
  state: z.enum(HANDOFF_SECTION_STATES),
  notes: z.string().describe('Concise summary for this section, empty when not_discussed'),
  evidence: z.array(evidenceSchema),
})

export const handoffDraftSchema = z.object({
  sections: z.object(Object.fromEntries(HANDOFF_SECTION_KEYS.map((k) => [k, sectionProposal])) as Record<HandoffSectionKey, typeof sectionProposal>),
  stakeholders: z.array(
    z.object({
      name: z.string().min(1),
      title: z.string().nullable(),
      role: z.enum(STAKEHOLDER_ROLES),
      evidence: z.array(evidenceSchema),
    }),
  ),
  outcomes: z.array(
    z.object({
      metric: z.string().min(1),
      unit: z.string().nullable(),
      baseline: z.number().nullable(),
      target: z.number().nullable(),
      direction: z.enum(OUTCOME_DIRECTIONS),
      evidence: z.array(evidenceSchema),
    }),
  ),
  commitments: z.array(
    z.object({
      title: z.string().min(1).describe('Who committed to what'),
      targetDate: z.string().nullable().describe('YYYY-MM-DD if a date was stated, else null'),
      evidence: z.array(evidenceSchema),
    }),
  ),
  gaps: z.array(
    z.object({
      title: z.string().min(1).describe('An unresolved question or missing piece'),
      severity: z.enum(GAP_SEVERITIES),
      evidence: z.array(evidenceSchema),
    }),
  ),
})
export type HandoffDraftProposal = z.infer<typeof handoffDraftSchema>

// ---- What we store and show: the proposal plus verification flags -----------------

export type VerifiedEvidence = Evidence & { verified: boolean; sourceId?: string }
type Verified<T extends { evidence: Evidence[] }> = Omit<T, 'evidence'> & { evidence: VerifiedEvidence[]; verified: boolean }

export type VerifiedDraft = {
  sections: Record<HandoffSectionKey, Verified<HandoffDraftProposal['sections'][HandoffSectionKey]>>
  stakeholders: Verified<HandoffDraftProposal['stakeholders'][number]>[]
  outcomes: Verified<HandoffDraftProposal['outcomes'][number]>[]
  commitments: Verified<HandoffDraftProposal['commitments'][number]>[]
  gaps: Verified<HandoffDraftProposal['gaps'][number]>[]
  stats: { proposed: number; verified: number }
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\u2018\u2019\u201a\u201b]/g, "'")
    .replace(/[\u201c\u201d\u201e\u201f]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Trust boundary between the model and the record. A quote counts only if it appears verbatim
 * (modulo whitespace, case and smart punctuation) in the source; its line number is corrected
 * to where it was actually found. Items with no verified quote are marked unverified; sections
 * with no verified quote are forced back to "not discussed" so nothing unsupported looks confident.
 */
export function verifyDraft(proposal: HandoffDraftProposal, sourceText: string, sourceId?: string): VerifiedDraft {
  const lines = sourceText.split(/\r?\n/)
  const normLines = lines.map(normalize)
  const normAll = normLines.join(' ')

  const check = (ev: Evidence): VerifiedEvidence => {
    const q = normalize(ev.quote)
    if (q.length < 3) return { ...ev, verified: false, sourceId }
    const lineIdx = normLines.findIndex((l) => l.includes(q))
    if (lineIdx >= 0) return { quote: ev.quote, line: lineIdx + 1, verified: true, sourceId }
    // quote may span a line break
    return { ...ev, verified: normAll.includes(q), sourceId }
  }
  const verify = <T extends { evidence: Evidence[] }>(item: T): Verified<T> => {
    const evidence = item.evidence.map(check)
    return { ...item, evidence, verified: evidence.some((e) => e.verified) }
  }

  const sections = Object.fromEntries(
    HANDOFF_SECTION_KEYS.map((k) => {
      const v = verify(proposal.sections[k])
      if (v.state !== 'not_discussed' && !v.verified) return [k, { ...v, state: 'not_discussed' as const, notes: '' }]
      return [k, v]
    }),
  ) as VerifiedDraft['sections']

  const stakeholders = proposal.stakeholders.map(verify)
  const outcomes = proposal.outcomes.map(verify)
  const commitments = proposal.commitments.map(verify)
  const gaps = proposal.gaps.map(verify)

  // `proposed` counts what the model claimed (before verification) so the ratio is honest.
  const proposedSections = HANDOFF_SECTION_KEYS.filter((k) => proposal.sections[k].state !== 'not_discussed').length
  const lists = [...stakeholders, ...outcomes, ...commitments, ...gaps]
  const verifiedSections = Object.values(sections).filter((s) => s.state !== 'not_discussed' && s.verified).length
  return {
    sections,
    stakeholders,
    outcomes,
    commitments,
    gaps,
    stats: { proposed: proposedSections + lists.length, verified: verifiedSections + lists.filter((i) => i.verified).length },
  }
}

// ---- What a person applies (already reviewed and possibly edited) -----------------

const verifiedEvidence = evidenceSchema.extend({ verified: z.boolean() })
export const handoffDraftApplySchema = z.object({
  sections: z.partialRecord(
    z.enum(HANDOFF_SECTION_KEYS),
    z.object({ state: z.enum(HANDOFF_SECTION_STATES), notes: z.string().max(10_000), evidence: z.array(verifiedEvidence) }),
  ),
  stakeholders: z.array(z.object({ name: z.string().trim().min(1).max(200), title: z.string().nullable(), role: z.enum(STAKEHOLDER_ROLES), evidence: z.array(verifiedEvidence) })),
  outcomes: z.array(
    z.object({
      metric: z.string().trim().min(1).max(200),
      unit: z.string().nullable(),
      baseline: z.number().nullable(),
      target: z.number().nullable(),
      direction: z.enum(OUTCOME_DIRECTIONS),
      evidence: z.array(verifiedEvidence),
    }),
  ),
  commitments: z.array(
    z.object({
      title: z.string().trim().min(1).max(200),
      targetDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable(),
      evidence: z.array(verifiedEvidence),
    }),
  ),
  gaps: z.array(z.object({ title: z.string().trim().min(1).max(300), severity: z.enum(GAP_SEVERITIES), evidence: z.array(verifiedEvidence) })),
})
export type HandoffDraftApply = z.infer<typeof handoffDraftApplySchema>

export const handoffDraftGenerateSchema = z.object({
  label: z.string().trim().min(1).max(120).describe('e.g. "Discovery call, Sep 18"'),
  text: z.string().trim().min(40, 'Paste at least a few sentences').max(60_000),
})
