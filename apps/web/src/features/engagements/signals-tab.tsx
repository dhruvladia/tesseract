import { Link } from '@tanstack/react-router'
import { cn } from 'cn'
import { AlertTriangle, Sparkles } from 'lucide-react'
import { GAP_STATUS_LABELS } from '@/features/gaps/gap-board'
import { IMPACT_LABELS, NewGapDialog } from '@/features/gaps/new-gap-dialog'
import { money } from '@/components/common'
import type { EngagementDetail } from '@/lib/queries'

/** Product gaps raised on this engagement: the productization loop starts here. */
export function SignalsTab({ e }: { e: EngagementDetail }) {
  const total = e.gaps.reduce((n, l) => n + Number(l.arrInfluenced ?? 0), 0)
  return (
    <div className="max-w-3xl">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Field signals</h2>
          <p className="text-xs text-muted-foreground">
            What the product cannot do yet, as seen from this account. Aim for at least one generalizable capability shipped back per engagement.
          </p>
        </div>
        <NewGapDialog engagementId={e.id} />
      </div>
      {e.gaps.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
          <Sparkles className="mx-auto mb-2 size-5 opacity-60" />
          No gaps raised yet. When you hit a missing connector, primitive or workflow, raise it here and tie it to the revenue it blocks.
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border/40 rounded-lg border border-border/50">
            {e.gaps.map((l) => (
              <li key={l.gapId}>
                <Link to="/gaps" search={{ gap: l.gapId }} className="row-hover flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                  {l.impact === 'blocker' ? <AlertTriangle className="size-3.5 text-destructive" /> : <Sparkles className="size-3.5 text-muted-foreground" />}
                  <span className="flex-1 truncate font-medium">{l.gap.title}</span>
                  <span className={cn('text-[11px]', l.impact === 'blocker' ? 'text-destructive' : 'text-muted-foreground')}>{IMPACT_LABELS[l.impact]}</span>
                  <span className="w-24 text-right text-xs tabular-nums text-muted-foreground">{money(l.arrInfluenced) ?? ''}</span>
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[10px]',
                      l.gap.status === 'shipped' ? 'border-presales/40 text-presales' : l.gap.status === 'declined' ? 'border-border/40 text-muted-foreground' : 'border-border/60',
                    )}
                  >
                    {GAP_STATUS_LABELS[l.gap.status]}
                  </span>
                  {l.note && <p className="w-full pl-6 text-xs text-muted-foreground">{l.note}</p>}
                </Link>
              </li>
            ))}
          </ul>
          {total > 0 && <p className="mt-2 text-right text-xs text-muted-foreground">{money(total)} ARR influenced by gaps on this engagement</p>}
        </>
      )}
    </div>
  )
}
