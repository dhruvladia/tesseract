import { convertToModelMessages, streamText, transcribe, type UIMessage } from 'ai'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { agentConfig } from '../agent/core.ts'
import { db, schema } from '../db/index.ts'
import { llmEnabled, transcriber } from '../lib/llm.ts'
import { requireOrg, type OrgEnv } from '../middleware/org.ts'
import { eq } from 'drizzle-orm'

const MAX_AUDIO_BYTES = 25 * 1024 * 1024

const contextSchema = z
  .object({
    path: z.string().max(300).optional(),
    engagementId: z.string().optional(),
    accountId: z.string().optional(),
    issueId: z.string().optional(),
    threadId: z.string().optional(),
    gapId: z.string().optional(),
  })
  .partial()

export const agent = new Hono<OrgEnv>()
  .use(requireOrg)
  .post('/chat', async (c) => {
    if (!llmEnabled) throw new HTTPException(503, { message: 'The agent is not configured. Set LLM_PROVIDER, LLM_MODEL and LLM_API_KEY on the API.' })
    const body = (await c.req.json().catch(() => null)) as { messages?: UIMessage[]; context?: unknown } | null
    if (!body?.messages?.length) throw new HTTPException(400, { message: 'messages required' })
    const context = contextSchema.safeParse(body.context ?? {})
    const [u] = await db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, c.var.userId)).limit(1)

    const cfg = await agentConfig({
      cookie: c.req.header('cookie') ?? '',
      context: context.success ? context.data : {},
      user: { name: u?.name ?? 'User', role: c.var.role, userId: c.var.userId },
    })
    const result = streamText({
      ...cfg,
      messages: await convertToModelMessages(body.messages.slice(-30)),
      onError: ({ error }) => console.error('[agent]', error instanceof Error ? error.message : error),
    })
    return result.toUIMessageStreamResponse({
      onError: (error) => (error instanceof Error ? error.message : 'The model call failed'),
    })
  })
  .post('/transcribe', async (c) => {
    if (!transcriber) throw new HTTPException(503, { message: 'Voice input is not configured (needs the openai provider and LLM_TRANSCRIBE_MODEL).' })
    const form = await c.req.formData().catch(() => null)
    const file = form?.get('audio')
    if (!(file instanceof File)) throw new HTTPException(400, { message: 'audio file required' })
    if (file.size > MAX_AUDIO_BYTES) throw new HTTPException(413, { message: 'Recording is too large (25 MB max)' })
    if (file.size < 1000) throw new HTTPException(400, { message: 'Recording is too short' })
    try {
      const { text } = await transcribe({ model: transcriber, audio: new Uint8Array(await file.arrayBuffer()), abortSignal: AbortSignal.timeout(60_000) })
      return c.json({ text: text.trim() })
    } catch (e) {
      console.error('[transcribe]', e)
      throw new HTTPException(502, { message: 'Transcription failed. Try again or type your request.' })
    }
  })
