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
      const msg = result.error.issues
        .map((i) => {
          const field = String(i.path.at(-1) ?? 'body')
          const label = field.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
          if (i.code === 'too_small' && (i as { minimum?: number }).minimum === 1) return `${label} is required`
          if (i.code === 'invalid_value' || i.code === 'invalid_format') return `${label}: ${i.message.replace(/^Invalid option: expected one of /, 'must be one of ')}`
          return `${label}: ${i.message}`
        })
        .join('; ')
      throw badRequest(msg.charAt(0).toUpperCase() + msg.slice(1))
    }
  })
