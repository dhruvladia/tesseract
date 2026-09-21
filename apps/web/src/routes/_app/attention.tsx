import { Link, createFileRoute } from '@tanstack/react-router'
import { cn } from 'cn'
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Clock, HelpCircle, Sparkles, UserX, Users } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, PageHeader, SideDot, UserAvatar } from '@/components/common'
import { Button } from '@/components/ui/button'
import { attentionQuery, useMyAttention, type AttentionItem } from '@/lib/queries-attention'

export const Route = createFileRoute('/_app/attention')({
  loader: ({ context }) => context.queryClient.ensureQueryData(attentionQuery),
  component: AttentionPage,
})

const KIND_META: Record<AttentionItem['kind'], { label: string; icon: typeof Clock }> = {
  handoff_ready: { label: 'Handoffs ready to accept', icon: CheckCircle2 },
  handoff_blocked: { label: 'Handoffs blocked', icon: AlertTriangle },
  handoff_missing: { label: 'Handoffs not started', icon: HelpCircle },
  gap_unowned: { label: 'Gaps without an owner', icon: UserX },
  missing_owner: { label: 'Missing owners', icon: UserX },
  missing_stakeholders: { label: 'Missing stakeholders', icon: Users },
  stale_engagement: { label: 'Stale engagements', icon: Clock },
  milestone_overdue: { label: 'Overdue milestones', icon: CalendarClock },
  issue_overdue: { label: 'Overdue issues', icon: CalendarClock },
  no_first_value: { label: 'First value not verified', icon: Sparkles },
}
const ORDER = Object.keys(KIND_META) as AttentionItem['kind'][]

function AttentionPage() {
  const { all, mine } = useMyAttention()
  const [scope, setScope] = useState<'mine' | 'all'>(mine.length > 0 ? 'mine' : 'all')
  const items = scope === 'mine' ? mine : all
  const groups = ORDER.map((k) => [k, items.filter((i) => i.kind === k)] as const).filter(([, list]) => list.length > 0)

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Attention"
        subtitle="What needs a person today, computed from the data you already keep"
        actions={
          <div className="flex rounded-md border border-border/60 p-0.5 text-xs">
            {(['mine', 'all'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={cn('rounded px-2.5 py-1 capitalize transition', scope === s ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                {s} <span className="tabular-nums opacity-70">{s === 'mine' ? mine.length : all.length}</span>
              </button>
            ))}
          </div>
        }
      />
      {items.length === 0 ? (
        <EmptyState
          preset="aurora"
          title={scope === 'mine' ? 'Nothing routed to you' : 'Nothing needs attention'}
          description={
            scope === 'mine'
              ? 'Handoffs waiting on you, gaps you own, overdue work assigned to you, and stale engagements you lead will show up here.'
              : 'Stale engagements, missing owners or stakeholders, handoffs waiting for acceptance, blocking gaps, and overdue work all show up here.'
          }
          action={
            scope === 'mine' && all.length > 0 ? (
              <Button size="sm" variant="outline" onClick={() => setScope('all')}>
                Show everyone's ({all.length})
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex-1 overflow-auto">
          {groups.map(([kind, list]) => {
            const meta = KIND_META[kind]
            return (
              <section key={kind}>
                <header className="sticky top-0 z-10 flex items-center gap-2 border-y border-border/40 bg-background/95 px-5 py-1.5 text-xs backdrop-blur">
                  <meta.icon className="size-3.5 text-muted-foreground" />
                  <span className="font-medium">{meta.label}</span>
                  <span className="text-muted-foreground">{list.length}</span>
                </header>
                {list.map((i, idx) => (
                  <Link
                    key={`${i.kind}-${i.engagementId}-${idx}`}
                    to="/engagements/$id"
                    params={{ id: i.engagementId }}
                    search={{ tab: i.tab, ...(i.issueId ? { issue: i.issueId } : {}) }}
                    className="row-hover group flex items-start gap-3 px-5 py-2 text-sm"
                  >
                    <span
                      className={cn(
                        'mt-1.5 size-2 shrink-0 rounded-full',
                        i.severity === 'high' ? 'bg-destructive' : i.severity === 'medium' ? 'bg-postsales' : 'bg-muted-foreground/50',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2">
                        <span className="font-medium">{i.title}</span>
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <SideDot side={i.side} />
                          <span className="font-mono">{i.accountKey}</span> {i.engagementName}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{i.detail}</p>
                    </div>
                    <UserAvatar userId={i.ownerId} className="mt-0.5 size-5" />
                    <ArrowRight className="mt-1 size-3.5 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                  </Link>
                ))}
              </section>
            )
          })}
          <p className="px-5 py-4 text-[11px] text-muted-foreground">Recomputed on every load; nothing here is stored. Stale means 21 days in one phase.</p>
        </div>
      )}
    </div>
  )
}
