import {
  GAP_SEVERITIES,
  HANDOFF_SECTION_KEYS,
  HANDOFF_SECTION_LABELS,
  HANDOFF_SECTION_STATES,
  STAKEHOLDER_ROLES,
  type HandoffDraftApply,
  type HandoffKind,
  type HandoffSectionKey,
  type HandoffSectionState,
} from '@tesseract/shared'
import { cn } from 'cn'
import { format } from 'date-fns'
import { Check, ShieldAlert, Sparkles, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { EvidenceChips } from './evidence'
import { ROLE_LABELS } from '@/features/accounts/stakeholder-map'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useDrafts, type PendingDraft } from '@/lib/queries-drafts'

type P = PendingDraft['proposal']
type Sel = { sections: Set<HandoffSectionKey>; stakeholders: Set<number>; outcomes: Set<number>; commitments: Set<number>; gaps: Set<number> }

const STATE_LABEL: Record<HandoffSectionState, string> = { confirmed: 'Confirmed', unclear: 'Unclear', not_discussed: 'Not discussed' }

/**
 * The review step. The model proposed; a person picks, edits, and applies. Unverified items start
 * unchecked and stay visibly flagged. Whatever leaves this panel is the reviewer's, not the model's.
 */
export function HandoffDraftReview({ engagementId, kind, draft, locked }: { engagementId: string; kind: HandoffKind; draft: PendingDraft; locked: boolean }) {
  const { apply, dismiss } = useDrafts(engagementId, kind)
  const [p, setP] = useState<P>(draft.proposal)
  const proposedSections = HANDOFF_SECTION_KEYS.filter((k) => p.sections[k].state !== 'not_discussed')
  const [sel, setSel] = useState<Sel>(() => ({
    sections: new Set(proposedSections.filter((k) => p.sections[k].verified)),
    stakeholders: new Set(p.stakeholders.map((s, i) => (s.verified ? i : -1)).filter((i) => i >= 0)),
    outcomes: new Set(p.outcomes.map((s, i) => (s.verified ? i : -1)).filter((i) => i >= 0)),
    commitments: new Set(p.commitments.map((s, i) => (s.verified ? i : -1)).filter((i) => i >= 0)),
    gaps: new Set(p.gaps.map((s, i) => (s.verified ? i : -1)).filter((i) => i >= 0)),
  }))
  const count = sel.sections.size + sel.stakeholders.size + sel.outcomes.size + sel.commitments.size + sel.gaps.size
  const uncovered = useMemo(() => HANDOFF_SECTION_KEYS.filter((k) => p.sections[k].state === 'not_discussed'), [p])

  const toggle = <K extends keyof Sel>(group: K, key: Sel[K] extends Set<infer T> ? T : never) =>
    setSel((s) => {
      const next = new Set(s[group] as Set<unknown>)
      next.has(key) ? next.delete(key) : next.add(key)
      return { ...s, [group]: next }
    })
  const edit = <K extends 'stakeholders' | 'outcomes' | 'commitments' | 'gaps'>(group: K, i: number, patch: Partial<P[K][number]>) =>
    setP((prev) => ({ ...prev, [group]: prev[group].map((x, j) => (j === i ? { ...x, ...patch } : x)) }))
  const editSection = (k: HandoffSectionKey, patch: Partial<P['sections'][HandoffSectionKey]>) =>
    setP((prev) => ({ ...prev, sections: { ...prev.sections, [k]: { ...prev.sections[k], ...patch } } }))

  function onApply() {
    const body: HandoffDraftApply = {
      sections: Object.fromEntries([...sel.sections].map((k) => [k, { state: p.sections[k].state, notes: p.sections[k].notes, evidence: p.sections[k].evidence }])),
      stakeholders: [...sel.stakeholders].map((i) => ({ name: p.stakeholders[i]!.name, title: p.stakeholders[i]!.title, role: p.stakeholders[i]!.role, evidence: p.stakeholders[i]!.evidence })),
      outcomes: [...sel.outcomes].map((i) => {
        const o = p.outcomes[i]!
        return { metric: o.metric, unit: o.unit, baseline: o.baseline, target: o.target, direction: o.direction, evidence: o.evidence }
      }),
      commitments: [...sel.commitments].map((i) => ({ title: p.commitments[i]!.title, targetDate: p.commitments[i]!.targetDate, evidence: p.commitments[i]!.evidence })),
      gaps: [...sel.gaps].map((i) => ({ title: p.gaps[i]!.title, severity: p.gaps[i]!.severity, evidence: p.gaps[i]!.evidence })),
    }
    apply.mutate({ draftId: draft.id, ...body })
  }

  return (
    <section className="rounded-xl border border-primary/30 bg-primary/[0.03]">
      <header className="flex flex-wrap items-center gap-3 border-b border-primary/20 px-4 py-2.5">
        <Sparkles className="size-4 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">
            Draft from “{draft.source?.label ?? 'notes'}”
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {draft.proposal.stats.verified} of {draft.proposal.stats.proposed} items backed by the notes · {draft.model} · {format(new Date(draft.createdAt), 'MMM d, HH:mm')}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Review, edit, untick what is wrong, then apply. Unticked items are discarded. Flagged items had no verbatim quote in the notes.</p>
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => dismiss.mutate(draft.id)} disabled={dismiss.isPending}>
          <X className="size-3.5" /> Dismiss
        </Button>
        <Button size="sm" className="h-7 text-xs" onClick={onApply} disabled={count === 0 || apply.isPending || locked} title={locked ? 'Reopen the handoff to apply a draft' : undefined}>
          <Check className="size-3.5" /> Apply {count} selected
        </Button>
      </header>

      <div className="divide-y divide-border/40">
        <Group title="Sections" count={proposedSections.length}>
          {proposedSections.map((k) => {
            const s = p.sections[k]
            return (
              <Row key={k} checked={sel.sections.has(k)} onToggle={() => toggle('sections', k)} verified={s.verified}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium">{HANDOFF_SECTION_LABELS[k]}</span>
                  <Select value={s.state} onValueChange={(v) => editSection(k, { state: v as HandoffSectionState })}>
                    <SelectTrigger className="h-6 w-32 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HANDOFF_SECTION_STATES.map((st) => (
                        <SelectItem key={st} value={st}>
                          {STATE_LABEL[st]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <EvidenceChips engagementId={engagementId} evidence={s.evidence} />
                </div>
                <Textarea value={s.notes} onChange={(e) => editSection(k, { notes: e.target.value })} rows={2} className="mt-1.5 resize-none border-border/40 bg-transparent text-xs" />
              </Row>
            )
          })}
          {uncovered.length > 0 && (
            <p className="px-4 py-2 text-[11px] text-muted-foreground">
              Not covered by these notes: {uncovered.map((k) => HANDOFF_SECTION_LABELS[k]).join(', ')}. They stay as they are.
            </p>
          )}
        </Group>

        <Group title="Stakeholders" count={p.stakeholders.length}>
          {p.stakeholders.map((s, i) => (
            <Row key={i} checked={sel.stakeholders.has(i)} onToggle={() => toggle('stakeholders', i)} verified={s.verified}>
              <div className="flex flex-wrap items-center gap-2">
                <Input value={s.name} onChange={(e) => edit('stakeholders', i, { name: e.target.value })} className="h-7 w-44 text-xs" />
                <Input value={s.title ?? ''} onChange={(e) => edit('stakeholders', i, { title: e.target.value || null })} placeholder="Title" className="h-7 w-44 text-xs" />
                <Select value={s.role} onValueChange={(v) => edit('stakeholders', i, { role: v as (typeof STAKEHOLDER_ROLES)[number] })}>
                  <SelectTrigger className="h-7 w-40 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAKEHOLDER_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <EvidenceChips engagementId={engagementId} evidence={s.evidence} />
              </div>
            </Row>
          ))}
        </Group>

        <Group title="Outcome metrics" count={p.outcomes.length}>
          {p.outcomes.map((o, i) => (
            <Row key={i} checked={sel.outcomes.has(i)} onToggle={() => toggle('outcomes', i)} verified={o.verified}>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Input value={o.metric} onChange={(e) => edit('outcomes', i, { metric: e.target.value })} className="h-7 w-64 text-xs" />
                <span className="font-mono tabular-nums text-muted-foreground">
                  {o.baseline ?? '?'} → {o.target ?? '?'} {o.unit ?? ''} ({o.direction === 'up' ? 'higher is better' : 'lower is better'})
                </span>
                <EvidenceChips engagementId={engagementId} evidence={o.evidence} />
              </div>
            </Row>
          ))}
        </Group>

        <Group title="Commitments (become milestones)" count={p.commitments.length}>
          {p.commitments.map((m, i) => (
            <Row key={i} checked={sel.commitments.has(i)} onToggle={() => toggle('commitments', i)} verified={m.verified}>
              <div className="flex flex-wrap items-center gap-2">
                <Input value={m.title} onChange={(e) => edit('commitments', i, { title: e.target.value })} className="h-7 min-w-[260px] flex-1 text-xs" />
                <Input type="date" value={m.targetDate ?? ''} onChange={(e) => edit('commitments', i, { targetDate: e.target.value || null })} className="h-7 w-36 text-xs [color-scheme:dark]" />
                <EvidenceChips engagementId={engagementId} evidence={m.evidence} />
              </div>
            </Row>
          ))}
        </Group>

        <Group title="Gaps and open questions" count={p.gaps.length}>
          {p.gaps.map((g, i) => (
            <Row key={i} checked={sel.gaps.has(i)} onToggle={() => toggle('gaps', i)} verified={g.verified}>
              <div className="flex flex-wrap items-center gap-2">
                <Input value={g.title} onChange={(e) => edit('gaps', i, { title: e.target.value })} className="h-7 min-w-[260px] flex-1 text-xs" />
                <Select value={g.severity} onValueChange={(v) => edit('gaps', i, { severity: v as (typeof GAP_SEVERITIES)[number] })}>
                  <SelectTrigger className={cn('h-7 w-28 text-xs', g.severity === 'blocking' && 'border-destructive/50 text-destructive')}>
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
                <EvidenceChips engagementId={engagementId} evidence={g.evidence} />
              </div>
            </Row>
          ))}
        </Group>
      </div>
    </section>
  )
}

function Group({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  if (count === 0) return null
  return (
    <div>
      <h3 className="px-4 pt-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {title} <span className="ml-1 normal-case tracking-normal">({count})</span>
      </h3>
      <div className="divide-y divide-border/30">{children}</div>
    </div>
  )
}

function Row({ checked, onToggle, verified, children }: { checked: boolean; onToggle: () => void; verified: boolean; children: ReactNode }) {
  return (
    <div className={cn('flex items-start gap-3 px-4 py-2.5', !checked && 'opacity-70')}>
      <Checkbox checked={checked} onCheckedChange={onToggle} className="mt-1" />
      <div className="min-w-0 flex-1">
        {!verified && (
          <span className="mb-1 inline-flex items-center gap-1 rounded-full border border-destructive/40 px-1.5 py-px text-[10px] text-destructive">
            <ShieldAlert className="size-2.5" /> No verbatim quote in the notes; check before applying
          </span>
        )}
        {children}
      </div>
    </div>
  )
}
