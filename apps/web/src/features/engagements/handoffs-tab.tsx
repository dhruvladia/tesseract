import {
  GAP_SEVERITIES,
  HANDOFF_SECTION_KEYS,
  HANDOFF_SECTION_LABELS,
  HANDOFF_SECTION_PROMPTS,
  handoffComplete,
  type GapSeverity,
  type HandoffKind,
  type HandoffSectionKey,
  type HandoffSectionState,
} from '@tesseract/shared'
import { cn } from 'cn'
import { format } from 'date-fns'
import { Check, CheckCircle2, CircleDashed, HelpCircle, Lock, Plus, RotateCcw, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DraftFromNotesButton } from './draft-dialog'
import { EvidenceChips, type EvidenceRef } from './evidence'
import { HandoffDraftReview } from './handoff-draft-review'
import { MemberPicker, UserName } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { EngagementDetail } from '@/lib/queries'
import { useHandoff } from '@/lib/queries-engagement-extras'
import { pendingDraftQuery } from '@/lib/queries-drafts'

type Sections = Partial<Record<HandoffSectionKey, { state: HandoffSectionState; notes: string; evidence?: EvidenceRef[] }>>
type Gap = { id: string; title: string; severity: GapSeverity; ownerId: string | null; resolvedAt: string | null; evidence?: EvidenceRef[] }

const KIND_META: Record<HandoffKind, { title: string; from: string; to: string; unlocks: string }> = {
  pre_to_post: {
    title: 'Pre-sales → Post-sales',
    from: 'the pre-sales FDE and AE',
    to: 'the delivery team',
    unlocks: 'Converting Technical Win → Kickoff',
  },
  post_to_cs: {
    title: 'Post-sales → Customer Success',
    from: 'the FDE and engagement manager',
    to: 'customer success and the customer’s named owners',
    unlocks: 'Closing the engagement as Handed Off',
  },
}


export function HandoffsTab({ e }: { e: EngagementDetail }) {
  // Show the handoff that matters for where the engagement is, plus any existing one.
  const kinds: HandoffKind[] = e.side === 'presales' ? ['pre_to_post'] : ['post_to_cs', ...(e.handoffs.some((h) => h.kind === 'pre_to_post') ? (['pre_to_post'] as HandoffKind[]) : [])]
  return (
    <div className="grid max-w-5xl gap-6">
      {kinds.map((k) => (
        <HandoffCard key={k} e={e} kind={k} />
      ))}
    </div>
  )
}

