import {
  accountCreateSchema,
  accountUpdateSchema,
  commentCreateSchema,
  engagementCreateSchema,
  engagementGapLinkSchema,
  engagementUpdateSchema,
  ENGAGEMENT_OUTCOMES,
  GAP_IMPACTS,
  GAP_SEVERITIES,
  HANDOFF_SECTION_KEYS,
  HANDOFF_SECTION_STATES,
  handoffDraftGenerateSchema,
  handoffKindSchema,
  issueCreateSchema,
  issueListQuerySchema,
  issueUpdateSchema,
  labelCreateSchema,
  memberRoleSchema,
  milestoneCreateSchema,
  milestoneUpdateSchema,
  outcomeCreateSchema,
  outcomeUpdateSchema,
  PHASES,
  productGapCreateSchema,
  productGapUpdateSchema,
  SIDES,
  stakeholderCreateSchema,
  stakeholderUpdateSchema,
  threadCreateSchema,
  threadUpdateSchema,
  type VerifiedDraft,
} from '@tesseract/shared'
import { tool } from 'ai'
import { z } from 'zod'
import { unwrap, type InternalClient } from './client.ts'

const id = z.string().min(1).describe('Exact id returned by a search or list tool (for engagementId, the exact engagement name also works)')

type Evidence = { quote: string; line: number; verified: boolean; sourceId?: string }
type HandoffRecord = { sections: Record<string, { state: 'confirmed' | 'unclear' | 'not_discussed'; notes: string; evidence?: Evidence[] } | undefined>; gaps: { id: string; title: string; severity: 'blocking' | 'high' | 'medium' | 'low'; ownerId: string | null; resolvedAt: string | null; evidence?: Evidence[] }[] }
/** Resolve "Grace", "Grace Hopper", an email, or a userId to a member userId. Small models guess ids; names are safer. */
async function resolveMember(a: InternalClient['api'], ref: string | null | undefined): Promise<{ userId: string | null } | { error: string }> {
  if (ref == null || ref === '' || /^(nobody|none|null|unassigned)$/i.test(ref)) return { userId: null }
  const me = await unwrap(a.me.$get())
  if ('error' in me) return me
  const q = ref.trim().toLowerCase()
  const exact = me.members.find((m) => m.userId === ref || m.email.toLowerCase() === q || m.name.toLowerCase() === q)
  if (exact) return { userId: exact.userId }
  const partial = me.members.filter((m) => m.name.toLowerCase().split(/\s+/).some((w) => w === q) || m.name.toLowerCase().includes(q))
  if (partial.length === 1) return { userId: partial[0]!.userId }
  if (partial.length > 1) return { error: `"${ref}" matches several people: ${partial.map((m) => m.name).join(', ')}. Use the full name.` }
  return { error: `No team member matches "${ref}". Members: ${me.members.map((m) => m.name).join(', ')}.` }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Small models sometimes pass a name where an id belongs. Resolve a non-uuid to the unique engagement it names. */
async function resolveEngagementId(a: InternalClient['api'], ref: string): Promise<{ id: string } | { error: string }> {
  if (UUID.test(ref)) return { id: ref }
  const r = await unwrap(a.search.$get({ query: { q: ref.trim().slice(0, 100) } }))
  if ('error' in r) return r
  const q = ref.trim().toLowerCase()
  const exact = r.engagements.filter((e) => e.name.toLowerCase() === q)
  const hits = exact.length ? exact : r.engagements
  if (hits.length === 1) return { id: hits[0]!.id }
  if (hits.length > 1) return { error: `"${ref}" matches several engagements: ${hits.map((e) => `${e.name} (${e.accountKey}, ${e.phase})`).join('; ')}. Use the id from search.` }
  return { error: `No engagement named "${ref}". Use search to find it.` }
}

/** Wrap every tool that takes engagementId so names are accepted; ids pass through untouched. */
function acceptEngagementNames<T extends Record<string, unknown>>(tools: T, a: InternalClient['api']): T {
  for (const t of Object.values(tools) as { inputSchema?: { shape?: Record<string, unknown> }; execute?: (input: Record<string, unknown>, opts: unknown) => unknown }[]) {
    if (!t.inputSchema?.shape || !('engagementId' in t.inputSchema.shape) || !t.execute) continue
    const exec = t.execute
    t.execute = async (input, opts) => {
      const ref = input?.engagementId
      if (typeof ref === 'string' && ref) {
        const r = await resolveEngagementId(a, ref)
        if ('error' in r) return r
        input = { ...input, engagementId: r.id }
      }
      return exec(input, opts)
    }
  }
  return tools
}

async function loadHandoff(a: InternalClient['api'], engagementId: string, kind: 'pre_to_post' | 'post_to_cs'): Promise<HandoffRecord | { error: string }> {
  const e = await unwrap(a.engagements[':id'].$get({ param: { id: engagementId } }))
  if ('error' in e) return e
  const h = e.handoffs.find((x) => x.kind === kind)
  if (h?.acceptedAt) return { error: 'This handoff is accepted. Reopen it first (reopen_handoff) before editing.' }
  return { sections: (h?.sections ?? {}) as HandoffRecord['sections'], gaps: (h?.gaps ?? []) as HandoffRecord['gaps'] }
}

// Tool names that change data. Everything else is a read and runs without confirmation.
export const WRITE_TOOLS = new Set([
  'create_account',
  'update_account',
  'delete_account',
  'add_stakeholder',
  'update_stakeholder',
  'remove_stakeholder',
  'create_engagement',
  'update_engagement',
  'delete_engagement',
  'change_phase',
  'create_thread',
  'update_thread',
  'delete_thread',
  'create_issue',
  'update_issue',
  'delete_issue',
  'add_comment',
  'create_label',
  'delete_label',
  'mark_unmarked_sections',
  'update_handoff_sections',
  'add_handoff_gap',
  'update_handoff_gap',
  'assign_unowned_gaps',
  'accept_handoff',
  'reopen_handoff',
  'add_outcome',
  'update_outcome',
  'delete_outcome',
  'add_milestone',
  'update_milestone',
  'delete_milestone',
  'create_gap',
  'update_gap',
  'delete_gap',
  'link_gap',
  'unlink_gap',
  'set_member_role',
  'generate_handoff_draft',
  'apply_handoff_draft',
  'dismiss_handoff_draft',
])

// Keep tool results small: the model only needs names, keys, ids and states.
const compactEngagement = (e: Record<string, unknown>) => ({
  id: e.id,
  name: e.name,
  account: (e.account as { key?: string; name?: string } | undefined) ? { key: (e.account as { key: string }).key, name: (e.account as { name: string }).name } : undefined,
  side: e.side,
  phase: e.phase,
  decision: e.decision,
  fdeId: e.fdeId,
  engagementManagerId: e.engagementManagerId,
  aeId: e.aeId,
  csmId: e.csmId,
  outcome: e.outcome,
  phaseEnteredAt: e.phaseEnteredAt,
})

export function buildTools(api: InternalClient) {
  const a = api.api
  return acceptEngagementNames({
    // ---------------- reads ----------------
    search: tool({
      description:
        'Find accounts, engagements, issues and product gaps by name, key or identifier. Always use this before acting on something the user named. Use a short distinctive phrase (2-4 words, e.g. "Fraud signals" or "NWB-4"), never a whole sentence.',
      inputSchema: z.object({ q: z.string().min(1).max(100) }),
      execute: async ({ q }) => {
        // small models sometimes pass long phrases; back off word by word until something matches
        const words = q.trim().split(/\s+/)
        for (let n = Math.min(words.length, 6); n >= 1; n--) {
          const r = await unwrap(a.search.$get({ query: { q: words.slice(0, n).join(' ') } }))
          if ('error' in r) return r
          if (r.accounts.length + r.engagements.length + r.issues.length + r.gaps.length > 0 || n === 1) return n < words.length ? { ...r, note: `matched on "${words.slice(0, n).join(' ')}"` } : r
        }
        return { accounts: [], engagements: [], issues: [], gaps: [] }
      },
    }),
    list_members: tool({
      description: 'Team members (people who can be assigned), with userId, name, email and role.',
      inputSchema: z.object({}),
      execute: async () => {
        const r = await unwrap(a.me.$get())
        return 'error' in r ? r : { me: { userId: r.userId, role: r.role }, members: r.members }
      },
    }),
    list_accounts: tool({
      description: 'All customer accounts with key, name, ARR and engagement counts.',
      inputSchema: z.object({}),
      execute: () => unwrap(a.accounts.$get()),
    }),
    get_account: tool({
      description: 'One account with its stakeholders and engagements.',
      inputSchema: z.object({ accountId: id }),
      execute: ({ accountId }) => unwrap(a.accounts[':id'].$get({ param: { id: accountId } })),
    }),
    list_engagements: tool({
      description:
        'All open engagements across every account, with account key, phase, and team. Call with {} to see everything. Only pass side if the user asked for pre-sales or post-sales specifically; only pass includeClosed if they asked about closed or lost ones. For one account, use get_account instead.',
      inputSchema: z.object({ side: z.enum(SIDES).optional(), includeClosed: z.boolean().optional() }),
      execute: async ({ side, includeClosed }) => {
        const r = await unwrap(a.engagements.$get({ query: { side, includeClosed: includeClosed ? '1' : '0' } }))
        return 'error' in r ? r : r.map((e) => compactEngagement(e as unknown as Record<string, unknown>))
      },
    }),
    get_engagement: tool({
      description: 'Full engagement: account and stakeholders, team, outcomes, milestones, handoffs (sections, gaps, acceptance), threads, linked product gaps.',
      inputSchema: z.object({ engagementId: id }),
      execute: ({ engagementId }) => unwrap(a.engagements[':id'].$get({ param: { id: engagementId } })),
    }),
    list_threads: tool({
      description: 'All threads (workstreams) with their engagement and issue counts. Internal threads have engagementId null.',
      inputSchema: z.object({}),
      execute: () => unwrap(a.threads.$get()),
    }),
    list_issues: tool({
      description: 'Issues filtered by thread, engagement, account, assignee ("me" allowed), status, or text.',
      inputSchema: issueListQuerySchema,
      execute: async (q) => {
        const r = await unwrap(a.issues.$get({ query: q }))
        return 'error' in r
          ? r
          : r.map((i) => ({ id: i.id, identifier: i.identifier, title: i.title, status: i.status, priority: i.priority, assigneeId: i.assigneeId, dueDate: i.dueDate, thread: i.thread?.name, engagementId: i.engagementId }))
      },
    }),
    get_issue: tool({
      description: 'One issue with description, sub-issues, comments and activity.',
      inputSchema: z.object({ issueId: id }),
      execute: ({ issueId }) => unwrap(a.issues[':id'].$get({ param: { id: issueId } })),
    }),
    list_labels: tool({ description: 'Issue labels.', inputSchema: z.object({}), execute: () => unwrap(a.labels.$get()) }),
    list_gaps: tool({
      description: 'Product gaps (field signals) with status, engagement count and ARR influenced.',
      inputSchema: z.object({}),
      execute: () => unwrap(a.gaps.$get()),
    }),
    get_gap: tool({
      description: 'One product gap with linked engagements and cluster children.',
      inputSchema: z.object({ gapId: id }),
      execute: ({ gapId }) => unwrap(a.gaps[':id'].$get({ param: { id: gapId } })),
    }),
    get_attention: tool({
      description: 'What needs a person now: handoffs ready or blocked, unowned gaps, missing owners or stakeholders, stale engagements, overdue work. Each item has an ownerId.',
      inputSchema: z.object({}),
      execute: () => unwrap(a.attention.$get()),
    }),
    get_handoff_metrics: tool({
      description: 'Handoff gate metrics: time to accept, technical win to kickoff, time to first value, reopens, late gaps, thin confirmations; per engagement and aggregate.',
      inputSchema: z.object({}),
      execute: () => unwrap(a.metrics.handoffs.$get()),
    }),
    get_pending_draft: tool({
      description: 'The pending AI handoff draft for an engagement and handoff kind, if any.',
      inputSchema: z.object({ engagementId: id, kind: handoffKindSchema }),
      execute: ({ engagementId, kind }) => unwrap(a.engagements[':id'].handoffs[':kind'].drafts.pending.$get({ param: { id: engagementId, kind } })),
    }),

    // ---------------- accounts and stakeholders ----------------
    create_account: tool({
      description: 'Create a customer account. key is 2-6 uppercase letters/digits used in issue ids (e.g. ACME).',
      inputSchema: accountCreateSchema,
      execute: (json) => unwrap(a.accounts.$post({ json })),
    }),
    update_account: tool({
      description: 'Update account fields (name, key, domain, arr, notes).',
      inputSchema: z.object({ accountId: id, patch: accountUpdateSchema }),
      execute: ({ accountId, patch }) => unwrap(a.accounts[':id'].$patch({ param: { id: accountId }, json: patch })),
    }),
    delete_account: tool({
      description: 'Delete an account and everything under it (engagements, threads, issues, stakeholders). Irreversible.',
      inputSchema: z.object({ accountId: id }),
      execute: ({ accountId }) => unwrap(a.accounts[':id'].$delete({ param: { id: accountId } })),
    }),
    add_stakeholder: tool({
      description: 'Add a customer-side stakeholder to an account (sponsor, technical_owner, workflow_owner, champion, user, blocker).',
      inputSchema: z.object({ accountId: id, stakeholder: stakeholderCreateSchema }),
      execute: ({ accountId, stakeholder }) => unwrap(a.accounts[':id'].stakeholders.$post({ param: { id: accountId }, json: stakeholder })),
    }),
    update_stakeholder: tool({
      description: 'Update a stakeholder.',
      inputSchema: z.object({ accountId: id, stakeholderId: id, patch: stakeholderUpdateSchema }),
      execute: ({ accountId, stakeholderId, patch }) => unwrap(a.accounts[':id'].stakeholders[':sid'].$patch({ param: { id: accountId, sid: stakeholderId }, json: patch })),
    }),
    remove_stakeholder: tool({
      description: 'Remove a stakeholder from an account.',
      inputSchema: z.object({ accountId: id, stakeholderId: id }),
      execute: ({ accountId, stakeholderId }) => unwrap(a.accounts[':id'].stakeholders[':sid'].$delete({ param: { id: accountId, sid: stakeholderId } })),
    }),

    // ---------------- engagements ----------------
    create_engagement: tool({
      description: 'Create an engagement on an account. side presales starts at qualify, postsales at kickoff unless phase is given.',
      inputSchema: engagementCreateSchema,
      execute: (json) => unwrap(a.engagements.$post({ json })),
    }),
    update_engagement: tool({
      description: 'Update name, decision, description, outcome, or team: fde, engagementManager, ae, csm as member names or userIds (null to unassign).',
      inputSchema: z.object({
        engagementId: id,
        patch: engagementUpdateSchema
          .omit({ fdeId: true, engagementManagerId: true, aeId: true, csmId: true })
          .extend({ fde: z.string().nullable().optional(), engagementManager: z.string().nullable().optional(), ae: z.string().nullable().optional(), csm: z.string().nullable().optional() }),
      }),
      execute: async ({ engagementId, patch: { fde, engagementManager, ae, csm, ...rest } }) => {
        const json: Record<string, unknown> = { ...rest }
        for (const [key, ref] of [['fdeId', fde], ['engagementManagerId', engagementManager], ['aeId', ae], ['csmId', csm]] as const) {
          if (ref === undefined) continue
          const who = await resolveMember(a, ref)
          if ('error' in who) return who
          json[key] = who.userId
        }
        return unwrap(a.engagements[':id'].$patch({ param: { id: engagementId }, json }))
      },
    }),
    delete_engagement: tool({
      description: 'Delete an engagement and its threads, issues, handoffs. Irreversible.',
      inputSchema: z.object({ engagementId: id }),
      execute: ({ engagementId }) => unwrap(a.engagements[':id'].$delete({ param: { id: engagementId } })),
    }),
    change_phase: tool({
      description:
        'Move an engagement to a phase. Pre-sales: qualify, discover, scope, prototype, technical_win. Post-sales: kickoff, build, validate, live, adopt, handed_off. technical_win -> kickoff converts to post-sales and requires an accepted pre_to_post handoff with no blocking gaps; handed_off -> closed requires an accepted post_to_cs handoff. closed needs an outcome (lost, deferred, handed_off). The platform enforces these and returns the reason if refused.',
      inputSchema: z.object({ engagementId: id, phase: z.enum(PHASES), outcome: z.enum(ENGAGEMENT_OUTCOMES).nullable().optional() }),
      execute: ({ engagementId, phase, outcome }) => unwrap(a.engagements[':id'].phase.$post({ param: { id: engagementId }, json: { phase, outcome } })),
    }),

    // ---------------- threads, issues, comments, labels ----------------
    create_thread: tool({
      description: 'Create a thread (workstream) on an engagement, or an internal thread with engagementId null. Refuses a duplicate name on the same engagement and returns the existing thread instead.',
      inputSchema: threadCreateSchema,
      execute: async (json) => {
        const existing = await unwrap(a.threads.$get())
        if ('error' in existing) return existing
        const dup = existing.find((t) => t.engagementId === (json.engagementId ?? null) && t.name.trim().toLowerCase() === json.name.trim().toLowerCase())
        if (dup) return { error: `A thread named "${dup.name}" already exists here (id ${dup.id}). Use it, or pick a different name.`, existing: { id: dup.id, name: dup.name } }
        return unwrap(a.threads.$post({ json }))
      },
    }),
    update_thread: tool({
      description: 'Rename or describe a thread.',
      inputSchema: z.object({ threadId: id, patch: threadUpdateSchema }),
      execute: ({ threadId, patch }) => unwrap(a.threads[':id'].$patch({ param: { id: threadId }, json: patch })),
    }),
    delete_thread: tool({
      description: 'Delete a thread and all its issues. Irreversible.',
      inputSchema: z.object({ threadId: id }),
      execute: ({ threadId }) => unwrap(a.threads[':id'].$delete({ param: { id: threadId } })),
    }),
    create_issue: tool({
      description: 'Create an issue in a thread. description is plain text (converted to a document). Returns the identifier like NWB-12.',
      inputSchema: issueCreateSchema.omit({ description: true, assigneeId: true }).extend({ description: z.string().nullable().optional(), assignee: z.string().nullable().optional().describe('Member name, email or userId') }),
      execute: async ({ description, assignee, ...rest }) => {
        const who = await resolveMember(a, assignee)
        if ('error' in who) return who
        return unwrap(
          a.issues.$post({
            json: { ...rest, assigneeId: who.userId, description: description ? { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: description }] }] } : null },
          }),
        )
      },
    }),
    update_issue: tool({
      description: 'Update title, status (backlog, todo, in_progress, done, canceled), priority (none, urgent, high, medium, low), assignee (member name or userId, null to unassign), dueDate (YYYY-MM-DD), parentId, labelIds.',
      inputSchema: z.object({ issueId: id, patch: issueUpdateSchema.omit({ description: true, assigneeId: true }).extend({ assignee: z.string().nullable().optional() }) }),
      execute: async ({ issueId, patch: { assignee, ...patch } }) => {
        let assigneeId: string | null | undefined
        if (assignee !== undefined) {
          const who = await resolveMember(a, assignee)
          if ('error' in who) return who
          assigneeId = who.userId
        }
        return unwrap(a.issues[':id'].$patch({ param: { id: issueId }, json: { ...patch, ...(assignee !== undefined ? { assigneeId } : {}) } }))
      },
    }),
    delete_issue: tool({
      description: 'Delete an issue. Irreversible.',
      inputSchema: z.object({ issueId: id }),
      execute: ({ issueId }) => unwrap(a.issues[':id'].$delete({ param: { id: issueId } })),
    }),
    add_comment: tool({
      description: 'Comment on an issue.',
      inputSchema: z.object({ issueId: id, comment: commentCreateSchema }),
      execute: ({ issueId, comment }) => unwrap(a.issues[':id'].comments.$post({ param: { id: issueId }, json: comment })),
    }),
    create_label: tool({ description: 'Create an issue label (name, hex color).', inputSchema: labelCreateSchema, execute: (json) => unwrap(a.labels.$post({ json })) }),
    delete_label: tool({ description: 'Delete a label.', inputSchema: z.object({ labelId: id }), execute: ({ labelId }) => unwrap(a.labels[':id'].$delete({ param: { id: labelId } })) }),

    // ---------------- handoffs, outcomes, milestones ----------------
    // Handoff edits are merges by construction: the tool reads the record, applies the change, and
    // writes everything back. The model cannot drop sections or gaps by forgetting to resend them.
    mark_unmarked_sections: tool({
      description:
        'Set a state on every handoff section that has no state yet (usually not_discussed). Sections that already have a state or notes are left untouched. Use this for "mark everything still unmarked as X". Creates the record if it does not exist yet. Returns which sections changed.',
      inputSchema: z.object({ engagementId: id, kind: handoffKindSchema, state: z.enum(HANDOFF_SECTION_STATES).default('not_discussed') }),
      execute: async ({ engagementId, kind, state }) => {
        const cur = await loadHandoff(a, engagementId, kind)
        if ('error' in cur) return cur
        const changed = HANDOFF_SECTION_KEYS.filter((k) => !cur.sections[k]?.state)
        if (!changed.length) return { changed: [], note: 'Every section already has a state.' }
        const merged = { ...cur.sections }
        for (const k of changed) merged[k] = { state, notes: '' }
        const r = await unwrap(a.engagements[':id'].handoffs[':kind'].$put({ param: { id: engagementId, kind }, json: { sections: merged, gaps: cur.gaps } }))
        return 'error' in r ? r : { changed, kept: HANDOFF_SECTION_KEYS.filter((k) => !changed.includes(k)) }
      },
    }),
    update_handoff_sections: tool({
      description:
        'Mark or annotate specific handoff sections (pre_to_post or post_to_cs). Only the sections you pass change. Keys: customer_overview, goals_success_criteria, use_cases_scope, configuration_requirements, integrations_constraints, stakeholders_roles, timeline_milestones, risks_open_questions. state: confirmed | unclear | not_discussed. notes: omit to keep existing notes. A section that already has notes is never set to not_discussed unless clearNotes is true; use mark_unmarked_sections for bulk marking.',
      inputSchema: z.object({
        engagementId: id,
        kind: handoffKindSchema,
        sections: z.partialRecord(z.enum(HANDOFF_SECTION_KEYS), z.object({ state: z.enum(HANDOFF_SECTION_STATES), notes: z.string().max(10_000).nullable().optional() })),
        clearNotes: z.boolean().default(false).describe('Allow replacing sections that already have notes with not_discussed'),
      }),
      execute: async ({ engagementId, kind, sections, clearNotes }) => {
        const cur = await loadHandoff(a, engagementId, kind)
        if ('error' in cur) return cur
        const merged = { ...cur.sections }
        const kept: string[] = []
        const changed: string[] = []
        for (const [k, v] of Object.entries(sections)) {
          if (!v) continue
          const prev = merged[k]
          const hasContent = !!prev && prev.state !== 'not_discussed' && (prev.notes ?? '').trim().length > 0
          if (v.state === 'not_discussed' && hasContent && !clearNotes) {
            kept.push(k)
            continue
          }
          merged[k] = { ...prev, state: v.state, notes: v.notes ?? (v.state === 'not_discussed' ? '' : (prev?.notes ?? '')) }
          changed.push(k)
        }
        if (!changed.length) return { changed: [], kept, note: 'Nothing changed: those sections already have content. Pass clearNotes: true only if the user explicitly wants that content removed.' }
        const r = await unwrap(a.engagements[':id'].handoffs[':kind'].$put({ param: { id: engagementId, kind }, json: { sections: merged, gaps: cur.gaps } }))
        return 'error' in r ? r : { changed, kept: kept.length ? kept : undefined, note: kept.length ? `Kept ${kept.length} section(s) that already had content.` : undefined }
      },
    }),
    add_handoff_gap: tool({
      description: 'Add a gap (open question or missing piece) to a handoff record. severity: blocking | high | medium | low. ownerId is a member userId or null.',
      inputSchema: z.object({ engagementId: id, kind: handoffKindSchema, title: z.string().trim().min(1).max(300), severity: z.enum(GAP_SEVERITIES), owner: z.string().nullable().default(null).describe('Member name, email or userId; null for unowned') }),
      execute: async ({ engagementId, kind, title, severity, owner }) => {
        const cur = await loadHandoff(a, engagementId, kind)
        if ('error' in cur) return cur
        const who = await resolveMember(a, owner)
        if ('error' in who) return who
        const gap = { id: crypto.randomUUID(), title, severity, ownerId: who.userId, resolvedAt: null }
        const r = await unwrap(a.engagements[':id'].handoffs[':kind'].$put({ param: { id: engagementId, kind }, json: { sections: cur.sections, gaps: [...cur.gaps, gap] } }))
        return 'error' in r ? r : { added: gap, gaps: r.gaps.length }
      },
    }),
    update_handoff_gap: tool({
      description:
        'Change one handoff gap: title, severity, owner (member name or userId; null to unassign), or resolve/reopen it (resolved: true sets resolvedAt now; false clears it). Identify the gap by gapId from get_engagement, or by gapTitle (exact or unique partial match). Only fields you pass change.',
      inputSchema: z.object({
        engagementId: id,
        kind: handoffKindSchema,
        gapId: z.string().optional(),
        gapTitle: z.string().optional(),
        title: z.string().trim().min(1).max(300).optional(),
        severity: z.enum(GAP_SEVERITIES).optional(),
        owner: z.string().nullable().optional(),
        resolved: z.boolean().optional(),
      }),
      execute: async ({ engagementId, kind, gapId, gapTitle, ...patch }) => {
        const cur = await loadHandoff(a, engagementId, kind)
        if ('error' in cur) return cur
        let idx = gapId ? cur.gaps.findIndex((g) => g.id === gapId) : -1
        if (idx < 0 && gapTitle) {
          const q = gapTitle.trim().toLowerCase()
          const hits = cur.gaps.map((g, i) => [g, i] as const).filter(([g]) => g.title.toLowerCase() === q || g.title.toLowerCase().includes(q))
          if (hits.length === 1) idx = hits[0]![1]
          else if (hits.length > 1) return { error: `"${gapTitle}" matches ${hits.length} gaps: ${hits.map(([g]) => `"${g.title}"`).join(', ')}. Be more specific.` }
        }
        if (idx < 0) return { error: `No such gap on this handoff. Current gaps: ${cur.gaps.map((g) => `"${g.title}" (${g.id})`).join('; ') || 'none'}.` }
        const g = cur.gaps[idx]!
        let ownerId = g.ownerId
        if (patch.owner !== undefined) {
          const who = await resolveMember(a, patch.owner)
          if ('error' in who) return who
          ownerId = who.userId
        }
        const next = {
          ...g,
          ownerId,
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.severity !== undefined ? { severity: patch.severity } : {}),
          ...(patch.resolved !== undefined ? { resolvedAt: patch.resolved ? new Date().toISOString() : null } : {}),
        }
        const gaps = cur.gaps.map((x, i) => (i === idx ? next : x))
        const r = await unwrap(a.engagements[':id'].handoffs[':kind'].$put({ param: { id: engagementId, kind }, json: { sections: cur.sections, gaps } }))
        return 'error' in r ? r : { gap: next }
      },
    }),
    assign_unowned_gaps: tool({
      description: 'Give every open gap that has no owner on a handoff to one person (member name or userId). One call, one confirmation. Returns how many gaps changed.',
      inputSchema: z.object({ engagementId: id, kind: handoffKindSchema, owner: z.string().min(1) }),
      execute: async ({ engagementId, kind, owner }) => {
        const cur = await loadHandoff(a, engagementId, kind)
        if ('error' in cur) return cur
        const who = await resolveMember(a, owner)
        if ('error' in who) return who
        if (!who.userId) return { error: 'Name a person to assign the gaps to.' }
        const targets = cur.gaps.filter((g) => !g.resolvedAt && !g.ownerId)
        if (!targets.length) return { changed: 0, note: 'Every open gap already has an owner.' }
        const gaps = cur.gaps.map((g) => (targets.includes(g) ? { ...g, ownerId: who.userId } : g))
        const r = await unwrap(a.engagements[':id'].handoffs[':kind'].$put({ param: { id: engagementId, kind }, json: { sections: cur.sections, gaps } }))
        return 'error' in r ? r : { changed: targets.length, gaps: targets.map((g) => g.title) }
      },
    }),
    accept_handoff: tool({
      description: 'Accept a handoff (the receiving side signs off). Requires all 8 sections marked, no unresolved blocking gap, every open gap owned and titled. Returns the reason if refused.',
      inputSchema: z.object({ engagementId: id, kind: handoffKindSchema }),
      execute: ({ engagementId, kind }) => unwrap(a.engagements[':id'].handoffs[':kind'].accept.$post({ param: { id: engagementId, kind } })),
    }),
    reopen_handoff: tool({
      description: 'Reopen an accepted handoff so it can be edited again.',
      inputSchema: z.object({ engagementId: id, kind: handoffKindSchema }),
      execute: ({ engagementId, kind }) => unwrap(a.engagements[':id'].handoffs[':kind'].reopen.$post({ param: { id: engagementId, kind } })),
    }),
    add_outcome: tool({
      description: 'Add an outcome metric to an engagement (metric, unit, baseline, target, current, direction up|down).',
      inputSchema: z.object({ engagementId: id, outcome: outcomeCreateSchema }),
      execute: ({ engagementId, outcome }) => unwrap(a.engagements[':id'].outcomes.$post({ param: { id: engagementId }, json: outcome })),
    }),
    update_outcome: tool({
      description: 'Update an outcome metric; set firstValueVerifiedAt (ISO datetime) to mark first verified value.',
      inputSchema: z.object({ engagementId: id, outcomeId: id, patch: outcomeUpdateSchema }),
      execute: ({ engagementId, outcomeId, patch }) => unwrap(a.engagements[':id'].outcomes[':oid'].$patch({ param: { id: engagementId, oid: outcomeId }, json: patch })),
    }),
    delete_outcome: tool({
      description: 'Delete an outcome metric.',
      inputSchema: z.object({ engagementId: id, outcomeId: id }),
      execute: ({ engagementId, outcomeId }) => unwrap(a.engagements[':id'].outcomes[':oid'].$delete({ param: { id: engagementId, oid: outcomeId } })),
    }),
    add_milestone: tool({
      description: 'Add a milestone (kind kickoff|first_value|production|handoff|custom, title, targetDate YYYY-MM-DD).',
      inputSchema: z.object({ engagementId: id, milestone: milestoneCreateSchema }),
      execute: ({ engagementId, milestone }) => unwrap(a.engagements[':id'].milestones.$post({ param: { id: engagementId }, json: milestone })),
    }),
    update_milestone: tool({
      description: 'Update a milestone; set completedAt (ISO datetime) to complete it or null to reopen.',
      inputSchema: z.object({ engagementId: id, milestoneId: id, patch: milestoneUpdateSchema }),
      execute: ({ engagementId, milestoneId, patch }) => unwrap(a.engagements[':id'].milestones[':mid'].$patch({ param: { id: engagementId, mid: milestoneId }, json: patch })),
    }),
    delete_milestone: tool({
      description: 'Delete a milestone.',
      inputSchema: z.object({ engagementId: id, milestoneId: id }),
      execute: ({ engagementId, milestoneId }) => unwrap(a.engagements[':id'].milestones[':mid'].$delete({ param: { id: engagementId, mid: milestoneId } })),
    }),

    // ---------------- product gaps ----------------
    create_gap: tool({
      description: 'Raise a product gap, optionally linked to an engagement with impact (blocker|major|minor) and arrInfluenced.',
      inputSchema: productGapCreateSchema,
      execute: (json) => unwrap(a.gaps.$post({ json })),
    }),
    update_gap: tool({
      description: 'Update a gap: title, description, status (raised|triaged|accepted|shipped|declined), parentId (cluster under another gap), linkedIssueUrl.',
      inputSchema: z.object({ gapId: id, patch: productGapUpdateSchema }),
      execute: ({ gapId, patch }) => unwrap(a.gaps[':id'].$patch({ param: { id: gapId }, json: patch })),
    }),
    delete_gap: tool({ description: 'Delete a product gap.', inputSchema: z.object({ gapId: id }), execute: ({ gapId }) => unwrap(a.gaps[':id'].$delete({ param: { id: gapId } })) }),
    link_gap: tool({
      description: 'Link a gap to an engagement with impact and ARR influenced.',
      inputSchema: z.object({ gapId: id, link: engagementGapLinkSchema.extend({ impact: z.enum(GAP_IMPACTS).default('major') }) }),
      execute: ({ gapId, link }) => unwrap(a.gaps[':id'].engagements.$post({ param: { id: gapId }, json: link })),
    }),
    unlink_gap: tool({
      description: 'Unlink a gap from an engagement.',
      inputSchema: z.object({ gapId: id, engagementId: id }),
      execute: ({ gapId, engagementId }) => unwrap(a.gaps[':id'].engagements[':eid'].$delete({ param: { id: gapId, eid: engagementId } })),
    }),

    // ---------------- members ----------------
    set_member_role: tool({
      description: 'Change a member role (admin, fde, engagement_manager, account_exec, csm, product). Admins only.',
      inputSchema: z.object({ userId: id, role: memberRoleSchema.shape.role }),
      execute: ({ userId, role }) => unwrap(a.members[':userId'].$patch({ param: { userId }, json: { role } })),
    }),

    // ---------------- AI handoff drafts ----------------
    generate_handoff_draft: tool({
      description:
        'Turn notes or a transcript the user pasted into this conversation into a reviewable handoff draft for an engagement and kind. Pass the notes verbatim; never write or summarize notes yourself. Every proposed item is verified against the notes. Nothing is written to the handoff until apply_handoff_draft.',
      inputSchema: z.object({ engagementId: id, kind: handoffKindSchema, notes: handoffDraftGenerateSchema }),
      execute: ({ engagementId, kind, notes }) => unwrap(a.engagements[':id'].handoffs[':kind'].drafts.$post({ param: { id: engagementId, kind }, json: notes })),
    }),
    apply_handoff_draft: tool({
      description:
        'Apply the verified items of the pending draft to the handoff (sections, stakeholders, outcomes, commitments as milestones, gaps). Items the verifier could not trace to the notes are never applied here; a person can review those in the Handoffs tab.',
      inputSchema: z.object({ engagementId: id, kind: handoffKindSchema }),
      execute: async ({ engagementId, kind }) => {
        const includeUnverified = false
        const draft = await unwrap(a.engagements[':id'].handoffs[':kind'].drafts.pending.$get({ param: { id: engagementId, kind } }))
        if (!draft) return { error: 'No pending draft for this handoff. Generate one first.' }
        if ('error' in draft) return draft
        const p = draft.proposal as unknown as VerifiedDraft
        const keep = <T extends { verified: boolean }>(xs: T[]) => xs.filter((x) => includeUnverified || x.verified)
        const sections = Object.fromEntries(
          Object.entries(p.sections)
            .filter(([, s]) => s.state !== 'not_discussed' && (includeUnverified || s.verified))
            .map(([k, s]) => [k, { state: s.state, notes: s.notes, evidence: s.evidence }]),
        )
        return unwrap(
          a.engagements[':id'].handoffs[':kind'].drafts[':draftId'].apply.$post({
            param: { id: engagementId, kind, draftId: draft.id },
            json: {
              sections,
              stakeholders: keep(p.stakeholders).map((s) => ({ name: s.name, title: s.title, role: s.role, evidence: s.evidence })),
              outcomes: keep(p.outcomes).map((o) => ({ metric: o.metric, unit: o.unit, baseline: o.baseline, target: o.target, direction: o.direction, evidence: o.evidence })),
              commitments: keep(p.commitments).map((m) => ({ title: m.title, targetDate: m.targetDate, evidence: m.evidence })),
              gaps: keep(p.gaps).map((g) => ({ title: g.title, severity: g.severity, evidence: g.evidence })),
            },
          }),
        )
      },
    }),
    dismiss_handoff_draft: tool({
      description: 'Discard the pending draft for a handoff.',
      inputSchema: z.object({ engagementId: id, kind: handoffKindSchema }),
      execute: async ({ engagementId, kind }) => {
        const draft = await unwrap(a.engagements[':id'].handoffs[':kind'].drafts.pending.$get({ param: { id: engagementId, kind } }))
        if (!draft) return { error: 'No pending draft to dismiss.' }
        if ('error' in draft) return draft
        return unwrap(a.engagements[':id'].handoffs[':kind'].drafts[':draftId'].dismiss.$post({ param: { id: engagementId, kind, draftId: draft.id } }))
      },
    }),
  }, a)
}

export type AgentTools = ReturnType<typeof buildTools>
export type AgentToolName = keyof AgentTools
