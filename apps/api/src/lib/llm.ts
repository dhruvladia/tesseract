import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel, TranscriptionModel } from 'ai'

// Bring-your-own model. Unset LLM_PROVIDER -> every AI surface in the app is hidden.
//   LLM_PROVIDER=anthropic|openai|openai-compatible  LLM_MODEL=<id>  LLM_API_KEY=<key>  LLM_BASE_URL=<for openai-compatible>
//   LLM_TRANSCRIBE_MODEL=<id>  (voice input; openai provider only, default gpt-4o-mini-transcribe, set "off" to disable)
const provider = process.env.LLM_PROVIDER?.trim()
const modelId = process.env.LLM_MODEL?.trim()
const apiKey = process.env.LLM_API_KEY?.trim()
const baseURL = process.env.LLM_BASE_URL?.trim()
const transcribeId = process.env.LLM_TRANSCRIBE_MODEL?.trim() ?? 'gpt-4o-mini-transcribe'

function build(): { chat: LanguageModel; transcribe: TranscriptionModel | null } | null {
  if (!provider || !modelId) return null
  switch (provider) {
    case 'anthropic':
      return apiKey ? { chat: createAnthropic({ apiKey })(modelId), transcribe: null } : null
    case 'openai': {
      if (!apiKey) return null
      const openai = createOpenAI({ apiKey })
      return { chat: openai(modelId), transcribe: transcribeId === 'off' ? null : openai.transcription(transcribeId) }
    }
    case 'openai-compatible':
      return baseURL ? { chat: createOpenAICompatible({ name: 'custom', baseURL, apiKey }).chatModel(modelId), transcribe: null } : null
    default:
      console.warn(`[llm] unknown LLM_PROVIDER "${provider}"; AI features disabled`)
      return null
  }
}

const built = build()
export const llm = built?.chat ?? null
export const transcriber = built?.transcribe ?? null
export const llmEnabled = llm !== null
export const llmInfo = llmEnabled
  ? { enabled: true as const, provider: provider!, model: modelId!, transcribe: transcriber !== null }
  : { enabled: false as const, provider: null, model: null, transcribe: false }
