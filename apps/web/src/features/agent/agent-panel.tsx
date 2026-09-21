import { useChat } from '@ai-sdk/react'
import { useQueryClient } from '@tanstack/react-query'
import { useParams, useRouterState } from '@tanstack/react-router'
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from 'ai'
import { BorderBeam } from 'border-beam'
import { cn } from 'cn'
import { ArrowUp, Bot, Loader2, Mic, MicOff, RotateCcw, Square, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MessageParts } from './message-parts'
import { useRecorder } from './use-recorder'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { useMe } from '@/lib/me'

const SUGGESTIONS = [
  'What needs attention today?',
  'Which handoffs are waiting for acceptance, and what is blocking them?',
  'Create a Hardening thread on this engagement with an issue for the audit log, assigned to Grace',
  'Summarize the Claims triage agent engagement',
]

/**
 * The operator. Reads run freely; every write pauses for an Approve/Deny card. Route params are
 * sent as context so "this engagement" resolves. Hidden entirely when the API has no model.
 */
export function AgentPanel() {
  const me = useMe()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') (e.preventDefault(), setOpen((o) => !o))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  if (!me.ai.enabled) return null

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            key="fab"
            type="button"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => setOpen(true)}
            title="Agent (⌘J)"
            className="fixed bottom-5 right-5 z-40"
          >
            <BorderBeam size="line" colorVariant="ocean" strength={0.6} theme="dark" borderRadius={999} className="rounded-full">
              <span className="grid size-11 place-items-center rounded-full bg-card text-foreground shadow-xl">
                <Bot className="size-5" />
              </span>
            </BorderBeam>
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>{open && <Panel key="panel" onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  )
}

