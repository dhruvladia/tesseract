import {
  HANDOFF_SECTION_KEYS,
  HANDOFF_SECTION_LABELS,
  HANDOFF_SECTION_PROMPTS,
  handoffDraftApplySchema,
  handoffDraftGenerateSchema,
  handoffDraftSchema,
  handoffKindSchema,
  verifyDraft,
  type HandoffKind,
} from '@tesseract/shared'
import { NoObjectGeneratedError, Output, generateText } from 'ai'
import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { db, schema } from '../db/index.ts'
import { diffHandoff, logHandoffEvents } from '../lib/events.ts'
import { badRequest, must, v } from '../lib/http.ts'
import { llm, llmEnabled, llmInfo } from '../lib/llm.ts'
import { requireOrg, type OrgEnv } from '../middleware/org.ts'

const { engagement: eng, handoff, handoffSource, handoffDraft, stakeholder, outcome, milestone } = schema
const param = v('param', z.object({ id: z.string(), kind: handoffKindSchema }))
const paramWithDraft = v('param', z.object({ id: z.string(), kind: handoffKindSchema, draftId: z.string() }))
const own = (id: string, orgId: string) => and(eq(eng.id, id), eq(eng.organizationId, orgId))
const GENERATION_TIMEOUT_MS = 60_000

// One generation at a time per handoff; a second click while one is running gets a 409.
const inFlight = new Set<string>()

const SYSTEM = `You prepare a handoff record for a forward deployed engineering team from meeting notes or a call transcript.
The record has eight sections, a stakeholder list, outcome metrics, commitments, and gaps (open questions or missing pieces).

Rules, in priority order:
1. Use only the source text. Never infer names, numbers, dates, systems or decisions that are not written there.
2. Every section you mark "confirmed" or "unclear", and every stakeholder, outcome, commitment and gap, must cite at least one verbatim quote from the source (3 to 40 words, copied exactly) with the 1-based line number where it appears. Quotes are checked mechanically; anything without an exact quote will be discarded.
3. If the source does not cover a section, set state "not_discussed", notes "", evidence [].
4. "confirmed" means the source states it plainly. "unclear" means it is mentioned but contradictory, tentative, or missing a key detail; say what is missing in the notes.
5. Notes are concise summaries for the receiving team, not transcript copies. Two or three sentences at most.
6. Gap severity: "blocking" only when it prevents kickoff or going to production; "high" when it will derail the plan if unresolved within weeks; otherwise "medium" or "low". Unresolved questions default to "medium".
7. Stakeholder roles: sponsor (decides budget/scope), technical_owner (owns systems and data access), workflow_owner (runs the process being changed), champion (advocates internally), user (does the work daily), blocker (known resistance). Only include people named in the source.
8. Outcomes need a metric name; baseline and target are numbers only when stated, otherwise null. Direction "up" if higher is better.
9. Commitments are things someone said they would do; include who and by when if stated (YYYY-MM-DD only if a full date is stated, else null).
10. Do not invent anything to fill a field. Empty arrays and "not_discussed" are correct answers.`

function buildPrompt(ctx: {
  kind: HandoffKind
  engagement: { name: string; side: string; phase: string; decision: string | null; account: { name: string; key: string; stakeholders: { name: string; role: string }[] }; outcomes: { metric: string }[] }
  existing: { sections: Record<string, { state?: string } | undefined> } | undefined
  label: string
  text: string
}) {
  const lines = ctx.text.split(/\r?\n/)
  const numbered = lines.map((l, i) => `${String(i + 1).padStart(4, ' ')}| ${l}`).join('\n')
  const sections = HANDOFF_SECTION_KEYS.map((k) => `- ${k} ("${HANDOFF_SECTION_LABELS[k]}"): ${HANDOFF_SECTION_PROMPTS[k]}`).join('\n')
  const known = ctx.engagement.account.stakeholders.map((s) => `${s.name} (${s.role})`).join(', ') || 'none recorded yet'
  const metrics = ctx.engagement.outcomes.map((o) => o.metric).join(', ') || 'none recorded yet'
  const marked = ctx.existing
    ? HANDOFF_SECTION_KEYS.filter((k) => ctx.existing!.sections[k]?.state)
        .map((k) => `${k}=${ctx.existing!.sections[k]!.state}`)
        .join(', ') || 'none'
    : 'no record yet'
  return `Handoff kind: ${ctx.kind === 'pre_to_post' ? 'pre-sales to post-sales (written for the delivery team)' : 'post-sales to customer success (written for CS and the customer’s named owners)'}
Engagement: "${ctx.engagement.name}" at ${ctx.engagement.account.name} (${ctx.engagement.account.key}), ${ctx.engagement.side}, phase ${ctx.engagement.phase}
Decision this engagement unlocks: ${ctx.engagement.decision ?? 'not recorded'}
Stakeholders already on the account: ${known}
Outcome metrics already recorded: ${metrics}
Sections already marked on the record: ${marked}

Sections:
${sections}

Source: "${ctx.label}" (line numbers on the left are for citation only)
${numbered}`
}

