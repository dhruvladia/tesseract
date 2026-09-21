import { MILESTONE_KINDS, type MilestoneKind } from '@tesseract/shared'
import { cn } from 'cn'
import { format, isPast } from 'date-fns'
import { ArrowDown, ArrowUp, Check, Flag, Plus, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { Field } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { EngagementDetail } from '@/lib/queries'
import { useMilestones, useOutcomes } from '@/lib/queries-engagement-extras'

const fmt = (v: string | null) => (v == null ? '—' : Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 }))

/** Baseline -> current -> target per metric; the anchor every FDE playbook insists on. */
export function OutcomeContract({ e }: { e: EngagementDetail }) {
  const { create, update, remove } = useOutcomes(e.id)
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground">Outcome contract</h3>
        <OutcomeDialog onSubmit={(v) => create.mutate(v)} />
      </div>
      {e.outcomes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
          Name the operational metric this engagement must move, its baseline, and the target. Time-to-first-value starts the moment the first verified
          benefit lands.
        </p>
      ) : (
        <ul className="space-y-2">
          {e.outcomes.map((o) => {
            const b = o.baseline ? Number(o.baseline) : null
            const t = o.target ? Number(o.target) : null
            const cur = o.current ? Number(o.current) : null
            const pct = b != null && t != null && cur != null && t !== b ? Math.max(0, Math.min(1, (cur - b) / (t - b))) : null
            return (
              <li key={o.id} className="group rounded-lg border border-border/50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                      {o.direction === 'up' ? <ArrowUp className="size-3.5 text-presales" /> : <ArrowDown className="size-3.5 text-presales" />}
                      {o.metric}
                      {o.unit && <span className="text-xs text-muted-foreground">({o.unit})</span>}
                    </div>
                    <div className="mt-1 flex items-center gap-3 font-mono text-xs tabular-nums text-muted-foreground">
                      <span title="Baseline">{fmt(o.baseline)}</span>
                      <span>→</span>
                      <span className="text-foreground" title="Current">
                        {fmt(o.current)}
                      </span>
                      <span>→</span>
                      <span title="Target">{fmt(o.target)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant={o.firstValueVerifiedAt ? 'secondary' : 'ghost'}
                      className={cn('h-7 text-xs', o.firstValueVerifiedAt && 'text-presales')}
                      title={o.firstValueVerifiedAt ? `First value verified ${format(new Date(o.firstValueVerifiedAt), 'MMM d')}` : 'Mark first verified value'}
                      onClick={() => update.mutate({ oid: o.id, firstValueVerifiedAt: o.firstValueVerifiedAt ? null : new Date().toISOString() })}
                    >
                      <Sparkles className="size-3.5" /> {o.firstValueVerifiedAt ? format(new Date(o.firstValueVerifiedAt), 'MMM d') : 'First value'}
                    </Button>
                    <OutcomeDialog
                      initial={o}
                      onSubmit={(v) => update.mutate({ oid: o.id, ...v })}
                      trigger={
                        <Button size="sm" variant="ghost" className="h-7 text-xs opacity-0 group-hover:opacity-100">
                          Edit
                        </Button>
                      }
                    />
                    <button type="button" className="opacity-0 group-hover:opacity-100" onClick={() => remove.mutate(o.id)} title="Remove">
                      <X className="size-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>
                {pct != null && (
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-presales transition-all" style={{ width: `${pct * 100}%` }} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

type OutcomeInput = { metric: string; unit: string | null; baseline: string | null; target: string | null; current: string | null; direction: 'up' | 'down' }

function OutcomeDialog({ initial, onSubmit, trigger }: { initial?: EngagementDetail['outcomes'][number]; onSubmit: (v: OutcomeInput) => void; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [direction, setDirection] = useState<'up' | 'down'>(initial?.direction ?? 'up')
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="ghost" className="h-7 text-xs">
            <Plus className="size-3.5" /> Add metric
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit metric' : 'Add outcome metric'}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(ev) => {
            ev.preventDefault()
            const f = new FormData(ev.currentTarget)
            const g = (k: string) => (String(f.get(k) ?? '').trim() ? String(f.get(k)).trim() : null)
            onSubmit({ metric: String(f.get('metric')), unit: g('unit'), baseline: g('baseline'), target: g('target'), current: g('current'), direction })
            setOpen(false)
          }}
        >
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <Field label="Metric">
              <Input name="metric" required autoFocus defaultValue={initial?.metric} placeholder="Claims triaged per adjuster per day" />
            </Field>
            <Field label="Unit">
              <Input name="unit" defaultValue={initial?.unit ?? ''} placeholder="claims/day" />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Baseline">
              <Input name="baseline" type="number" step="any" defaultValue={initial?.baseline ?? ''} />
            </Field>
            <Field label="Current">
              <Input name="current" type="number" step="any" defaultValue={initial?.current ?? ''} />
            </Field>
            <Field label="Target">
              <Input name="target" type="number" step="any" defaultValue={initial?.target ?? ''} />
            </Field>
          </div>
          <Field label="Good direction">
            <Select value={direction} onValueChange={(v) => setDirection(v as 'up' | 'down')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="up">Higher is better</SelectItem>
                <SelectItem value="down">Lower is better</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">{initial ? 'Save' : 'Add'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const KIND_LABELS: Record<MilestoneKind, string> = { kickoff: 'Kickoff', first_value: 'First value', production: 'Production', handoff: 'Handoff', custom: 'Custom' }

export function Milestones({ e }: { e: EngagementDetail }) {
  const { create, update, remove } = useMilestones(e.id)
  const [kind, setKind] = useState<MilestoneKind>('custom')
  const [adding, setAdding] = useState(false)
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground">Milestones</h3>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding((a) => !a)}>
          <Plus className="size-3.5" /> Add
        </Button>
      </div>
      {adding && (
        <form
          className="mb-2 flex items-end gap-2 rounded-lg border border-border/50 p-2"
          onSubmit={(ev) => {
            ev.preventDefault()
            const f = new FormData(ev.currentTarget)
            create.mutate({ kind, title: String(f.get('title')) || KIND_LABELS[kind], targetDate: String(f.get('date') || '') || null })
            setAdding(false)
          }}
        >
          <Select value={kind} onValueChange={(v) => setKind(v as MilestoneKind)}>
            <SelectTrigger className="h-8 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MILESTONE_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input name="title" className="h-8 flex-1" placeholder={kind === 'custom' ? 'Milestone' : KIND_LABELS[kind]} autoFocus />
          <Input name="date" type="date" className="h-8 w-36 [color-scheme:dark]" />
          <Button type="submit" size="sm" className="h-8">
            Add
          </Button>
        </form>
      )}
      {e.milestones.length === 0 && !adding && (
        <p className="rounded-lg border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
          Kickoff, first value, production, handoff. Dates make slippage visible on the board.
        </p>
      )}
      <ul className="space-y-1">
        {e.milestones.map((m) => {
          const late = m.targetDate && !m.completedAt && isPast(new Date(m.targetDate))
          return (
            <li key={m.id} className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/40">
              <button
                type="button"
                onClick={() => update.mutate({ mid: m.id, completedAt: m.completedAt ? null : new Date().toISOString() })}
                className={cn(
                  'grid size-4 place-items-center rounded-full border',
                  m.completedAt ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-foreground',
                )}
                title={m.completedAt ? 'Completed' : 'Mark complete'}
              >
                {m.completedAt ? <Check className="size-3" /> : <Flag className="size-2.5 opacity-0 group-hover:opacity-60" />}
              </button>
              <span className={cn('flex-1', m.completedAt && 'text-muted-foreground line-through')}>{m.title}</span>
              {m.kind !== 'custom' && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{KIND_LABELS[m.kind]}</span>}
              <span className={cn('text-xs tabular-nums', late ? 'text-destructive' : 'text-muted-foreground')}>
                {m.completedAt ? format(new Date(m.completedAt), 'MMM d') : m.targetDate ? format(new Date(m.targetDate), 'MMM d') : ''}
              </span>
              <button type="button" className="opacity-0 group-hover:opacity-100" onClick={() => remove.mutate(m.id)} title="Remove">
                <X className="size-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
