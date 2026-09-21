import { memberAddSchema, memberRoleSchema } from '@tesseract/shared'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { db, schema } from '../db/index.ts'
import { badRequest, must, v } from '../lib/http.ts'
import { requireAdmin, requireOrg, type OrgEnv } from '../middleware/org.ts'

const { member, user, organization } = schema

// Org settings and membership. Members are existing users (they signed up); with AUTO_JOIN=false
// this is how an admin lets them in.
export const members = new Hono<OrgEnv>()
  .use(requireOrg)
  .use(requireAdmin)
  .patch('/org', v('json', z.object({ name: z.string().trim().min(1).max(100) })), async (c) => {
    const [row] = await db.update(organization).set(c.req.valid('json')).where(eq(organization.id, c.var.orgId)).returning()
    return c.json(row!)
  })
  .post('/', v('json', memberAddSchema), async (c) => {
    const { email, role } = c.req.valid('json')
    const [u] = await db.select({ id: user.id }).from(user).where(eq(user.email, email.toLowerCase())).limit(1)
    if (!u) throw badRequest('No user with that email has signed up yet. Ask them to create an account first.')
    const [existing] = await db
      .select({ id: member.id })
      .from(member)
      .where(and(eq(member.userId, u.id), eq(member.organizationId, c.var.orgId)))
      .limit(1)
    if (existing) throw badRequest('Already a member')
    const [row] = await db
      .insert(member)
      .values({ id: crypto.randomUUID(), organizationId: c.var.orgId, userId: u.id, role, createdAt: new Date() })
      .returning()
    return c.json(row!, 201)
  })
  .patch('/:userId', v('json', memberRoleSchema), async (c) => {
    const target = must(
      await db.query.member.findFirst({ where: and(eq(member.userId, c.req.param('userId')), eq(member.organizationId, c.var.orgId)) }),
      'Member',
    )
    if (target.role === 'owner') throw badRequest('The owner role cannot be changed here')
    const [row] = await db.update(member).set({ role: c.req.valid('json').role }).where(eq(member.id, target.id)).returning()
    return c.json(row!)
  })
  .delete('/:userId', async (c) => {
    const target = must(
      await db.query.member.findFirst({ where: and(eq(member.userId, c.req.param('userId')), eq(member.organizationId, c.var.orgId)) }),
      'Member',
    )
    if (target.role === 'owner') throw badRequest('The owner cannot be removed')
    if (target.userId === c.var.userId) throw badRequest('You cannot remove yourself')
    await db.delete(member).where(eq(member.id, target.id))
    return c.json({ id: target.id })
  })