export const handoffDrafts = new Hono<OrgEnv>()
  .use(requireOrg)
  .post('/:id/handoffs/:kind/drafts', param, v('json', handoffDraftGenerateSchema), async (c) => {
    if (!llmEnabled || !llm) throw new HTTPException(503, { message: 'AI drafting is not configured. Set LLM_PROVIDER, LLM_MODEL and LLM_API_KEY on the API.' })
    const { id, kind } = c.req.valid('param')
    const { label, text } = c.req.valid('json')
    const e = must(
      await db.query.engagement.findFirst({
        where: own(id, c.var.orgId),
        columns: { id: true, name: true, side: true, phase: true, decision: true, accountId: true },
        with: { account: { columns: { name: true, key: true }, with: { stakeholders: { columns: { name: true, role: true } } } }, outcomes: { columns: { metric: true } }, handoffs: { columns: { kind: true, sections: true } } },
      }),
      'Engagement',
    )
    const key = `${e.id}:${kind}`
    if (inFlight.has(key)) throw new HTTPException(409, { message: 'A draft is already being generated for this handoff' })
    inFlight.add(key)
    try {
      const [source] = await db
        .insert(handoffSource)
        .values({ organizationId: c.var.orgId, engagementId: e.id, kind, label, text, createdById: c.var.userId })
        .returning()

      let proposal
      try {
        const result = await generateText({
          model: llm,
          system: SYSTEM,
          prompt: buildPrompt({ kind, engagement: e, existing: e.handoffs.find((h) => h.kind === kind), label, text }),
          output: Output.object({ schema: handoffDraftSchema }),
          abortSignal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
        })
        proposal = result.output
      } catch (err) {
        if (NoObjectGeneratedError.isInstance(err)) throw new HTTPException(502, { message: 'The model did not return a valid draft. Try again, or shorten the notes.' })
        if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) throw new HTTPException(504, { message: 'The model took too long. Try again with shorter notes.' })
        console.error('[drafts] generation failed', err)
        throw new HTTPException(502, { message: err instanceof Error ? err.message : 'Model call failed' })
      }

      const stamped = verifyDraft(proposal, text, source!.id)

      const draft = await db.transaction(async (tx) => {
        await tx
          .update(handoffDraft)
          .set({ status: 'dismissed' })
          .where(and(eq(handoffDraft.engagementId, e.id), eq(handoffDraft.kind, kind), eq(handoffDraft.status, 'pending')))
        const [row] = await tx
          .insert(handoffDraft)
          .values({ organizationId: c.var.orgId, engagementId: e.id, kind, sourceId: source!.id, proposal: stamped, model: `${llmInfo.provider}/${llmInfo.model}`, createdById: c.var.userId })
          .returning()
        const h = await tx.query.handoff.findFirst({ columns: { id: true }, where: and(eq(handoff.engagementId, e.id), eq(handoff.kind, kind)) })
        if (h) {
          await logHandoffEvents(
            [{ organizationId: c.var.orgId, handoffId: h.id, engagementId: e.id, kind, actorId: c.var.userId, event: 'draft_generated', meta: { ...stamped.stats, model: row!.model, sourceId: source!.id } }],
            tx,
          )
        }
        return row!
      })
      return c.json({ ...draft, source: { id: source!.id, label: source!.label } }, 201)
    } finally {
      inFlight.delete(key)
    }
  })
  .get('/:id/handoffs/:kind/drafts/pending', param, async (c) => {
    const { id, kind } = c.req.valid('param')
    const row = await db.query.handoffDraft.findFirst({
      where: and(eq(handoffDraft.engagementId, id), eq(handoffDraft.kind, kind), eq(handoffDraft.organizationId, c.var.orgId), eq(handoffDraft.status, 'pending')),
      with: { source: { columns: { id: true, label: true } } },
      orderBy: desc(handoffDraft.createdAt),
    })
    return c.json(row ?? null)
  })
  .post('/:id/handoffs/:kind/drafts/:draftId/dismiss', paramWithDraft, async (c) => {
    const { id, kind, draftId } = c.req.valid('param')
    const [row] = await db
      .update(handoffDraft)
      .set({ status: 'dismissed' })
      .where(and(eq(handoffDraft.id, draftId), eq(handoffDraft.engagementId, id), eq(handoffDraft.kind, kind), eq(handoffDraft.organizationId, c.var.orgId)))
      .returning({ id: handoffDraft.id })
    return c.json(must(row, 'Draft'))
  })
  // The human step. Whatever arrives here was reviewed (and possibly edited) by the caller.
  .post('/:id/handoffs/:kind/drafts/:draftId/apply', paramWithDraft, v('json', handoffDraftApplySchema), async (c) => {
    const { id, kind, draftId } = c.req.valid('param')
    const body = c.req.valid('json')
    const e = must(await db.query.engagement.findFirst({ where: own(id, c.var.orgId), columns: { id: true, accountId: true } }), 'Engagement')
    const draft = must(
      await db.query.handoffDraft.findFirst({
        where: and(eq(handoffDraft.id, draftId), eq(handoffDraft.engagementId, e.id), eq(handoffDraft.kind, kind), eq(handoffDraft.organizationId, c.var.orgId)),
      }),
      'Draft',
    )
    if (draft.status !== 'pending') throw badRequest('This draft was already applied or dismissed')

    const result = await db.transaction(async (tx) => {
      const before = await tx.query.handoff.findFirst({ where: and(eq(handoff.engagementId, e.id), eq(handoff.kind, kind)) })
      if (before?.acceptedAt) throw badRequest('Reopen the handoff before applying a draft to it')

      // sections: append to existing notes rather than overwrite; carry evidence
      const sections = { ...(before?.sections ?? {}) }
      let applied = 0
      for (const [k, s] of Object.entries(body.sections)) {
        if (!s) continue
        const prev = sections[k]
        const prevNotes = prev?.notes?.trim() ?? ''
        const notes = prevNotes && s.notes.trim() && prevNotes !== s.notes.trim() ? `${prevNotes}\n\n${s.notes.trim()}` : s.notes.trim() || prevNotes
        sections[k] = { state: s.state, notes, evidence: [...(prev?.evidence ?? []), ...s.evidence] }
        applied++
      }
      const gaps = [
        ...(before?.gaps ?? []),
        ...body.gaps.map((g) => ({ id: crypto.randomUUID(), title: g.title, severity: g.severity, ownerId: null, resolvedAt: null, evidence: g.evidence })),
      ]
      applied += body.gaps.length

      const [row] = await tx
        .insert(handoff)
        .values({ engagementId: e.id, organizationId: c.var.orgId, kind, sections, gaps, createdById: c.var.userId })
        .onConflictDoUpdate({ target: [handoff.engagementId, handoff.kind], set: { sections, gaps } })
        .returning()

      // stakeholders: skip case-insensitive duplicates on the account
      if (body.stakeholders.length) {
        const existing = await tx.query.stakeholder.findMany({ columns: { name: true }, where: eq(stakeholder.accountId, e.accountId) })
        const names = new Set(existing.map((s) => s.name.trim().toLowerCase()))
        const fresh = body.stakeholders.filter((s) => !names.has(s.name.trim().toLowerCase()))
        if (fresh.length) {
          await tx.insert(stakeholder).values(fresh.map((s) => ({ organizationId: c.var.orgId, accountId: e.accountId, name: s.name.trim(), title: s.title, role: s.role, notes: provenanceNote(s.evidence) })))
        }
        applied += fresh.length
      }
      if (body.outcomes.length) {
        await tx.insert(outcome).values(
          body.outcomes.map((o) => ({
            organizationId: c.var.orgId,
            engagementId: e.id,
            metric: o.metric,
            unit: o.unit,
            baseline: o.baseline == null ? null : String(o.baseline),
            target: o.target == null ? null : String(o.target),
            direction: o.direction,
          })),
        )
        applied += body.outcomes.length
      }
      if (body.commitments.length) {
        await tx.insert(milestone).values(body.commitments.map((m) => ({ organizationId: c.var.orgId, engagementId: e.id, kind: 'custom' as const, title: m.title, targetDate: m.targetDate })))
        applied += body.commitments.length
      }

      await logHandoffEvents(
        [
          ...diffHandoff(before, row!, c.var.userId),
          {
            organizationId: c.var.orgId,
            handoffId: row!.id,
            engagementId: e.id,
            kind,
            actorId: c.var.userId,
            event: 'draft_applied',
            meta: { proposed: draft.proposal.stats.proposed, verified: draft.proposal.stats.verified, applied, draftId: draft.id, model: draft.model },
          },
        ],
        tx,
      )
      await tx.update(handoffDraft).set({ status: 'applied', appliedById: c.var.userId, appliedAt: new Date() }).where(eq(handoffDraft.id, draft.id))
      return { handoff: row!, applied }
    })
    return c.json(result)
  })
  .get('/:id/handoffs/sources/:sourceId/snippet', v('query', z.object({ line: z.coerce.number().int().min(1), context: z.coerce.number().int().min(0).max(10).default(2) })), async (c) => {
    const { line, context } = c.req.valid('query')
    const src = must(
      await db.query.handoffSource.findFirst({
        where: and(eq(handoffSource.id, c.req.param('sourceId')), eq(handoffSource.engagementId, c.req.param('id')), eq(handoffSource.organizationId, c.var.orgId)),
        columns: { id: true, label: true, text: true, createdAt: true },
      }),
      'Source',
    )
    const lines = src.text.split(/\r?\n/)
    const from = Math.max(1, line - context)
    const to = Math.min(lines.length, line + context)
    return c.json({ id: src.id, label: src.label, createdAt: src.createdAt, total: lines.length, lines: lines.slice(from - 1, to).map((text, i) => ({ n: from + i, text })) })
  })

function provenanceNote(evidence: { quote: string }[]) {
  const q = evidence[0]?.quote
  return q ? `From notes: “${q}”` : null
}
