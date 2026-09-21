import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'

// Bring-your-own model. Unset LLM_PROVIDER -> every AI surface in the app is hidden.
//   LLM_PROVIDER=anthropic|openai|openai-compatible  LLM_MODEL=<id>  LLM_API_KEY=<key>  LLM_BASE_URL=<for openai-compatible>
const provider = process.env.LLM_PROVIDER?.trim()
const modelId = process.env.LLM_MODEL?.trim()
const apiKey = process.env.LLM_API_KEY?.trim()
const baseURL = process.env.LLM_BASE_URL?.trim()

function build(): LanguageModel | null {
  if (!provider || !modelId) return null
  switch (provider) {
    case 'anthropic':
      return apiKey ? createAnthropic({ apiKey })(modelId) : null
    case 'openai':
      return apiKey ? createOpenAI({ apiKey })(modelId) : null
    case 'openai-compatible':
      return baseURL ? createOpenAICompatible({ name: 'custom', baseURL, apiKey }).chatModel(modelId) : null
    default:
      console.warn(`[llm] unknown LLM_PROVIDER "${provider}"; AI features disabled`)
      return null
  }
}

export const llm = build()
export const llmEnabled = llm !== null
export const llmInfo = llmEnabled ? { enabled: true as const, provider: provider!, model: modelId! } : { enabled: false as const, provider: null, model: null }
