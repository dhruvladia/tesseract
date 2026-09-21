import type { AppType } from '@tesseract/api'
import { hc } from 'hono/client'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export const client = hc<AppType>('/', { init: { credentials: 'include' } })
export const api = client.api

// Unwraps a hono/client Response: throws ApiError on non-2xx, returns typed JSON otherwise.
export async function unwrap<T extends Response>(p: Promise<T>): Promise<Awaited<ReturnType<T['json']>>> {
  const res = await p
  if (!res.ok) {
    let msg = res.statusText
    try {
      const body = await res.clone().json()
      msg = (body as { error?: string; message?: string }).error ?? (body as { message?: string }).message ?? msg
    } catch {
      msg = (await res.text()) || msg
    }
    throw new ApiError(res.status, msg)
  }
  return res.json() as Promise<Awaited<ReturnType<T['json']>>>
}
