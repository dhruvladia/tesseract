/**
 * Simulated design-partner test: technical win -> accepted handoff -> kickoff, for three partners,
 * driven entirely through the agent against a running API (so it exercises the same path a browser does).
 *
 *   pnpm sim              (API on http://localhost:3001 with LLM_* configured, demo seed loaded)
 *   API_URL=... pnpm sim
 *
 * Personas: AE drafts and tidies the handoff, EM accepts, FDE converts. Writes are auto-approved;
 * deletes are denied, to exercise the deny path. Every approval decision is printed as an audit line.
 */
import { readUIMessageStream, type UIMessage, type UIMessageChunk } from 'ai'
import { TRANSCRIPTS } from './transcripts.ts'

const API = process.env.API_URL ?? 'http://localhost:3001'
const ORIGIN = process.env.SIM_ORIGIN ?? 'http://localhost:5173'
const PASSWORD = 'tesseract-demo'

type Partner = { engagement: string; account: string; threadToDelete: string; fde: string }
const PARTNERS: Partner[] = [
  { engagement: 'Fraud signals copilot', account: 'Northwind Bank', threadToDelete: 'Discovery', fde: 'linus@acme.ai' },
  { engagement: 'Outage report summarization', account: 'Helios Energy', threadToDelete: 'Bootcamp', fde: 'grace@acme.ai' },
  { engagement: 'Customs document triage', account: 'Cobalt Freight', threadToDelete: 'Prototype', fde: 'linus@acme.ai' },
]
const AE = 'diego@acme.ai'
const EM = 'maya@acme.ai'

