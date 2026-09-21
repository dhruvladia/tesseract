import { serve } from '@hono/node-server'
import { app } from './app.ts'

// SEED_DEMO=1 loads the demo workspace on boot (idempotent). Handy for PGlite, which is single-process.
if (process.env.SEED_DEMO === '1') {
  const { seedDemo, DEMO_PASSWORD } = await import('./db/seed.ts')
  const { skipped } = await seedDemo()
  if (!skipped) console.log(`seeded demo workspace. Sign in as ada@acme.ai / ${DEMO_PASSWORD}`)
}

const port = Number(process.env.PORT ?? 3001)
serve({ fetch: app.fetch, port }, () => {
  console.log(`tesseract api listening on http://localhost:${port}`)
})
