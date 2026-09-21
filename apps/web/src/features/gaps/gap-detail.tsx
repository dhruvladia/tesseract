import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { GAP_IMPACTS, PHASE_LABELS, PRODUCT_GAP_STATUSES, type GapImpact, type ProductGapStatus } from '@tesseract/shared'
import { cn } from 'cn'
import { format } from 'date-fns'
import { ExternalLink, Layers, Trash2, X } from 'lucide-react'
import { GAP_STATUS_LABELS } from './gap-board'
import { IMPACT_LABELS } from './new-gap-dialog'
import { Field, SideDot, money } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { gapQuery, gapsQuery, useDeleteGap, useLinkGap, useUpdateGap } from '@/lib/queries-gaps'

const NONE = '__none__'

export function GapDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: g } = useQuery(gapQuery(id))
  const { data: all = [] } = useQuery(gapsQuery)
  const update = useUpdateGap()
  const del = useDeleteGap()
  const { update: updateLink, unlink } = useLinkGap(id)
  if (!g) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>

  const own = g.engagements.map((l) => ({ ...l, via: null as string | null }))
  const inherited = g.childLinks.map((l) => ({ engagementId: l.engagementId, impact: l.impact, arrInfluenced: l.arrInfluenced, via: g.children.find((c) => c.id === l.gapId)?.title ?? null, name: l.name, accountKey: l.accountKey }))
  const total = [...own.map((l) => Number(l.arrInfluenced ?? 0)), ...inherited.map((l) => Number(l.arrInfluenced ?? 0))].reduce((a, b) => a + b, 0)
  const parents = all.filter((x) => x.id !== g.id && !x.parentId && x.status !== 'shipped')
  const save = (patch: Parameters<typeof update.mutate>[0]) => update.mutate(patch)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2 text-xs text-muted-foreground">
        <Link to="/gaps" search={{}} className="hover:text-foreground">
          Product gaps
        </Link>
        {g.parent && (
          <>
            <span>/</span>
            <Link to="/gaps" search={{ gap: g.parent.id }} className="inline-flex items-center gap-1 hover:text-foreground">
              <Layers className="size-3" /> {g.parent.title}
            </Link>
          </>
        )}
        <span className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-destructive"
            onClick={async () => {
              if (!confirm(`Delete gap "${g.title}"?`)) return
              await del.mutateAsync(g.id)
              onClose()
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </span>
      </div>

      <div className="flex-1 space-y-5 overflow-auto p-5">
        <Input
          key={`t-${g.updatedAt}`}
          defaultValue={g.title}
          className="h-auto border-0 bg-transparent px-0 text-lg font-semibold tracking-tight shadow-none focus-visible:ring-0"
          onBlur={(e) => e.target.value.trim() && e.target.value !== g.title && save({ id: g.id, title: e.target.value.trim() })}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Select value={g.status} onValueChange={(v) => save({ id: g.id, status: v as ProductGapStatus })}>
            <SelectTrigger className="h-8 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_GAP_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {GAP_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {g.children.length === 0 && (
            <Select value={g.parentId ?? NONE} onValueChange={(v) => save({ id: g.id, parentId: v === NONE ? null : v })}>
              <SelectTrigger className="h-8 w-56">
                <SelectValue placeholder="Cluster under…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>
                  <span className="text-muted-foreground">Not clustered</span>
                </SelectItem>
                {parents.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {g.shippedAt && <span className="text-xs text-presales">Shipped {format(new Date(g.shippedAt), 'MMM d, yyyy')}</span>}
        </div>

        <Field label="Context">
          <Textarea
            key={`d-${g.updatedAt}`}
            defaultValue={g.description ?? ''}
            rows={4}
            placeholder="The underlying job to be done, why the current product cannot do it, what a generalizable version looks like."
            onBlur={(e) => e.target.value !== (g.description ?? '') && save({ id: g.id, description: e.target.value || null })}
          />
        </Field>

        <Field label="Core engineering tracker link" hint="Where product tracks the fix (Linear, Jira, GitHub).">
          <div className="flex items-center gap-2">
            <Input
              key={`u-${g.updatedAt}`}
              defaultValue={g.linkedIssueUrl ?? ''}
              placeholder="https://linear.app/…"
              className="h-8"
              onBlur={(e) => e.target.value !== (g.linkedIssueUrl ?? '') && save({ id: g.id, linkedIssueUrl: e.target.value })}
            />
            {g.linkedIssueUrl && (
              <a href={g.linkedIssueUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                <ExternalLink className="size-4" />
              </a>
            )}
          </div>
        </Field>

        <section>
          <div className="mb-1.5 flex items-baseline justify-between">
            <h3 className="text-xs font-medium text-muted-foreground">
              Engagements hitting this gap <span className="ml-1">({own.length + inherited.length})</span>
            </h3>
            {total > 0 && <span className="text-xs tabular-nums text-muted-foreground">{money(total)} ARR influenced</span>}
          </div>
          {own.length + inherited.length === 0 && <p className="text-xs text-muted-foreground">Not linked to any engagement yet. Raise it from an engagement's Signals tab.</p>}
          <ul className="divide-y divide-border/40 rounded-md border border-border/50">
            {own.map((l) => (
              <li key={l.engagementId} className="group flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <SideDot side={l.engagement.side} />
                <Link to="/engagements/$id" params={{ id: l.engagementId }} search={{ tab: 'signals' }} className="flex-1 truncate hover:underline">
                  <span className="mr-1.5 font-mono text-xs text-muted-foreground">{l.engagement.account.key}</span>
                  {l.engagement.name}
                  <span className="ml-2 text-[11px] text-muted-foreground">{PHASE_LABELS[l.engagement.phase]}</span>
                </Link>
                <Select value={l.impact} onValueChange={(v) => updateLink.mutate({ eid: l.engagementId, impact: v as GapImpact })}>
                  <SelectTrigger className={cn('h-7 w-44 text-xs', l.impact === 'blocker' && 'border-destructive/40 text-destructive')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GAP_IMPACTS.map((i) => (
                      <SelectItem key={i} value={i}>
                        {IMPACT_LABELS[i]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  defaultValue={l.arrInfluenced ?? ''}
                  placeholder="ARR"
                  className="h-7 w-28 text-xs"
                  onBlur={(e) => e.target.value !== (l.arrInfluenced ?? '') && updateLink.mutate({ eid: l.engagementId, arrInfluenced: e.target.value || null })}
                />
                <button type="button" className="opacity-0 group-hover:opacity-100" onClick={() => unlink.mutate(l.engagementId)} title="Unlink">
                  <X className="size-3.5 text-muted-foreground hover:text-destructive" />
                </button>
                {l.note && <p className="w-full pl-5 text-xs text-muted-foreground">{l.note}</p>}
              </li>
            ))}
            {inherited.map((l) => (
              <li key={`${l.via}-${l.engagementId}`} className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                <Layers className="size-3" />
                <Link to="/engagements/$id" params={{ id: l.engagementId }} search={{ tab: 'signals' }} className="flex-1 truncate hover:underline">
                  <span className="mr-1.5 font-mono text-xs">{l.accountKey}</span>
                  {l.name}
                </Link>
                <span className="text-[11px]">via {l.via}</span>
                <span className="text-[11px]">{IMPACT_LABELS[l.impact]}</span>
                <span className="w-28 text-right text-xs tabular-nums">{money(l.arrInfluenced) ?? ''}</span>
              </li>
            ))}
          </ul>
        </section>

        {g.children.length > 0 && (
          <section>
            <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">Clustered gaps ({g.children.length})</h3>
            <ul className="divide-y divide-border/40 rounded-md border border-border/50">
              {g.children.map((c) => (
                <li key={c.id}>
                  <Link to="/gaps" search={{ gap: c.id }} className="row-hover flex items-center gap-2 px-3 py-1.5 text-sm">
                    <span className="flex-1 truncate">{c.title}</span>
                    <span className="text-[11px] text-muted-foreground">{GAP_STATUS_LABELS[c.status]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
