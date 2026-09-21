import { stepCountIs, type ToolApprovalStatus } from 'ai'
import { llm } from '../lib/llm.ts'
import { makeInternalClient } from './client.ts'
import { makeDescriber } from './describe.ts'
import { systemPrompt, type AgentContext } from './prompt.ts'
import { buildTools, WRITE_TOOLS, type AgentToolName } from './tools.ts'

export type ApprovalDecision = 'user-approval' | 'approved' | 'denied'

/**
 * One definition shared by the chat route (streamText) and the simulation (generateText).
 * `approval` decides what happens to write tools: the UI asks the person; the sim answers itself.
 */
export async function agentConfig(opts: {
  cookie: string
  context: AgentContext
  user: { name: string; role: string; userId: string }
  approval?: (toolName: AgentToolName, description: string, input: unknown) => ApprovalDecision | Promise<ApprovalDecision>
}) {
  if (!llm) throw new Error('AI is not configured')
  const api = await makeInternalClient(opts.cookie)
  const tools = buildTools(api)
  const describe = makeDescriber(api)
  const decide = opts.approval ?? (() => 'user-approval' as const)

  return {
    model: llm,
    system: systemPrompt(opts.context, opts.user, new Date().toISOString().slice(0, 10)),
    tools,
    stopWhen: stepCountIs(20),
    toolApproval: async ({ toolCall }: { toolCall: { toolName: string; input: unknown } }): Promise<ToolApprovalStatus> => {
      if (!WRITE_TOOLS.has(toolCall.toolName)) return 'not-applicable'
      const reason = await describe(toolCall.toolName, toolCall.input)
      const decision = await decide(toolCall.toolName as AgentToolName, reason, toolCall.input)
      return { type: decision, reason }
    },
  }
}
