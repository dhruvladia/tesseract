// Demo seed: a workspace with an FDE team and a realistic portfolio of engagements.
// Idempotent: skips demo data if the org already has accounts.
// Run: pnpm db:seed (Postgres) or start the API with SEED_DEMO=1 (PGlite is single-process).
import { count, eq } from 'drizzle-orm'
import { auth } from '../auth.ts'
import { db, schema } from './index.ts'

const ORG = { name: 'Acme AI', slug: 'acme-ai' }
const PEOPLE = [
  { name: 'Ada Lovelace', email: 'ada@acme.ai', role: 'owner' },
  { name: 'Grace Hopper', email: 'grace@acme.ai', role: 'fde' },
  { name: 'Linus Park', email: 'linus@acme.ai', role: 'fde' },
  { name: 'Maya Chen', email: 'maya@acme.ai', role: 'engagement_manager' },
  { name: 'Diego Ruiz', email: 'diego@acme.ai', role: 'account_exec' },
  { name: 'Priya Nair', email: 'priya@acme.ai', role: 'csm' },
  { name: 'Sam Okafor', email: 'sam@acme.ai', role: 'product' },
] as const
export const DEMO_PASSWORD = 'tesseract-demo'

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000)
const daysAhead = (n: number) => daysAgo(-n)
const iso = (d: Date) => d.toISOString().slice(0, 10)
const para = (t: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] })

async function ensureUser(name: string, email: string) {
  const [existing] = await db.select().from(schema.user).where(eq(schema.user.email, email)).limit(1)
  if (existing) return existing
  const res = await auth.api.signUpEmail({ body: { name, email, password: DEMO_PASSWORD } })
  return res.user
}

export async function seedCore() {
  let [org] = await db.select().from(schema.organization).where(eq(schema.organization.slug, ORG.slug)).limit(1)
  if (!org) {
    ;[org] = await db
      .insert(schema.organization)
      .values({ id: crypto.randomUUID(), name: ORG.name, slug: ORG.slug, createdAt: new Date() })
      .returning()
  }
  const users: Record<string, string> = {}
  for (const p of PEOPLE) {
    const u = await ensureUser(p.name, p.email)
    users[p.email] = u.id
    const [m] = await db.select().from(schema.member).where(eq(schema.member.userId, u.id)).limit(1)
    if (!m) {
      await db.insert(schema.member).values({ id: crypto.randomUUID(), organizationId: org!.id, userId: u.id, role: p.role, createdAt: new Date() })
    } else if (m.role !== p.role) {
      await db.update(schema.member).set({ role: p.role }).where(eq(schema.member.id, m.id))
    }
  }
  return { org: org!, users }
}