function HandoffCard({ e, kind }: { e: EngagementDetail; kind: HandoffKind }) {
  const existing = e.handoffs.find((h) => h.kind === kind)
  const { save, accept, reopen } = useHandoff(e.id, kind)
  const [sections, setSections] = useState<Sections>((existing?.sections as Sections) ?? {})
  const [gaps, setGaps] = useState<Gap[]>((existing?.gaps as Gap[]) ?? [])
  const dirty = useRef(false)
  const meta = KIND_META[kind]
  const accepted = !!existing?.acceptedAt
  const { data: pending } = useQuery(pendingDraftQuery(e.id, kind))

  // A draft apply (or another tab) changes the record server-side; adopt it unless we have unsaved edits.
  useEffect(() => {
    if (dirty.current || !existing) return
    setSections((existing.sections as Sections) ?? {})
    setGaps((existing.gaps as Gap[]) ?? [])
  }, [existing?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps
  const complete = handoffComplete(existing ? { kind, acceptedAt: existing.acceptedAt, gaps: existing.gaps } : null)

  // Debounced autosave of the working draft.
  useEffect(() => {
    if (!dirty.current) return
    const t = setTimeout(() => {
      save.mutate({ sections, gaps })
      dirty.current = false
    }, 600)
    return () => clearTimeout(t)
  }, [sections, gaps]) // eslint-disable-line react-hooks/exhaustive-deps

  const marked = HANDOFF_SECTION_KEYS.filter((k) => sections[k]?.state).length
  const blocking = gaps.filter((g) => g.severity === 'blocking' && !g.resolvedAt).length
  const unowned = gaps.filter((g) => !g.resolvedAt && !g.ownerId).length
  const readiness = useMemo(
    () => [
      { ok: marked === 8, label: `All 8 sections marked (${marked}/8)` },
      { ok: blocking === 0, label: blocking ? `${blocking} blocking gap${blocking > 1 ? 's' : ''} unresolved` : 'No unresolved blocking gaps' },
      { ok: unowned === 0, label: unowned ? `${unowned} open gap${unowned > 1 ? 's' : ''} without an owner` : 'Every open gap has an owner' },
    ],
    [marked, blocking, unowned],
  )
  const ready = readiness.every((r) => r.ok)

  const setState = (k: HandoffSectionKey, state: HandoffSectionState) => {
    dirty.current = true
    setSections((s) => ({ ...s, [k]: { ...s[k], state, notes: s[k]?.notes ?? '' } }))
  }
  const setNotes = (k: HandoffSectionKey, notes: string) => {
    dirty.current = true
    setSections((s) => ({ ...s, [k]: { ...s[k], state: s[k]?.state ?? 'not_discussed', notes } }))
  }
  const updateGap = (id: string, patch: Partial<Gap>) => {
    dirty.current = true
    setGaps((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)))
  }

  return (
    <div className="space-y-3">
    {pending && <HandoffDraftReview key={pending.id} engagementId={e.id} kind={kind} draft={pending} locked={accepted} />}
    <section className={cn('rounded-xl border', accepted ? 'border-presales/40' : 'border-border/60')}>
      <header className="flex flex-wrap items-center gap-3 border-b border-border/50 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{meta.title}</h2>
          <p className="text-xs text-muted-foreground">
            Written by {meta.from} for {meta.to}. Unlocks: {meta.unlocks}.
          </p>
        </div>
        {!accepted && <DraftFromNotesButton engagementId={e.id} kind={kind} hasPending={!!pending} />}
        {accepted ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-presales/15 px-2.5 py-1 text-xs text-presales">
              <CheckCircle2 className="size-3.5" /> Accepted by <UserName userId={existing!.acceptedById} /> · {format(new Date(existing!.acceptedAt!), 'MMM d')}
            </span>
            {!complete && <span className="text-xs text-destructive">blocking gap reopened</span>}
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => reopen.mutate()}>
              <RotateCcw className="size-3.5" /> Reopen
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <ul className="hidden text-[11px] sm:block">
              {readiness.map((r) => (
                <li key={r.label} className={cn('flex items-center gap-1.5', r.ok ? 'text-muted-foreground' : 'text-postsales')}>
                  {r.ok ? <Check className="size-3" /> : <CircleDashed className="size-3" />} {r.label}
                </li>
              ))}
            </ul>
            <Button size="sm" disabled={!ready || !existing || accept.isPending} onClick={() => accept.mutate()} title={ready ? 'Accept handoff' : 'Complete the checklist first'}>
              {ready ? <Check className="size-3.5" /> : <Lock className="size-3.5" />} Accept handoff
            </Button>
          </div>
        )}
      </header>

      <div className="grid gap-px bg-border/40 lg:grid-cols-2">
        {HANDOFF_SECTION_KEYS.map((k) => {
          const s = sections[k]
          return (
            <div key={k} className="bg-background p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-xs font-medium">{HANDOFF_SECTION_LABELS[k]}</h3>
                  <p className="text-[11px] text-muted-foreground">{HANDOFF_SECTION_PROMPTS[k]}</p>
                </div>
                <TriState value={s?.state} onChange={(v) => setState(k, v)} disabled={accepted} />
              </div>
              <Textarea
                value={s?.notes ?? ''}
                onChange={(ev) => setNotes(k, ev.target.value)}
                disabled={accepted}
                rows={3}
                placeholder={s?.state === 'not_discussed' ? 'Not discussed yet.' : 'Notes, links, decisions…'}
                className="mt-2 resize-none border-border/40 bg-transparent text-xs"
              />
              <EvidenceChips engagementId={e.id} evidence={s?.evidence} className="mt-1.5" />
            </div>
          )
        })}
      </div>

      <div className="border-t border-border/50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-medium">
            Gap log <span className="text-muted-foreground">({gaps.filter((g) => !g.resolvedAt).length} open)</span>
          </h3>
          {!accepted && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => {
                dirty.current = true
                setGaps((gs) => [...gs, { id: crypto.randomUUID(), title: '', severity: 'medium', ownerId: null, resolvedAt: null }])
              }}
            >
              <Plus className="size-3.5" /> Add gap
            </Button>
          )}
        </div>
        {gaps.length === 0 && <p className="text-xs text-muted-foreground">Log what is unclear or missing. Blocking gaps must be resolved before acceptance; others need an owner.</p>}
        <ul className="space-y-1.5">
          {gaps.map((g) => (
            <li key={g.id} className={cn('flex flex-wrap items-center gap-2 rounded-md border border-border/40 p-1.5', g.resolvedAt && 'opacity-60')}>
              <button
                type="button"
                onClick={() => updateGap(g.id, { resolvedAt: g.resolvedAt ? null : new Date().toISOString() })}
                className={cn('grid size-4 shrink-0 place-items-center rounded-full border', g.resolvedAt ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}
                title={g.resolvedAt ? 'Resolved' : 'Mark resolved'}
              >
                {g.resolvedAt && <Check className="size-3" />}
              </button>
              <Input
                value={g.title}
                onChange={(ev) => updateGap(g.id, { title: ev.target.value })}
                placeholder="What is missing or unclear?"
                className="h-7 min-w-[200px] flex-1 border-0 bg-transparent px-1 text-xs shadow-none"
                disabled={accepted}
              />
              <Select value={g.severity} onValueChange={(v) => updateGap(g.id, { severity: v as GapSeverity })} disabled={accepted}>
                <SelectTrigger className={cn('h-7 w-28 text-xs', g.severity === 'blocking' && !g.resolvedAt && 'border-destructive/50 text-destructive')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GAP_SEVERITIES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <MemberPicker value={g.ownerId} onChange={(v) => updateGap(g.id, { ownerId: v })} placeholder="Owner" className="h-7 w-40 text-xs" />
              <EvidenceChips engagementId={e.id} evidence={g.evidence} />
              {!accepted && (
                <button
                  type="button"
                  onClick={() => {
                    dirty.current = true
                    setGaps((gs) => gs.filter((x) => x.id !== g.id))
                  }}
                  title="Remove"
                >
                  <X className="size-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
    </div>
  )
}

function TriState({ value, onChange, disabled }: { value?: HandoffSectionState; onChange: (v: HandoffSectionState) => void; disabled?: boolean }) {
  const opts: { v: HandoffSectionState; label: string; icon: typeof Check; tone: string }[] = [
    { v: 'confirmed', label: 'Confirmed', icon: Check, tone: 'data-[on=true]:bg-presales/20 data-[on=true]:text-presales' },
    { v: 'unclear', label: 'Unclear', icon: HelpCircle, tone: 'data-[on=true]:bg-postsales/20 data-[on=true]:text-postsales' },
    { v: 'not_discussed', label: 'Not discussed', icon: CircleDashed, tone: 'data-[on=true]:bg-muted data-[on=true]:text-foreground' },
  ]
  return (
    <div className="flex shrink-0 rounded-md border border-border/60 p-0.5" role="radiogroup">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          data-on={value === o.v}
          disabled={disabled}
          onClick={() => onChange(o.v)}
          title={o.label}
          className={cn('inline-flex h-6 items-center gap-1 rounded px-1.5 text-[10px] text-muted-foreground transition hover:text-foreground disabled:opacity-60', o.tone)}
        >
          <o.icon className="size-3" /> <span className="hidden xl:inline">{o.label}</span>
        </button>
      ))}
    </div>
  )
}
