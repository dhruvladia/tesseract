import { hc } from 'hono/client'
import type { AppType } from '../app.ts'

/**
 * A typed client for Tesseract's own API that never leaves the process: requests go straight
 * into the Hono app with the caller's cookie, so org scoping, validation, the lifecycle gate
 * and event logging apply to the agent exactly as they do to a person.
 */
export async function makeInternalClient(cookie: string) {
  const { app } = await import('../app.ts') // late import: app.ts imports the agent route
  return hc<AppType>('http://tesseract.internal', {
    fetch: ((input: string | URL | Request, init?: RequestInit) => app.request(input, init)) as typeof fetch,
    headers: { cookie, origin: process.env.TRUSTED_ORIGINS?.split(',')[0]?.trim() ?? 'http://localhost:5173' },
  })
}
export type InternalClient = Awaited<ReturnType<typeof makeInternalClient>>

/** Unwrap a Response into data or `{ error }`; tools must never throw at the model. */
export async function unwrap<T extends Response>(p: Promise<T>): Promise<Awaited<ReturnType<T['json']>> | { error: string }> {
  try {
    const res = await p
    const body = (await res.json().catch(() => null)) as unknown
    if (!res.ok) {
      const msg = (body as { error?: string } | null)?.error ?? `${res.status} ${res.statusText}`
      return { error: msg }
    }
    return body as Awaited<ReturnType<T['json']>>
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Request failed' }
  }
}