export async function seedDemo() {
  const { org, users } = await seedCore()
  const orgId = org.id
  const [{ n }] = await db.select({ n: count() }).from(schema.customerAccount).where(eq(schema.customerAccount.organizationId, orgId))
  if (n! > 0) return { org, skipped: true }

  const grace = users['grace@acme.ai']!,
    linus = users['linus@acme.ai']!,
    maya = users['maya@acme.ai']!,
    diego = users['diego@acme.ai']!,
    priya = users['priya@acme.ai']!,
    sam = users['sam@acme.ai']!,
    ada = users['ada@acme.ai']!

  // ---- accounts + stakeholders ----
  const acct = async (v: { name: string; key: string; domain: string; arr: string | null; notes?: string }) =>
    (await db.insert(schema.customerAccount).values({ ...v, organizationId: orgId }).returning())[0]!
  const nwb = await acct({ name: 'Northwind Bank', key: 'NWB', domain: 'northwind.com', arr: '480000', notes: 'Regional bank, 2,400 claims adjusters. Data lives in on-prem SQL Server; cloud egress requires InfoSec sign-off per dataset.' })
  const hel = await acct({ name: 'Helios Energy', key: 'HEL', domain: 'helios-energy.com', arr: null, notes: 'Utility. Prospect via Diego; bootcamp scheduled.' })
  const mrd = await acct({ name: 'Meridian Health', key: 'MRD', domain: 'meridianhealth.org', arr: '1200000', notes: 'Hospital network, 14 sites. HIPAA BAA signed. Epic integration through their integration engine.' })
  const atl = await acct({ name: 'Atlas Logistics', key: 'ATL', domain: 'atlaslogistics.io', arr: null })
  const cbf = await acct({ name: 'Cobalt Freight', key: 'CBF', domain: 'cobaltfreight.eu', arr: null, notes: 'European customs broker, four entry points. Everything stays in the EU; on-prem Kubernetes in Rotterdam.' })

  const sh = (accountId: string, role: (typeof schema.stakeholder.$inferInsert)['role'], name: string, title: string, email: string, notes?: string) => ({
    organizationId: orgId,
    accountId,
    role,
    name,
    title,
    email,
    notes,
  })
  await db.insert(schema.stakeholder).values([
    sh(nwb.id, 'sponsor', 'Helen Marsh', 'VP Claims Operations', 'h.marsh@northwind.com', 'Owns the 2027 cost-per-claim target.'),
    sh(nwb.id, 'technical_owner', 'Raj Patel', 'Head of Data Platform', 'r.patel@northwind.com'),
    sh(nwb.id, 'workflow_owner', 'Tom Alvarez', 'Claims Team Lead, Auto', 't.alvarez@northwind.com', 'Runs the daily triage stand-up. Will operate the agent after handoff.'),
    sh(nwb.id, 'champion', 'Sofia Kim', 'Senior Adjuster', 's.kim@northwind.com', 'Built the spreadsheet everyone actually uses.'),
    sh(hel.id, 'sponsor', 'Mark Delaney', 'COO', 'mdelaney@helios-energy.com'),
    sh(hel.id, 'technical_owner', 'Ines Rocha', 'Director, Grid IT', 'irocha@helios-energy.com'),
    sh(mrd.id, 'sponsor', 'Dr. Anita Rao', 'CMIO', 'arao@meridianhealth.org'),
    sh(mrd.id, 'technical_owner', 'Ben Osei', 'VP Clinical Informatics', 'bosei@meridianhealth.org'),
    sh(mrd.id, 'workflow_owner', 'Carla Nguyen', 'Prior Authorization Manager', 'cnguyen@meridianhealth.org'),
    sh(mrd.id, 'blocker', 'Frank Lowe', 'Compliance Officer', 'flowe@meridianhealth.org', 'Wants a full audit trail before any PHI touches the model. Reasonable; plan for it.'),
    sh(atl.id, 'sponsor', 'Yusuf Adeyemi', 'VP Network Operations', 'yusuf@atlaslogistics.io'),
    sh(cbf.id, 'sponsor', 'Nadia Okonjo', 'VP Customs Operations', 'n.okonjo@cobaltfreight.eu'),
    sh(cbf.id, 'technical_owner', 'Felix Braun', 'Head of Engineering', 'f.braun@cobaltfreight.eu'),
  ])

  // ---- engagements ----
  const eng = async (v: Omit<typeof schema.engagement.$inferInsert, 'organizationId'>) =>
    (await db.insert(schema.engagement).values({ ...v, organizationId: orgId }).returning())[0]!

  const claims = await eng({
    accountId: nwb.id,
    name: 'Claims triage agent',
    side: 'postsales',
    phase: 'build',
    decision: 'Move the auto-claims triage agent from pilot to production across all 6 regional claims teams.',
    description:
      'Sold: an agent that reads FNOL packets and routes claims to the right adjuster tier. Actually happens: 40% of packets arrive as scanned PDFs with handwritten annotations; the triage rules live in Sofia’s spreadsheet, not the policy manual. First wedge: auto tier-1/tier-2 routing for typed packets, human review for the rest.',
    fdeId: grace,
    engagementManagerId: maya,
    aeId: diego,
    csmId: priya,
    outcome: 'won',
    phaseEnteredAt: daysAgo(9),
    createdAt: daysAgo(68),
  })
  const fraud = await eng({
    accountId: nwb.id,
    name: 'Fraud signals copilot',
    side: 'presales',
    phase: 'technical_win',
    decision: 'Expand the Northwind contract to the Special Investigations Unit (second business unit).',
    fdeId: linus,
    engagementManagerId: maya,
    aeId: diego,
    phaseEnteredAt: daysAgo(2),
    createdAt: daysAgo(14),
  })
  const outage = await eng({
    accountId: hel.id,
    name: 'Outage report summarization',
    side: 'presales',
    phase: 'technical_win',
    decision: 'Sign a 12-month platform agreement after a 5-day bootcamp on real outage tickets.',
    description: 'Bootcamp days 1-2: connect ServiceNow export + SCADA event log. Days 3-4: co-build summarizer with Grid IT. Day 5: exec demo with ROI on mean-time-to-report.',
    fdeId: grace,
    engagementManagerId: maya,
    aeId: diego,
    phaseEnteredAt: daysAgo(3),
    createdAt: daysAgo(21),
  })
  const tech = await eng({
    accountId: hel.id,
    name: 'Field technician assistant',
    side: 'presales',
    phase: 'qualify',
    decision: 'Decide whether this is worth FDE capacity at all: data is on ruggedized tablets with intermittent connectivity.',
    aeId: diego,
    phaseEnteredAt: daysAgo(2),
    createdAt: daysAgo(2),
  })
  const priorAuth = await eng({
    accountId: mrd.id,
    name: 'Prior-auth letter drafting',
    side: 'postsales',
    phase: 'adopt',
    decision: 'Hand the drafting workflow to the prior-auth team as a business-owned operation and exit the account.',
    description: 'Live since week 9. 61% of letters go out with no edits. Remaining adoption blocker: two sites still fax.',
    fdeId: linus,
    engagementManagerId: maya,
    aeId: diego,
    csmId: priya,
    outcome: 'won',
    phaseEnteredAt: daysAgo(18),
    createdAt: daysAgo(112),
  })
  const coding = await eng({
    accountId: mrd.id,
    name: 'Coding audit assistant',
    side: 'postsales',
    phase: 'live',
    decision: 'Prove the audit assistant reduces denials before the renewal conversation in Q1.',
    fdeId: linus,
    engagementManagerId: maya,
    csmId: priya,
    outcome: 'won',
    phaseEnteredAt: daysAgo(12),
    createdAt: daysAgo(70),
  })
  const dispatch = await eng({
    accountId: atl.id,
    name: 'Dispatch exception triage',
    side: 'presales',
    phase: 'scope',
    decision: 'Convert a 6-week paid pilot into a production contract for the dispatch center.',
    fdeId: linus,
    aeId: diego,
    phaseEnteredAt: daysAgo(24),
    createdAt: daysAgo(40),
  })
  const customs = await eng({
    accountId: cbf.id,
    name: 'Customs document triage',
    side: 'presales',
    phase: 'technical_win',
    decision: 'Sign a three-month paid deployment for the two low-risk lanes, with an option for all four entry points.',
    description: 'Prototype classified 1,200 historical packets with 91% agreement. Reads from Docuware, never the mailbox. Nothing leaves the EU.',
    fdeId: linus,
    engagementManagerId: maya,
    aeId: diego,
    phaseEnteredAt: daysAgo(1),
    createdAt: daysAgo(30),
  })
  await eng({
    accountId: atl.id,
    name: 'Route planning POC',
    side: 'presales',
    phase: 'closed',
    decision: 'Win a route-optimization pilot.',
    description: 'Lost to incumbent; they already had a routing vendor and the sponsor left. Learned: no workflow owner was ever named.',
    aeId: diego,
    outcome: 'lost',
    phaseEnteredAt: daysAgo(30),
    closedAt: daysAgo(30),
    createdAt: daysAgo(75),
  })

  // ---- outcomes + milestones ----
  await db.insert(schema.outcome).values([
    { organizationId: orgId, engagementId: claims.id, metric: 'Claims triaged per adjuster per day', unit: 'claims/day', baseline: '42', current: '61', target: '80', direction: 'up', firstValueVerifiedAt: daysAgo(31) },
    { organizationId: orgId, engagementId: claims.id, metric: 'Mis-tiered claims', unit: '%', baseline: '11', current: '7.5', target: '4', direction: 'down' },
    { organizationId: orgId, engagementId: priorAuth.id, metric: 'Letters sent without edits', unit: '%', baseline: '0', current: '61', target: '70', direction: 'up', firstValueVerifiedAt: daysAgo(48) },
    { organizationId: orgId, engagementId: priorAuth.id, metric: 'Turnaround time', unit: 'hours', baseline: '38', current: '9', target: '8', direction: 'down', firstValueVerifiedAt: daysAgo(48) },
    { organizationId: orgId, engagementId: coding.id, metric: 'Claim denials (coding-related)', unit: '%', baseline: '6.2', current: '5.4', target: '4', direction: 'down' },
    { organizationId: orgId, engagementId: outage.id, metric: 'Mean time to publish outage report', unit: 'minutes', baseline: '95', target: '20', direction: 'down' },
    { organizationId: orgId, engagementId: dispatch.id, metric: 'Exceptions resolved without escalation', unit: '%', baseline: '31', target: '60', direction: 'up' },
  ])
  await db.insert(schema.milestone).values([
    { organizationId: orgId, engagementId: claims.id, kind: 'kickoff', title: 'Kickoff', targetDate: iso(daysAgo(40)), completedAt: daysAgo(40) },
    { organizationId: orgId, engagementId: claims.id, kind: 'first_value', title: 'First value (typed packets routed)', targetDate: iso(daysAgo(32)), completedAt: daysAgo(31) },
    { organizationId: orgId, engagementId: claims.id, kind: 'production', title: 'Production across 6 teams', targetDate: iso(daysAhead(12)) },
    { organizationId: orgId, engagementId: claims.id, kind: 'handoff', title: 'Handoff to CS + Tom’s team', targetDate: iso(daysAhead(45)) },
    { organizationId: orgId, engagementId: priorAuth.id, kind: 'production', title: 'Production', targetDate: iso(daysAgo(50)), completedAt: daysAgo(49) },
    { organizationId: orgId, engagementId: priorAuth.id, kind: 'handoff', title: 'Handoff', targetDate: iso(daysAhead(8)) },
    { organizationId: orgId, engagementId: coding.id, kind: 'production', title: 'Production', targetDate: iso(daysAgo(14)), completedAt: daysAgo(12) },
    { organizationId: orgId, engagementId: outage.id, kind: 'custom', title: 'Bootcamp day 5: exec demo', targetDate: iso(daysAhead(2)) },
    { organizationId: orgId, engagementId: dispatch.id, kind: 'custom', title: 'Scope sign-off', targetDate: iso(daysAgo(4)) },
  ])

  // ---- handoffs ----
  const confirmed = (notes: string) => ({ state: 'confirmed' as const, notes })
  const handoffs = await db.insert(schema.handoff).values([
    {
      organizationId: orgId,
      engagementId: claims.id,
      kind: 'pre_to_post',
      createdById: diego,
      createdAt: daysAgo(44),
      acceptedById: maya,
      acceptedAt: daysAgo(41),
      sections: {
        customer_overview: confirmed('Regional bank; claims cost per file up 18% YoY triggered the evaluation.'),
        goals_success_criteria: confirmed('80 claims/adjuster/day (from 42); mis-tiering under 4%.'),
        use_cases_scope: confirmed('Auto claims only. Property and commercial explicitly out of scope for year one.'),
        configuration_requirements: confirmed('Dedicated tenant, SSO via Okta, model access restricted to US region.'),
        integrations_constraints: confirmed('SQL Server 2016 on-prem; nightly extract approved by InfoSec. No direct DB access.'),
        stakeholders_roles: confirmed('Helen (sponsor), Raj (technical), Tom (workflow), Sofia (champion).'),
        timeline_milestones: confirmed('Go-live before Q4 close.'),
        risks_open_questions: { state: 'unclear', notes: 'Scanned-PDF share unknown until we see a full week of packets.' },
      },
      gaps: [
        { id: 'g-nwb-1', title: 'Confirm scanned-PDF share of intake', severity: 'high', ownerId: grace, resolvedAt: daysAgo(35).toISOString() },
        { id: 'g-nwb-2', title: 'InfoSec approval for nightly extract', severity: 'blocking', ownerId: diego, resolvedAt: daysAgo(42).toISOString() },
      ],
    },
    {
      organizationId: orgId,
      engagementId: priorAuth.id,
      kind: 'pre_to_post',
      createdById: diego,
      createdAt: daysAgo(103),
      acceptedById: maya,
      acceptedAt: daysAgo(100),
      sections: Object.fromEntries(
        ['customer_overview', 'goals_success_criteria', 'use_cases_scope', 'configuration_requirements', 'integrations_constraints', 'stakeholders_roles', 'timeline_milestones', 'risks_open_questions'].map((k) => [k, confirmed('See deal notes.')]),
      ),
      gaps: [],
    },
    {
      organizationId: orgId,
      engagementId: priorAuth.id,
      kind: 'post_to_cs',
      createdById: linus,
      createdAt: daysAgo(6),
      sections: {
        customer_overview: confirmed('14-site network. Prior-auth team of 22.'),
        goals_success_criteria: confirmed('70% no-edit letters, 8h turnaround. Currently 61% / 9h.'),
        use_cases_scope: confirmed('Drafting only. Submission stays manual by policy.'),
        configuration_requirements: confirmed('Runbook in the shared drive; on-call rota is Carla’s team.'),
        integrations_constraints: confirmed('Epic via integration engine; no PHI leaves the tenant.'),
        stakeholders_roles: { state: 'unclear', notes: 'Named technical owner after handoff still TBD: Ben says his team, Frank wants Compliance to co-own.' },
        timeline_milestones: confirmed('Handoff in 8 days.'),
        risks_open_questions: { state: 'unclear', notes: 'Two sites still fax; adoption stalls there.' },
      },
      gaps: [
        { id: 'g-mrd-1', title: 'Name the post-handoff technical owner', severity: 'blocking', ownerId: maya, resolvedAt: null },
        { id: 'g-mrd-2', title: 'Fax-only sites: interim process', severity: 'medium', ownerId: priya, resolvedAt: null },
        { id: 'g-mrd-3', title: 'Monitoring dashboard access for CS', severity: 'low', ownerId: null, resolvedAt: null },
      ],
    },
  ]).returning({ id: schema.handoff.id, engagementId: schema.handoff.engagementId, kind: schema.handoff.kind })

  // ---- lifecycle events (what the metrics page reads) ----
  const pe = (engagementId: string, steps: [from: (typeof schema.phaseEvent.$inferInsert)['from'], to: (typeof schema.phaseEvent.$inferInsert)['to'], daysBack: number][], actorId: string) =>
    steps.map(([from, to, d]) => ({ organizationId: orgId, engagementId, from, to, actorId, createdAt: daysAgo(d) }))
  await db.insert(schema.phaseEvent).values([
    ...pe(claims.id, [['qualify', 'discover', 62], ['discover', 'scope', 56], ['scope', 'prototype', 52], ['prototype', 'technical_win', 46], ['technical_win', 'kickoff', 40], ['kickoff', 'build', 9]], grace),
    ...pe(fraud.id, [['qualify', 'discover', 12], ['discover', 'scope', 8], ['scope', 'prototype', 5], ['prototype', 'technical_win', 2]], linus),
    ...pe(outage.id, [['qualify', 'discover', 18], ['discover', 'scope', 10], ['scope', 'prototype', 5], ['prototype', 'technical_win', 1]], grace),
    ...pe(customs.id, [['qualify', 'discover', 28], ['discover', 'scope', 21], ['scope', 'prototype', 14], ['prototype', 'technical_win', 1]], linus),
    ...pe(priorAuth.id, [['qualify', 'discover', 110], ['discover', 'scope', 107], ['scope', 'prototype', 105], ['prototype', 'technical_win', 104], ['technical_win', 'kickoff', 99], ['kickoff', 'build', 92], ['build', 'validate', 70], ['validate', 'live', 50], ['live', 'adopt', 18]], linus),
    ...pe(coding.id, [['kickoff', 'build', 62], ['build', 'validate', 30], ['validate', 'live', 12]], linus),
    ...pe(dispatch.id, [['qualify', 'discover', 36], ['discover', 'scope', 24]], linus),
  ])

  const hoNwb = handoffs.find((h) => h.engagementId === claims.id && h.kind === 'pre_to_post')!
  const hoMrdPre = handoffs.find((h) => h.engagementId === priorAuth.id && h.kind === 'pre_to_post')!
  const hoMrdCs = handoffs.find((h) => h.engagementId === priorAuth.id && h.kind === 'post_to_cs')!
  const he = (h: { id: string; engagementId: string; kind: 'pre_to_post' | 'post_to_cs' }, event: (typeof schema.handoffEvent.$inferInsert)['event'], daysBack: number, actorId: string, meta?: Record<string, unknown>) => ({
    organizationId: orgId,
    handoffId: h.id,
    engagementId: h.engagementId,
    kind: h.kind,
    event,
    actorId,
    meta,
    createdAt: daysAgo(daysBack),
  })
  const sectionKeys = ['customer_overview', 'goals_success_criteria', 'use_cases_scope', 'configuration_requirements', 'integrations_constraints', 'stakeholders_roles', 'timeline_milestones', 'risks_open_questions']
  await db.insert(schema.handoffEvent).values([
    he(hoNwb, 'created', 44, diego),
    ...sectionKeys.map((k, i) => he(hoNwb, 'section_marked', 44 - i * 0.25, diego, { section: k, state: k === 'risks_open_questions' ? 'unclear' : 'confirmed', from: null })),
    he(hoNwb, 'gap_added', 44, diego, { gapId: 'g-nwb-2', severity: 'blocking', title: 'InfoSec approval for nightly extract', afterAcceptance: false }),
    he(hoNwb, 'gap_added', 43, grace, { gapId: 'g-nwb-1', severity: 'high', title: 'Confirm scanned-PDF share of intake', afterAcceptance: false }),
    he(hoNwb, 'gap_resolved', 42, diego, { gapId: 'g-nwb-2', severity: 'blocking' }),
    he(hoNwb, 'accepted', 41, maya, { thinConfirmations: 0, confirmed: 7, unclear: 1, openGaps: 1 }),
    he(hoNwb, 'gap_resolved', 35, grace, { gapId: 'g-nwb-1', severity: 'high' }),
    // the Meridian pre-sales handoff was rubber-stamped: every section "confirmed" with a 15-char note
    he(hoMrdPre, 'created', 103, diego),
    ...sectionKeys.map((k) => he(hoMrdPre, 'section_marked', 102, diego, { section: k, state: 'confirmed', from: null })),
    he(hoMrdPre, 'accepted', 100, maya, { thinConfirmations: 8, confirmed: 8, unclear: 0, openGaps: 0 }),
    // ...and the team paid for it after kickoff
    he(hoMrdPre, 'reopened', 96, maya),
    he(hoMrdPre, 'gap_added', 96, linus, { gapId: 'g-mrd-late-1', severity: 'high', title: 'Epic integration engine access was never scoped', afterAcceptance: true }),
    he(hoMrdPre, 'gap_added', 95, linus, { gapId: 'g-mrd-late-2', severity: 'medium', title: 'Two sites still on fax', afterAcceptance: true }),
    he(hoMrdPre, 'accepted', 93, maya, { thinConfirmations: 2, confirmed: 6, unclear: 2, openGaps: 2 }),
    he(hoMrdCs, 'created', 6, linus),
    ...sectionKeys.map((k, i) => he(hoMrdCs, 'section_marked', 6 - i * 0.1, linus, { section: k, state: ['stakeholders_roles', 'risks_open_questions'].includes(k) ? 'unclear' : 'confirmed', from: null })),
    he(hoMrdCs, 'gap_added', 5, linus, { gapId: 'g-mrd-1', severity: 'blocking', title: 'Name the post-handoff technical owner', afterAcceptance: false }),
    he(hoMrdCs, 'gap_added', 5, priya, { gapId: 'g-mrd-2', severity: 'medium', title: 'Fax-only sites: interim process', afterAcceptance: false }),
    he(hoMrdCs, 'gap_added', 4, linus, { gapId: 'g-mrd-3', severity: 'low', title: 'Monitoring dashboard access for CS', afterAcceptance: false }),
  ])

  // ---- threads + issues ----
  const thread = async (engagementId: string | null, name: string, description?: string) =>
    (await db.insert(schema.thread).values({ organizationId: orgId, engagementId, name, description }).returning())[0]!
  const counters: Record<string, number> = {}
  const issue = async (
    t: { id: string; engagementId: string | null },
    accountKey: string | null,
    accountId: string | null,
    v: Partial<typeof schema.issue.$inferInsert> & { title: string },
  ) => {
    const scope = accountId ? `acct:${accountId}` : `org:${orgId}`
    counters[scope] = (counters[scope] ?? 0) + 1
    const [row] = await db
      .insert(schema.issue)
      .values({
        organizationId: orgId,
        threadId: t.id,
        engagementId: t.engagementId,
        accountId,
        identifier: `${accountKey ?? 'INT'}-${counters[scope]}`,
        createdById: ada,
        status: 'todo',
        priority: 'none',
        completedAt: v.status === 'done' ? daysAgo(3) : null,
        ...v,
      })
      .returning()
    await db.insert(schema.activity).values({ organizationId: orgId, issueId: row!.id, actorId: v.createdById ?? ada, field: 'created' })
    return row!
  }

  const tDisc = await thread(claims.id, 'Discovery', 'Week 1 interviews and workflow map')
  const tData = await thread(claims.id, 'Data access')
  const tProto = await thread(claims.id, 'Prototype')
  const tHard = await thread(claims.id, 'Hardening', 'Evals, monitoring, audit log, cost control')
  await issue(tDisc, 'NWB', nwb.id, { title: 'Shadow the auto-claims triage stand-up for a week', status: 'done', priority: 'high', assigneeId: grace })
  await issue(tDisc, 'NWB', nwb.id, { title: 'Map intake → tiering → assignment with exceptions', status: 'done', priority: 'high', assigneeId: grace, description: para('Sofia’s spreadsheet is the real policy. 14 exception rules, 3 undocumented.') })
  await issue(tData, 'NWB', nwb.id, { title: 'Nightly extract job from SQL Server (read-only)', status: 'done', assigneeId: grace })
  await issue(tData, 'NWB', nwb.id, { title: 'PII masking for adjuster notes field', status: 'in_progress', priority: 'urgent', assigneeId: grace, dueDate: iso(daysAhead(2)) })
  const evalParent = await issue(tHard, 'NWB', nwb.id, { title: 'Eval suite: 500 labelled historical packets', status: 'in_progress', priority: 'high', assigneeId: grace, dueDate: iso(daysAhead(6)) })
  await issue(tHard, 'NWB', nwb.id, { title: 'Label 200 scanned packets with Sofia', status: 'todo', assigneeId: grace, parentId: evalParent.id })
  await issue(tHard, 'NWB', nwb.id, { title: 'Regression gate in CI on tiering accuracy', status: 'todo', assigneeId: linus, parentId: evalParent.id })
  await issue(tHard, 'NWB', nwb.id, { title: 'Per-claim audit log with model version', status: 'todo', priority: 'medium', assigneeId: grace })
  await issue(tHard, 'NWB', nwb.id, { title: 'Cost ceiling alert at $40/day', status: 'backlog', priority: 'low' })
  await issue(tProto, 'NWB', nwb.id, { title: 'Vertical slice: typed FNOL → tier suggestion → adjuster UI', status: 'done', priority: 'high', assigneeId: grace })
  await issue(tProto, 'NWB', nwb.id, { title: 'Human review queue for low-confidence packets', status: 'done', assigneeId: grace })

  const tFraud = await thread(fraud.id, 'Discovery')
  await issue(tFraud, 'NWB', nwb.id, { title: 'Interview SIU lead: what does a "signal" look like today?', status: 'in_progress', priority: 'high', assigneeId: linus, dueDate: iso(daysAhead(1)) })
  await issue(tFraud, 'NWB', nwb.id, { title: 'Inventory SIU data sources and access owners', status: 'todo', assigneeId: linus })

  const tBoot = await thread(outage.id, 'Bootcamp', '5-day prototype on real outage tickets')
  await issue(tBoot, 'HEL', hel.id, { title: 'Day 1: ServiceNow export + SCADA event log connected', status: 'done', assigneeId: grace })
  await issue(tBoot, 'HEL', hel.id, { title: 'Day 3: summarizer co-built with Grid IT', status: 'in_progress', priority: 'high', assigneeId: grace })
  await issue(tBoot, 'HEL', hel.id, { title: 'Day 5: exec demo deck with MTTR baseline', status: 'todo', priority: 'urgent', assigneeId: maya, dueDate: iso(daysAhead(2)) })

  const tAdopt = await thread(priorAuth.id, 'Enablement')
  await issue(tAdopt, 'MRD', mrd.id, { title: 'Train site 9 and site 12 (fax-only) on the review queue', status: 'todo', priority: 'high', assigneeId: priya, dueDate: iso(daysAhead(5)) })
  await issue(tAdopt, 'MRD', mrd.id, { title: 'Runbook: model version bump procedure', status: 'done', assigneeId: linus })
  await issue(tAdopt, 'MRD', mrd.id, { title: 'Weekly adoption report to Dr. Rao', status: 'in_progress', assigneeId: maya })

  const tCode = await thread(coding.id, 'Hardening')
  await issue(tCode, 'MRD', mrd.id, { title: 'Denial-rate dashboard wired to claims system', status: 'in_progress', priority: 'high', assigneeId: linus })
  await issue(tCode, 'MRD', mrd.id, { title: 'Audit log export for Compliance (Frank)', status: 'todo', priority: 'urgent', assigneeId: linus, dueDate: iso(daysAgo(1)) })

  const tCust = await thread(customs.id, 'Prototype', 'Docuware classification prototype')
  await issue(tCust, 'CBF', cbf.id, { title: 'Re-label the tariff-dispute class with current brokers', status: 'todo', priority: 'high', assigneeId: linus })
  await issue(tCust, 'CBF', cbf.id, { title: 'Measure Docuware API throttling under load', status: 'in_progress', assigneeId: linus })

  const tScope = await thread(dispatch.id, 'Scoping')
  await issue(tScope, 'ATL', atl.id, { title: 'Draft outcome contract with Yusuf', status: 'in_progress', priority: 'high', assigneeId: linus })
  await issue(tScope, 'ATL', atl.id, { title: 'Name a workflow owner (none yet, same failure as route POC)', status: 'todo', priority: 'urgent', assigneeId: diego })

  const tInt = await thread(null, 'Eval harness', 'Reusable evaluation tooling across deployments')
  await issue(tInt, null, null, { title: 'Generic labelled-dataset loader (CSV/Parquet)', status: 'done', assigneeId: linus })
  await issue(tInt, null, null, { title: 'Tiering-accuracy metric as a shared package', status: 'in_progress', assigneeId: grace })
  const tPlay = await thread(null, 'Playbooks')
  await issue(tPlay, null, null, { title: 'Write the 5-day bootcamp playbook from Helios', status: 'todo', priority: 'medium', assigneeId: maya })
  await issue(tPlay, null, null, { title: 'Handoff checklist v2: add "named technical owner" as blocking by default', status: 'todo', assigneeId: maya })

  // sync the counter table so the API continues the sequences
  for (const [scope, nn] of Object.entries(counters)) await db.insert(schema.counter).values({ scope, n: nn })

  // ---- labels ----
  await db.insert(schema.label).values([
    { organizationId: orgId, name: 'eval', color: '#8b7cf6' },
    { organizationId: orgId, name: 'data-access', color: '#22c3c3' },
    { organizationId: orgId, name: 'security-review', color: '#f59e0b' },
    { organizationId: orgId, name: 'enablement', color: '#34d399' },
  ])

  // ---- product gaps (field -> product loop) ----
  const gap = async (v: Omit<typeof schema.productGap.$inferInsert, 'organizationId'>) =>
    (await db.insert(schema.productGap).values({ ...v, organizationId: orgId, createdById: v.createdById ?? grace }).returning())[0]!
  const batch = await gap({ title: 'Batch inference endpoint for nightly reprocessing', description: 'Both bank and hospital deployments re-score the day’s backlog overnight. Today that is a cron loop hitting the online endpoint; a batch API would cut cost ~70% and remove the rate-limit dance.', status: 'accepted', linkedIssueUrl: 'https://linear.app/acme/issue/PLAT-412' })
  const pdf = await gap({ title: 'PDF table extraction primitive', description: 'Shipped in 2.14 after Meridian and Northwind both needed it.', status: 'shipped', shippedAt: daysAgo(20), createdAt: daysAgo(60) })
  const ocr = await gap({ title: 'Scanned-PDF OCR fallback', status: 'triaged', parentId: pdf.id, createdById: grace })
  const audit = await gap({ title: 'Fine-grained audit log export (per request, per model version)', description: 'Compliance teams want to reconcile every generated artifact to a model version and prompt hash.', status: 'raised', createdById: linus })
  const sqls = await gap({ title: 'On-prem connector for SQL Server 2016', status: 'triaged', createdById: grace })
  await gap({ title: 'Offline-tolerant client for field tablets', status: 'raised', createdById: diego })

  await db.insert(schema.engagementGap).values([
    { engagementId: claims.id, gapId: batch.id, impact: 'major', arrInfluenced: '480000', note: 'Nightly re-tiering of the backlog.' },
    { engagementId: priorAuth.id, gapId: batch.id, impact: 'minor', arrInfluenced: '400000' },
    { engagementId: claims.id, gapId: ocr.id, impact: 'blocker', arrInfluenced: '480000', note: '40% of intake is scanned.' },
    { engagementId: priorAuth.id, gapId: pdf.id, impact: 'major', arrInfluenced: '800000' },
    { engagementId: coding.id, gapId: audit.id, impact: 'blocker', arrInfluenced: '1200000', note: 'Frank (Compliance) will not sign off on renewal without it.' },
    { engagementId: claims.id, gapId: sqls.id, impact: 'major', arrInfluenced: '480000' },
    { engagementId: outage.id, gapId: sqls.id, impact: 'minor', arrInfluenced: null },
  ])

  void sam
  return { org, skipped: false }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { org, skipped } = await seedDemo()
  console.log(skipped ? `org "${org.name}" already has data; nothing to do.` : `seeded demo workspace "${org.name}". Sign in as ada@acme.ai / ${DEMO_PASSWORD}`)
  process.exit(0)
}