function Panel({ onClose }: { onClose: () => void }) {
  const me = useMe()
  const qc = useQueryClient()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const params = useParams({ strict: false }) as Record<string, string | undefined>
  const contextRef = useRef({})
  contextRef.current = useMemo(() => {
    const seg = pathname.split('/')[1]
    const id = params.id
    return {
      path: pathname,
      engagementId: seg === 'engagements' ? id : undefined,
      accountId: seg === 'accounts' ? id : undefined,
      threadId: seg === 'threads' ? id : undefined,
      issueId: new URLSearchParams(location.search).get('issue') ?? undefined,
      gapId: new URLSearchParams(location.search).get('gap') ?? undefined,
    }
  }, [pathname, params.id])

  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/agent/chat', credentials: 'include', body: () => ({ context: contextRef.current }) }),
    [],
  )
  const { messages, sendMessage, status, stop, error, addToolApprovalResponse, setMessages, regenerate, clearError } = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onFinish: () => qc.invalidateQueries(),
  })
  const busy = status === 'submitted' || status === 'streaming'
  const [input, setInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), [messages, status])
  useEffect(() => inputRef.current?.focus(), [])

  const recorder = useRecorder(useCallback((text: string) => setInput((v) => (v ? `${v} ${text}` : text)), []))

  const send = (text: string) => {
    const t = text.trim()
    if (!t || busy) return
    setInput('')
    void sendMessage({ text: t })
  }
  const pendingApproval = messages.some((m) => m.parts.some((p) => 'state' in p && p.state === 'approval-requested'))

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 34 }}
      className="fixed bottom-5 right-5 z-40 w-[440px] max-w-[calc(100vw-2.5rem)]"
    >
      <BorderBeam size="md" colorVariant="ocean" strength={busy ? 0.9 : 0.35} active={busy || pendingApproval} theme="dark" borderRadius={18} className="rounded-[18px]">
        <div className="flex h-[640px] max-h-[80vh] flex-col overflow-hidden rounded-[18px] border border-border/60 bg-card/95 shadow-2xl backdrop-blur-xl">
          <header className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
            <Bot className="size-4 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">Agent</div>
              <div className="truncate text-[10px] text-muted-foreground">
                {me.ai.model} · reads freely, writes need your approval
              </div>
            </div>
            {messages.length > 0 && (
              <Button variant="ghost" size="icon" className="size-7" title="New conversation" onClick={() => (stop(), setMessages([]), clearError())}>
                <RotateCcw className="size-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="size-7" title="Close (⌘J)" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.length === 0 && (
              <div className="pt-6">
                <p className="text-sm text-muted-foreground">
                  Ask about accounts, engagements, handoffs, issues and gaps, or tell me what to change. I look things up before acting and ask when a request
                  is ambiguous. Every change waits for your approval.
                </p>
                <div className="mt-4 space-y-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="block w-full rounded-lg border border-border/60 px-3 py-2 text-left text-xs text-foreground/90 hover:border-border hover:bg-accent/50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[92%] space-y-2', m.role === 'user' ? 'rounded-2xl rounded-br-md bg-primary/15 px-3 py-2 text-sm' : 'w-full')}>
                  <MessageParts message={m} onApproval={(id, approved) => addToolApprovalResponse({ id, approved })} />
                </div>
              </div>
            ))}
            {busy && messages.at(-1)?.role === 'user' && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> Thinking…
              </div>
            )}
            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                {error.message || 'The model call failed.'}
                <div className="mt-1.5 flex gap-2">
                  <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => regenerate()}>
                    Try again
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => clearError()}>
                    Dismiss
                  </Button>
                </div>
              </div>
            )}
          </div>

          <form
            className="border-t border-border/60 p-2"
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
          >
            {recorder.state === 'error' && <p className="mb-1 px-1 text-[11px] text-destructive">{recorder.error}</p>}
            <div className="flex items-end gap-1.5 rounded-xl border border-border/60 bg-background/60 p-1.5 focus-within:border-primary/50">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) (e.preventDefault(), send(input))
                  if (e.key === 'Escape') onClose()
                }}
                rows={Math.min(5, Math.max(1, input.split('\n').length))}
                placeholder={recorder.state === 'recording' ? 'Listening… press the mic to stop' : recorder.state === 'transcribing' ? 'Transcribing…' : pendingApproval ? 'Approve or deny above, or type…' : 'Ask or instruct…'}
                className="max-h-32 min-h-[32px] flex-1 resize-none bg-transparent px-1.5 py-1 text-sm focus:outline-none"
                disabled={recorder.state === 'transcribing'}
              />
              {me.ai.transcribe && recorder.supported && (
                <Button
                  type="button"
                  size="icon"
                  variant={recorder.state === 'recording' ? 'destructive' : 'ghost'}
                  className={cn('size-8 shrink-0', recorder.state === 'recording' && 'animate-pulse')}
                  title={recorder.state === 'recording' ? 'Stop recording' : 'Speak'}
                  onClick={recorder.toggle}
                  disabled={recorder.state === 'transcribing' || busy}
                >
                  {recorder.state === 'transcribing' ? <Loader2 className="size-4 animate-spin" /> : recorder.state === 'recording' ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                </Button>
              )}
              {busy ? (
                <Button type="button" size="icon" variant="outline" className="size-8 shrink-0" title="Stop" onClick={() => stop()}>
                  <Square className="size-3.5" />
                </Button>
              ) : (
                <Button type="submit" size="icon" className="size-8 shrink-0" disabled={!input.trim()} title="Send (Enter)">
                  <ArrowUp className="size-4" />
                </Button>
              )}
            </div>
            <div className="mt-1 flex items-center justify-between px-1 text-[10px] text-muted-foreground">
              <span>
                <Kbd>↵</Kbd> send · <Kbd>⇧↵</Kbd> newline · <Kbd>⌘J</Kbd> toggle
              </span>
              <span>Notes you send go to {me.ai.provider}</span>
            </div>
          </form>
        </div>
      </BorderBeam>
    </motion.div>
  )
}
