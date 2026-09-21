import type { UIMessage } from 'ai'
import { cn } from 'cn'
import { AlertTriangle, Check, ChevronRight, Loader2, Search, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

type Part = UIMessage['parts'][number]
type ToolPart = Extract<Part, { type: `tool-${string}` }> & {
  toolCallId: string
  state: string
  input?: unknown
  output?: unknown
  errorText?: string
  approval?: { id: string; approved?: boolean; requestReason?: string; reason?: string; isAutomatic?: boolean }
}

const isTool = (p: Part): p is ToolPart => p.type.startsWith('tool-')
const toolName = (p: ToolPart) => p.type.slice(5)
// Writes are the ones that paused for approval; reads are everything else. Mirrors the server's naming.
const isWrite = (name: string) => /^(create|update|delete|add|remove|change|save|accept|reopen|link|unlink|set|generate|apply|dismiss)_/.test(name)
const humanize = (name: string) => name.replace(/_/g, ' ')

export function MessageParts({ message, onApproval }: { message: UIMessage; onApproval: (id: string, approved: boolean) => void }) {
  return (
    <>
      {message.parts.map((part, i) => {
        if (part.type === 'text') return part.text.trim() ? <Text key={i} text={part.text} /> : null
        if (isTool(part)) return isWrite(toolName(part)) ? <WritePart key={part.toolCallId} part={part} onApproval={onApproval} /> : <ReadPart key={part.toolCallId} part={part} />
        return null
      })}
    </>
  )
}

/** Plain text with paragraphs, bullets and inline **bold**. No markdown library. */
function Text({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/)
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((b, i) => {
        const lines = b.split('\n')
        const isList = lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l))
        if (isList)
          return (
            <ul key={i} className="ml-4 list-disc space-y-0.5">
              {lines.map((l, j) => (
                <li key={j}>
                  <Inline text={l.replace(/^\s*([-*•]|\d+[.)])\s+/, '')} />
                </li>
              ))}
            </ul>
          )
        return (
          <p key={i} className="whitespace-pre-wrap">
            <Inline text={b} />
          </p>
        )
      })}
    </div>
  )
}

function Inline({ text }: { text: string }) {
  const chunks = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return (
    <>
      {chunks.map((c, i) =>
        c.startsWith('**') ? (
          <strong key={i} className="font-semibold">
            {c.slice(2, -2)}
          </strong>
        ) : c.startsWith('`') ? (
          <code key={i} className="rounded bg-muted px-1 font-mono text-[12px]">
            {c.slice(1, -1)}
          </code>
        ) : (
          c
        ),
      )}
    </>
  )
}

function ReadPart({ part }: { part: ToolPart }) {
  const [open, setOpen] = useState(false)
  const running = part.state === 'input-streaming' || part.state === 'input-available'
  const failed = part.state === 'output-error' || (part.output && typeof part.output === 'object' && 'error' in (part.output as object))
  const count = Array.isArray(part.output) ? part.output.length : Array.isArray((part.output as { items?: unknown[] })?.items) ? (part.output as { items: unknown[] }).items.length : null
  return (
    <div className="text-[11px] text-muted-foreground">
      <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-accent/60">
        {running ? <Loader2 className="size-3 animate-spin" /> : failed ? <AlertTriangle className="size-3 text-destructive" /> : <Search className="size-3" />}
        <span className="capitalize">{humanize(toolName(part))}</span>
        {count != null && <span>· {count}</span>}
        {!running && <ChevronRight className={cn('size-3 transition', open && 'rotate-90')} />}
      </button>
      {open && !running && (
        <pre className="mt-1 max-h-48 overflow-auto rounded-md border border-border/50 bg-background/60 p-2 font-mono text-[10px] leading-snug">
          {JSON.stringify(part.output ?? part.errorText ?? part.input, null, 1)?.slice(0, 4000)}
        </pre>
      )}
    </div>
  )
}

function WritePart({ part, onApproval }: { part: ToolPart; onApproval: (id: string, approved: boolean) => void }) {
  const reason = part.approval?.requestReason ?? humanize(toolName(part))
  const output = part.output as { error?: string; identifier?: string; name?: string; title?: string } | undefined
  switch (part.state) {
    case 'approval-requested':
      if (part.approval?.isAutomatic) return null
      return (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
          <div className="flex items-start gap-2 text-sm">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">Confirm this change</p>
              <p className="text-muted-foreground">{reason}</p>
            </div>
          </div>
          <div className="mt-2.5 flex justify-end gap-2">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onApproval(part.approval!.id, false)}>
              <X className="size-3.5" /> Deny
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={() => onApproval(part.approval!.id, true)}>
              <Check className="size-3.5" /> Approve
            </Button>
          </div>
        </div>
      )
    case 'approval-responded':
      return (
        <Chip tone={part.approval?.approved ? 'ok' : 'muted'} icon={part.approval?.approved ? Loader2 : X} spin={!!part.approval?.approved}>
          {part.approval?.approved ? 'Approved, running…' : 'Denied'} · {reason}
        </Chip>
      )
    case 'output-denied':
      return (
        <Chip tone="muted" icon={X}>
          Denied · {reason}
        </Chip>
      )
    case 'output-error':
      return (
        <Chip tone="bad" icon={AlertTriangle}>
          Failed · {part.errorText ?? reason}
        </Chip>
      )
    case 'output-available':
      if (output?.error)
        return (
          <Chip tone="bad" icon={AlertTriangle}>
            Refused · {output.error}
          </Chip>
        )
      return (
        <Chip tone="ok" icon={Check}>
          Done · {reason}
          {output?.identifier ? ` (${output.identifier})` : ''}
        </Chip>
      )
    default:
      return (
        <Chip tone="muted" icon={Loader2} spin>
          Preparing · {humanize(toolName(part))}
        </Chip>
      )
  }
}

function Chip({ tone, icon: Icon, spin, children }: { tone: 'ok' | 'bad' | 'muted'; icon: typeof Check; spin?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-[11px]',
        tone === 'ok' && 'border-presales/30 text-presales',
        tone === 'bad' && 'border-destructive/40 text-destructive',
        tone === 'muted' && 'border-border/60 text-muted-foreground',
      )}
    >
      <Icon className={cn('mt-0.5 size-3 shrink-0', spin && 'animate-spin')} />
      <span className="min-w-0 break-words">{children}</span>
    </div>
  )
}
