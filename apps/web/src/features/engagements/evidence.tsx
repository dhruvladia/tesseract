import { useQuery } from '@tanstack/react-query'
import { cn } from 'cn'
import { FileText, Quote, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { snippetQuery } from '@/lib/queries-drafts'

export type EvidenceRef = { quote: string; line: number; verified: boolean; sourceId?: string }

/** A small chip per quote; the popover shows the quote in its surrounding source lines. */
export function EvidenceChips({ engagementId, evidence, className }: { engagementId: string; evidence: EvidenceRef[] | undefined; className?: string }) {
  if (!evidence?.length) return null
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1', className)}>
      {evidence.map((ev, i) => (
        <EvidenceChip key={i} engagementId={engagementId} ev={ev} />
      ))}
    </span>
  )
}

function EvidenceChip({ engagementId, ev }: { engagementId: string; ev: EvidenceRef }) {
  const [open, setOpen] = useState(false)
  const { data } = useQuery({ ...snippetQuery(engagementId, ev.sourceId ?? '', ev.line), enabled: open && !!ev.sourceId })
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          title={ev.verified ? `Line ${ev.line}: “${ev.quote}”` : 'Quote not found in the source'}
          className={cn(
            'inline-flex h-5 items-center gap-1 rounded-full border px-1.5 font-mono text-[10px] transition',
            ev.verified ? 'border-presales/40 text-presales hover:bg-presales/10' : 'border-destructive/40 text-destructive hover:bg-destructive/10',
          )}
        >
          {ev.verified ? <Quote className="size-2.5" /> : <ShieldAlert className="size-2.5" />}L{ev.line}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[440px] p-0 text-xs" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5 border-b border-border/50 px-3 py-1.5 text-[11px] text-muted-foreground">
          <FileText className="size-3" /> {data?.label ?? 'Source'} {data && <span className="ml-auto tabular-nums">line {ev.line} of {data.total}</span>}
        </div>
        {!ev.verified && (
          <p className="border-b border-destructive/30 bg-destructive/5 px-3 py-1.5 text-[11px] text-destructive">
            This quote was not found verbatim in the source. Treat the item as the model’s inference, not evidence.
          </p>
        )}
        <div className="max-h-56 overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed">
          {ev.sourceId && !data && <p className="text-muted-foreground">Loading…</p>}
          {!ev.sourceId && <p className="text-muted-foreground">Source text no longer available.</p>}
          {data?.lines.map((l) => (
            <div key={l.n} className={cn('flex gap-2', l.n === ev.line && 'text-foreground')}>
              <span className="w-8 shrink-0 select-none text-right text-muted-foreground/60">{l.n}</span>
              <span className={cn('whitespace-pre-wrap', l.n !== ev.line && 'text-muted-foreground')}>{l.n === ev.line ? <Highlight text={l.text} quote={ev.quote} /> : l.text}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-border/50 px-3 py-1.5 text-[11px] italic text-muted-foreground">“{ev.quote}”</div>
      </PopoverContent>
    </Popover>
  )
}

function Highlight({ text, quote }: { text: string; quote: string }) {
  const i = text.toLowerCase().indexOf(quote.toLowerCase())
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-presales/25 px-0.5 text-foreground">{text.slice(i, i + quote.length)}</mark>
      {text.slice(i + quote.length)}
    </>
  )
}
