import { and, asc, eq, inArray, lt, ne } from 'drizzle-orm'
import { Hono } from 'hono'
import { db, schema } from '../db/index.ts'
import { computeAttention } from '../lib/attention.ts'
import { requireOrg, type OrgEnv } from '../middleware/org.ts'

const { engagement: eng, issue } = schema

// Ordinary automation: what needs a human today, computed from data the team already keeps.
export const attention = new Hono<OrgEnv>().use(requireOrg).get('/', async (c) => {
  const today = new Date().toISOString().slice(0, 10)
  const [engagements, overdue] = await Promise.all([
    db.query.engagement.findMany({
      where: and(eq(eng.organizationId, c.var.orgId), ne(eng.phase, 'closed')),
      columns: { id: true, name: true, side: true, phase: true, phaseEnteredAt: true, fdeId: true, engagementManagerId: true, aeId: true, csmId: true },
      with: {
        account: { columns: { key: true }, with: { stakeholders: { columns: { role: true } } } },
        handoffs: { columns: { kind: true, acceptedAt: true, sections: true, gaps: true } },
        milestones: { columns: { title: true, targetDate: true, completedAt: true } },
        outcomes: { columns: { firstValueVerifiedAt: true } },
      },
      orderBy: asc(eng.phaseEnteredAt),
    }),
    db
      .select({ id: issue.id, identifier: issue.identifier, title: issue.title, assigneeId: issue.assigneeId, dueDate: issue.dueDate, engagementId: issue.engagementId })
      .from(issue)
      .where(and(eq(issue.organizationId, c.var.orgId), lt(issue.dueDate, today), inArray(issue.status, ['backlog', 'todo', 'in_progress']))),
  ])
  const byEng = new Map<string, typeof overdue>()
  for (const i of overdue) if (i.engagementId) (byEng.get(i.engagementId) ?? byEng.set(i.engagementId, []).get(i.engagementId)!).push(i)

  const items = computeAttention(
    engagements.map((e) => ({
      ...e,
      overdueIssues: (byEng.get(e.id) ?? []).map((i) => ({ id: i.id, identifier: i.identifier, title: i.title, assigneeId: i.assigneeId, dueDate: i.dueDate! })),
    })),
  )
  return c.json({ items, generatedAt: new Date().toISOString() })
})
