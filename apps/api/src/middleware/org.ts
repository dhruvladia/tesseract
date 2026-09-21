import { and, eq } from 'drizzle-orm'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { auth } from '../auth.ts'
import { db, schema } from '../db/index.ts'

export type OrgEnv = {
  Variables: {
    userId: string
    orgId: string
    role: string
  }
}

// Resolves session -> active organization -> membership. Every domain route runs behind this,
// and every query must filter on c.var.orgId.
export const requireOrg = createMiddleware<OrgEnv>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) throw new HTTPException(401, { message: 'Unauthorized' })
  const userId = session.user.id

  let orgId = session.session.activeOrganizationId ?? null
  let role: string | undefined
  if (orgId) {
    const [m] = await db
      .select({ role: schema.member.role })
      .from(schema.member)
      .where(and(eq(schema.member.userId, userId), eq(schema.member.organizationId, orgId)))
      .limit(1)
    role = m?.role
  }
  if (!role) {
    // No (valid) active org on the session: fall back to the user's first membership and persist it.
    const [m] = await db
      .select({ organizationId: schema.member.organizationId, role: schema.member.role })
      .from(schema.member)
      .where(eq(schema.member.userId, userId))
      .orderBy(schema.member.createdAt)
      .limit(1)
    if (!m) throw new HTTPException(403, { message: 'No organization' })
    orgId = m.organizationId
    role = m.role
    await db.update(schema.session).set({ activeOrganizationId: orgId }).where(eq(schema.session.id, session.session.id))
  }

  c.set('userId', userId)
  c.set('orgId', orgId!)
  c.set('role', role)
  await next()
})

export const requireAdmin = createMiddleware<OrgEnv>(async (c, next) => {
  if (!['owner', 'admin'].includes(c.var.role)) throw new HTTPException(403, { message: 'Admin only' })
  await next()
})