// ---------------------------------------------------------------- http helpers
async function signIn(email: string) {
  const res = await fetch(`${API}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`sign-in failed for ${email}: ${res.status} ${await res.text()}`)
  const cookies = res.headers.getSetCookie().map((c) => c.split(';')[0]!)
  if (!cookies.length) throw new Error(`no session cookie for ${email}`)
  return cookies.join('; ')
}
async function get<T>(cookie: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { cookie, origin: ORIGIN } })
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}
async function post<T>(cookie: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers: { cookie, origin: ORIGIN, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const json = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(`${path}: ${json.error ?? res.status}`)
  return json
}

// ---------------------------------------------------------------- agent conversation
type ToolPart = { type: string; toolCallId: string; state: string; input?: unknown; output?: unknown; approval?: { id: string; approved?: boolean; requestReason?: string } }
type Audit = { tool: string; reason: string; decision: 'approved' | 'denied'; result?: string }

/** Sends one user message and follows the approval loop until the assistant finishes. */
async function converse(cookie: string, text: string, opts: { deny?: (tool: string) => boolean; log: (s: string) => void; answer?: string }) {
  const messages: UIMessage[] = [{ id: `u-${Date.now()}`, role: 'user', parts: [{ type: 'text', text }] }]
  const audit: Audit[] = []
  const toolCalls: string[] = []
  let rounds = 0
  let answered = false
  const seenErrors = new Set<string>()
  for (;;) {
    rounds++
    const res = await fetch(`${API}/api/agent/chat`, {
      method: 'POST',
      headers: { cookie, origin: ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({ messages, context: {} }),
      signal: AbortSignal.timeout(180_000),
    })
    if (!res.ok || !res.body) throw new Error(`chat: ${res.status} ${await res.text()}`)

    // SSE -> UIMessageChunk stream -> assistant message (what useChat does in the browser). After an
    // approval round the server continues the previous assistant message, so merge into it.
    const chunks = res.body.pipeThrough(new TextDecoderStream()).pipeThrough(sseToJson())
    const prev = messages.at(-1)
    const continuing = prev?.role === 'assistant'
    let assistant: UIMessage | undefined = continuing ? prev : undefined
    for await (const m of readUIMessageStream({ stream: chunks, message: continuing ? prev : undefined })) assistant = m
    if (!assistant) throw new Error('empty assistant message')
    if (continuing) messages[messages.length - 1] = assistant
    else messages.push(assistant)

    const parts = assistant.parts as unknown as ToolPart[]
    for (const p of parts) if (p.type.startsWith('tool-') && !toolCalls.includes(p.toolCallId)) toolCalls.push(p.toolCallId)
    for (const p of parts) {
      if (!p.type.startsWith('tool-') || !p.output) continue
      const name = p.type.slice(5)
      const last = audit.findLast((a) => a.tool === name && !a.result)
      const out = p.output as { error?: string; identifier?: string }
      if (last && !last.result) last.result = out?.error ? `refused: ${out.error}` : 'ok'
      if (out?.error && !seenErrors.has(p.toolCallId)) {
        seenErrors.add(p.toolCallId)
        opts.log(`      ↳ platform: ${out.error}`)
      }
    }
    const pending = parts.filter((p) => p.type.startsWith('tool-') && p.state === 'approval-requested')
    if (pending.length === 0) {
      const reply = assistant.parts.filter((p) => p.type === 'text').map((p) => (p as { text: string }).text).join('\n').trim()
      const wroteSomething = parts.some((p) => p.type.startsWith('tool-') && p.state === 'output-available' && /^tool-(create|update|delete|add|remove|change|save|accept|reopen|link|unlink|set|generate|apply|dismiss)_/.test(p.type))
      if (!wroteSomething && audit.length === 0 && !answered) {
        answered = true
        opts.log(`    agent asked: ${reply.replace(/\s+/g, ' ').slice(0, 160)}`)
        const answer = opts.answer ?? 'Yes, go ahead exactly as I asked, on the engagement I named.'
        opts.log(`    partner: ${answer}`)
        messages.push({ id: `u-${Date.now()}-a`, role: 'user', parts: [{ type: 'text', text: answer }] })
        continue
      }
      return { reply, audit, toolCalls, rounds }
    }
    for (const p of pending) {
      const tool = p.type.slice(5)
      const deny = opts.deny?.(tool) ?? false
      const reason = p.approval?.requestReason ?? tool
      audit.push({ tool, reason, decision: deny ? 'denied' : 'approved' })
      opts.log(`    ${deny ? '✗ denied  ' : '✓ approved'} ${reason}`)
      p.state = 'approval-responded'
      p.approval = { ...p.approval!, approved: !deny }
    }
  }
}

function sseToJson() {
  let buf = ''
  return new TransformStream<string, UIMessageChunk>({
    transform(chunk, controller) {
      buf += chunk
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (!data || data === '[DONE]') continue
        try {
          controller.enqueue(JSON.parse(data) as UIMessageChunk)
        } catch {
          /* partial line */
        }
      }
    },
  })
}

// ---------------------------------------------------------------- scenario
type Engagement = { id: string; name: string; phase: string; side: string; account: { name: string; key: string } }
type Detail = Engagement & { handoffs: { kind: string; acceptedAt: string | null; sections: Record<string, { state: string; notes: string }>; gaps: { severity: string; resolvedAt: string | null; ownerId: string | null }[] }[] }
type Metrics = {
  rows: { engagementId: string; techWinToKickoffDays: number | null; handoffs: Record<string, { hoursToAccept: number | null; reopens: number; gapsAddedAfterAcceptance: number; thinConfirmations: number | null; draftItemsProposed: number; draftItemsApplied: number }> }[]
}

async function findEngagement(cookie: string, name: string) {
  const all = await get<Engagement[]>(cookie, '/api/engagements?includeClosed=1')
  const e = all.find((x) => x.name === name)
  if (!e) throw new Error(`engagement "${name}" not found; load the demo seed first (SEED_DEMO=1)`)
  return e
}

async function runPartner(p: Partner, cookies: Record<string, string>, log: (s: string) => void) {
  const t0 = Date.now()
  const stats = { turns: 0, approvals: 0, denials: 0, refusals: 0, toolCalls: 0, rounds: 0 }
  const tally = (r: Awaited<ReturnType<typeof converse>>) => {
    stats.turns++
    stats.rounds += r.rounds
    stats.toolCalls += r.toolCalls.length
    stats.approvals += r.audit.filter((a) => a.decision === 'approved').length
    stats.denials += r.audit.filter((a) => a.decision === 'denied').length
    stats.refusals += r.audit.filter((a) => a.result?.startsWith('refused')).length
    log(`    agent: ${r.reply.replace(/\s+/g, ' ').slice(0, 220)}`)
  }
  const deny = (tool: string) => tool.startsWith('delete_')

  const eng = await findEngagement(cookies[AE]!, p.engagement)
  if (eng.phase !== 'technical_win') {
    log(`  ${p.engagement} is at ${eng.phase}; moving to technical_win to start the scenario`)
    await post(cookies[AE]!, `/api/engagements/${eng.id}/phase`, { phase: 'technical_win' })
  }
  const tr = TRANSCRIPTS[p.engagement]!

  log(`\n  [1] AE drafts the handoff from call notes`)
  tally(
    await converse(
      cookies[AE]!,
      `Draft the pre-to-post handoff for the "${p.engagement}" engagement (${p.account}) from the notes below, then apply every verified item of the draft. Pass the notes to the tool exactly as written, with the label "${tr.label}".\n\n${tr.text}`,
      { deny, log },
    ),
  )

  let d0 = await get<Detail>(cookies[AE]!, `/api/engagements/${eng.id}`)
  if (!d0.handoffs.find((h) => h.kind === 'pre_to_post')) {
    log(`    WARN: no handoff record after step 1; asking once more`)
    tally(await converse(cookies[AE]!, `You did not create the draft. Call generate_handoff_draft now for "${p.engagement}" with the notes I pasted in my previous message, label "${tr.label}", then apply_handoff_draft.`, { deny, log }))
    d0 = await get<Detail>(cookies[AE]!, `/api/engagements/${eng.id}`)
  }
  const afterDraft = Object.values(d0.handoffs.find((h) => h.kind === 'pre_to_post')?.sections ?? {}).filter((x) => x.state !== 'not_discussed').length
  log(`    record after drafting: ${afterDraft} section${afterDraft === 1 ? '' : 's'} with content`)

  log(`  [2] AE tidies the record (and asks for one thing that should be refused)`)
  tally(
    await converse(
      cookies[AE]!,
      `On the pre-to-post handoff for "${p.engagement}": mark every section that is still unmarked as not discussed, give every open gap that has no owner to Grace Hopper, and make sure every gap has a title. Then delete the "${p.threadToDelete}" thread on that engagement.`,
      { deny, log },
    ),
  )

  log(`  [3] EM tries to accept`)
  const acceptTry = await converse(cookies[EM]!, `Accept the pre-to-post handoff for "${p.engagement}".`, { deny, log })
  tally(acceptTry)
  const detail1 = await get<Detail>(cookies[EM]!, `/api/engagements/${eng.id}`)
  const h1 = detail1.handoffs.find((h) => h.kind === 'pre_to_post')
  if (!h1?.acceptedAt) {
    log(`  [3b] EM resolves what blocked acceptance and accepts`)
    tally(
      await converse(
        cookies[EM]!,
        `The pre-to-post handoff for "${p.engagement}" could not be accepted yet. Tell me exactly what blocks it. Then: resolve any unresolved blocking gap (mark it resolved, keep its owner), and give any unowned gap to Grace Hopper. If any section is still unmarked, mark it not discussed. If most sections have no content at all, do not accept; tell me the record is empty. Otherwise accept the handoff.`,
        { deny, log, answer: 'Yes. Do exactly those steps on the engagement I named; nothing else.' },
      ),
    )
  }

  log(`  [4] FDE converts to post-sales`)
  tally(
    await converse(cookies[p.fde]!, `Convert the "${p.engagement}" engagement at ${p.account} to post-sales: move it to kickoff.`, {
      deny,
      log,
      answer: 'Only move it if the platform allows it. Do not change the handoff, do not accept anything, do not draft anything. If it is blocked, tell me why and stop.',
    }),
  )

  const detail = await get<Detail>(cookies[AE]!, `/api/engagements/${eng.id}`)
  const h = detail.handoffs.find((x) => x.kind === 'pre_to_post')
  const states = Object.values(h?.sections ?? {}).map((s) => s.state)
  const metrics = await get<Metrics>(cookies[AE]!, '/api/metrics/handoffs')
  const row = metrics.rows.find((r) => r.engagementId === eng.id)
  const hm = row?.handoffs.pre_to_post
  return {
    partner: p.engagement,
    finalPhase: detail.phase,
    accepted: !!h?.acceptedAt,
    confirmed: states.filter((s) => s === 'confirmed').length,
    unclear: states.filter((s) => s === 'unclear').length,
    notDiscussed: states.filter((s) => s === 'not_discussed').length,
    gaps: h?.gaps.length ?? 0,
    openGaps: h?.gaps.filter((g) => !g.resolvedAt).length ?? 0,
    thin: hm?.thinConfirmations ?? null,
    draftProposed: hm?.draftItemsProposed ?? 0,
    draftApplied: hm?.draftItemsApplied ?? 0,
    hoursToAccept: hm?.hoursToAccept ?? null,
    wallSeconds: Math.round((Date.now() - t0) / 1000),
    ...stats,
  }
}

// ---------------------------------------------------------------- main
const log = (s: string) => console.log(s)
console.log(`Tesseract design-partner simulation against ${API}`)
const health = await fetch(`${API}/api/health`).catch(() => null)
if (!health?.ok) throw new Error(`API not reachable at ${API}. Start it with SEED_DEMO=1 pnpm dev.`)
const cookies: Record<string, string> = {}
for (const email of new Set([AE, EM, ...PARTNERS.map((p) => p.fde)])) cookies[email] = await signIn(email)
const me = await get<{ ai: { enabled: boolean; model: string | null } }>(cookies[AE]!, '/api/me')
if (!me.ai.enabled) throw new Error('AI is not configured on the API (LLM_PROVIDER / LLM_MODEL / LLM_API_KEY).')
console.log(`model: ${me.ai.model}; personas: AE ${AE}, EM ${EM}, FDEs ${[...new Set(PARTNERS.map((p) => p.fde))].join(', ')}`)

const results = []
for (const p of PARTNERS) {
  console.log(`\n=== ${p.engagement} (${p.account}) ===`)
  try {
    results.push(await runPartner(p, cookies, log))
  } catch (e) {
    console.error(`  FAILED: ${e instanceof Error ? e.message : e}`)
    results.push({ partner: p.engagement, error: e instanceof Error ? e.message : String(e) })
  }
}

console.log('\n=== Summary: technical win -> accepted handoff -> kickoff ===')
for (const r of results) {
  if ('error' in r) {
    console.log(`${r.partner}: FAILED ${r.error}`)
    continue
  }
  console.log(
    [
      `${r.partner}`,
      `  outcome: ${r.finalPhase === 'kickoff' ? 'KICKOFF reached' : `stuck at ${r.finalPhase}`}, handoff ${r.accepted ? 'accepted' : 'NOT accepted'}${r.hoursToAccept != null ? ` (${r.hoursToAccept}h after record created)` : ''}`,
      `  handoff: ${r.confirmed} confirmed / ${r.unclear} unclear / ${r.notDiscussed} not discussed; ${r.gaps} gaps (${r.openGaps} open); thin confirmations ${r.thin ?? '-'}`,
      `  AI draft: ${r.draftApplied} of ${r.draftProposed} proposed items applied by a person`,
      `  effort: ${r.turns} user messages, ${r.rounds} model rounds, ${r.toolCalls} tool calls, ${r.approvals} approvals, ${r.denials} denials, ${r.refusals} platform refusals, ${r.wallSeconds}s wall clock`,
    ].join('\n'),
  )
}
const attention = await get<{ items: { kind: string }[] }>(cookies[AE]!, '/api/attention')
console.log(`\nAttention items now: ${attention.items.length} (${Object.entries(attention.items.reduce<Record<string, number>>((a, i) => ((a[i.kind] = (a[i.kind] ?? 0) + 1), a), {})).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'})`)
process.exit(results.some((r) => 'error' in r || r.finalPhase !== 'kickoff') ? 1 : 0)
