import { labelCreateSchema, labelUpdateSchema } from '@tesseract/shared'
import { and, asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db, schema } from '../db/index.ts'
import { must, v } from '../lib/http.ts'
import { requireOrg, type OrgEnv } from '../middleware/org.ts'

const { label } = schema

export const labels = new Hono<OrgEnv>()
  .use(requireOrg)
  .get('/', async (c) => c.json(await db.select().from(label).where(eq(label.organizationId, c.var.orgId)).orderBy(asc(label.name))))
  .post('/', v('json', labelCreateSchema), async (c) => {
    const [row] = await db
      .insert(label)
      .values({ ...c.req.valid('json'), organizationId: c.var.orgId })
      .returning()
    return c.json(row!, 201)
  })
  .patch('/:id', v('json', labelUpdateSchema), async (c) => {
    const [row] = await db
      .update(label)
      .set(c.req.valid('json'))
      .where(and(eq(label.id, c.req.param('id')), eq(label.organizationId, c.var.orgId)))
      .returning()
    return c.json(must(row, 'Label'))
  })
  .delete('/:id', async (c) => {
    const [row] = await db
      .delete(label)
      .where(and(eq(label.id, c.req.param('id')), eq(label.organizationId, c.var.orgId)))
      .returning({ id: label.id })
    return c.json(must(row, 'Label'))
  })
