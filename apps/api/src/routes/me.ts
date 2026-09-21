import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db, schema } from '../db/index.ts'
import { llmInfo } from '../lib/llm.ts'
import { requireOrg, type OrgEnv } from '../middleware/org.ts'

// Bootstrap payload for the SPA: who am I, which org, who else is here.
export const me = new Hono<OrgEnv>().use(requireOrg).get('/', async (c) => {
  const [org] = await db.select().from(schema.organization).where(eq(schema.organization.id, c.var.orgId)).limit(1)
  const members = await db
    .select({
      userId: schema.member.userId,
      role: schema.member.role,
      name: schema.user.name,
      email: schema.user.email,
      image: schema.user.image,
    })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
    .where(eq(schema.member.organizationId, c.var.orgId))
    .orderBy(schema.user.name)
  return c.json({ userId: c.var.userId, role: c.var.role, organization: org!, members, ai: llmInfo })
})
