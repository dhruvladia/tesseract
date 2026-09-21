import { zValidator } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import type { ZodType } from 'zod'

export const notFound = (what = 'Resource') => new HTTPException(404, { message: `${what} not found` })
export const badRequest = (message: string) => new HTTPException(400, { message })

/** Throws 404 if the row is missing; narrows the type otherwise. */
export function must<T>(row: T | undefined | null, what?: string): T {
  if (row == null) throw notFound(what)
  return row
}

/** zValidator with a readable `{ error }` body instead of a raw ZodError dump. */
export const v = <Target extends 'json' | 'query' | 'param', S extends ZodType>(target: Target, schema: S) =>
  zValidator(target, schema, (result) => {
    if (!result.success) {
      const msg = result.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ')
      throw badRequest(msg)
    }
  })
