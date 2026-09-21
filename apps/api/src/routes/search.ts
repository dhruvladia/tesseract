import { searchQuerySchema } from '@tesseract/shared'
import { and, eq, ilike, or } from 'drizzle-orm'
import { Hono } from 'hono'
import { db, schema } from '../db/index.ts'
import { v } from '../lib/http.ts'
import { requireOrg, type OrgEnv } from '../middleware/org.ts'

const { issue, engagement: eng, customerAccount: acct, productGap } = schema

// Cmd-K backend: a handful of ILIKE queries. ponytail: fine to ~10k rows; swap for pg_trgm/tsvector when it isn't.
export const search = new Hono<OrgEnv>().use(requireOrg).get('/', v('query', searchQuerySchema), async (c) => {
  const q = `%${c.req.valid('query').q}%`
  const org = c.var.orgId
  const [accounts, engagements, issues, gaps] = await Promise.all([
    db
      .select({ id: acct.id, name: acct.name, key: acct.key })
      .from(acct)
      .where(and(eq(acct.organizationId, org), or(ilike(acct.name, q), ilike(acct.key, q))))
      .limit(5),
    db
      .select({ id: eng.id, name: eng.name, side: eng.side, phase: eng.phase, accountKey: acct.key, accountName: acct.name })
      .from(eng)
      .innerJoin(acct, eq(acct.id, eng.accountId))
      .where(and(eq(eng.organizationId, org), or(ilike(eng.name, q), ilike(acct.name, q))))
      .limit(6),
    db
      .select({ id: issue.id, identifier: issue.identifier, title: issue.title, status: issue.status })
      .from(issue)
      .where(and(eq(issue.organizationId, org), or(ilike(issue.title, q), ilike(issue.identifier, q))))
      .limit(8),
    db
      .select({ id: productGap.id, title: productGap.title, status: productGap.status })
      .from(productGap)
      .where(and(eq(productGap.organizationId, org), ilike(productGap.title, q)))
      .limit(5),
  ])
  return c.json({ accounts, engagements, issues, gaps })
})
