import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { PHASE_LABELS, type HandoffKind } from '@tesseract/shared'
import { cn } from 'cn'
import type { ReactNode } from 'react'
import { PageHeader, SideDot } from '@/components/common'
import { handoffMetricsQuery, type HandoffMetricRow } from '@/lib/queries-metrics'

export const Route = createFileRoute('/_app/metrics')({
  loader: ({ context }) => context.queryClient.ensureQueryData(handoffMetricsQuery),
  component: MetricsPage,
})

const fmtHours = (h: number | null) => (h == null ? '—' : h < 48 ? `${Math.round(h)}h` : `${(h / 24).toFixed(1)}d`)
const fmtDays = (d: number | null) => (d == null ? '—' : `${d}d`)

function MetricsPage() {
  const { data } = useQuery(handoffMetricsQuery)
  if (!data) return null
  const a = data.aggregates
  const withHandoffs = data.rows.filter((r) => Object.keys(r.handoffs).length > 0 || r.techWinToKickoffDays != null || r.timeToFirstValueDays != null)

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Metrics" subtitle="Is the handoff gate respected, and does it pay off after kickoff?" />
      <div className="space-y-6 overflow-auto p-5">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Handoffs accepted" value={`${a.accepted} / ${a.handoffs}`} hint="Records that reached acceptance" />
          <Stat label="Time to accept, pre → post" value={fmtHours(a.medianHoursToAcceptPreToPost)} hint="Median, record created to accepted" />
          <Stat label="Time to accept, post → CS" value={fmtHours(a.medianHoursToAcceptPostToCs)} hint="Median" />
          <Stat label="Technical win → kickoff" value={fmtDays(a.medianTechWinToKickoffDays)} hint="Median days across the seam" />
          <Stat label="Time to first value" value={fmtDays(a.medianTimeToFirstValueDays)} hint="Kickoff to first verified outcome, median" />
          <Stat
            label="Reopened after acceptance"
            value={String(a.reopens)}
            hint="Acceptances that had to be undone"
            tone={a.reopens > 0 ? 'warn' : undefined}
          />
          <Stat
            label="Gaps found after acceptance"
            value={String(a.gapsAddedAfterAcceptance)}
            hint="Clarification loops the handoff should have caught"
            tone={a.gapsAddedAfterAcceptance > 0 ? 'warn' : undefined}
          />
          <Stat
            label="Accepted mostly unread"
            value={String(a.acceptedMostlyNotDiscussed)}
            hint="Accepted with 5+ of 8 sections still not discussed"
            tone={a.acceptedMostlyNotDiscussed > 0 ? 'warn' : undefined}
          />
          <Stat
            label="Thin confirmations"
            value={`${a.thinConfirmations}`}
            hint={`Sections confirmed with almost no notes at acceptance · ${a.acceptedWithThinConfirmations} handoff${a.acceptedWithThinConfirmations === 1 ? '' : 's'}`}
            tone={a.thinConfirmations > 0 ? 'warn' : undefined}
          />
        </section>

        {a.draftItemsProposed > 0 && (
          <p className="text-xs text-muted-foreground">
            AI drafts: {a.draftItemsApplied} of {a.draftItemsProposed} proposed items were applied by a person.
          </p>
        )}

        <section>
          <h2 className="mb-2 text-xs font-medium text-muted-foreground">Per engagement</h2>
          {withHandoffs.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
              Nothing to measure yet. Numbers appear once engagements change phase and handoff records are written.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/50">
              <table className="w-full text-sm">
                <thead className="text-[11px] text-muted-foreground">
                  <tr className="border-b border-border/50 [&>th]:px-3 [&>th]:py-1.5 [&>th]:text-left [&>th]:font-medium">
                    <th>Engagement</th>
                    <th>Phase</th>
                    <th>Pre → Post</th>
                    <th>Post → CS</th>
                    <th className="text-right">TW → kickoff</th>
                    <th className="text-right">First value</th>
                    <th className="text-right">Reopens</th>
                    <th className="text-right">Late gaps</th>
                    <th className="text-right">Thin</th>
                    <th className="text-right">Unread</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {withHandoffs.map((r) => (
                    <Row key={r.engagementId} r={r} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
          How to read this: a fast acceptance with many thin confirmations and late gaps means the gate was clicked through, not used. A slow acceptance
          with zero late gaps means the receiving team did the work up front. Compare the two before deciding whether to loosen or tighten the checklist.
        </p>
      </div>
    </div>
  )
}

function Row({ r }: { r: HandoffMetricRow }) {
  const sum = (f: (k: HandoffKind) => number) => (['pre_to_post', 'post_to_cs'] as HandoffKind[]).reduce((n, k) => n + (r.handoffs[k] ? f(k) : 0), 0)
  const reopens = sum((k) => r.handoffs[k]!.reopens)
  const late = sum((k) => r.handoffs[k]!.gapsAddedAfterAcceptance)
  const thin = sum((k) => r.handoffs[k]!.thinConfirmations ?? 0)
  const unread = sum((k) => r.handoffs[k]!.notDiscussedAtAcceptance ?? 0)
  return (
    <tr className="[&>td]:px-3 [&>td]:py-2">
      <td>
        <Link to="/engagements/$id" params={{ id: r.engagementId }} search={{ tab: 'handoffs' }} className="flex items-center gap-2 hover:underline">
          <SideDot side={r.side} />
          <span className="font-mono text-[11px] text-muted-foreground">{r.accountKey}</span>
          <span className="font-medium">{r.name}</span>
        </Link>
      </td>
      <td className="text-xs text-muted-foreground">{PHASE_LABELS[r.phase]}</td>
      <td>
        <HandoffCell h={r.handoffs.pre_to_post} />
      </td>
      <td>
        <HandoffCell h={r.handoffs.post_to_cs} />
      </td>
      <td className="text-right tabular-nums">{fmtDays(r.techWinToKickoffDays)}</td>
      <td className="text-right tabular-nums">{fmtDays(r.timeToFirstValueDays)}</td>
      <td className={cn('text-right tabular-nums', reopens > 0 && 'text-postsales')}>{reopens || '—'}</td>
      <td className={cn('text-right tabular-nums', late > 0 && 'text-postsales')}>{late || '—'}</td>
      <td className={cn('text-right tabular-nums', thin > 0 && 'text-postsales')}>{thin || '—'}</td>
      <td className={cn('text-right tabular-nums', unread >= 5 && 'text-postsales')}>{unread || '—'}</td>
    </tr>
  )
}

function HandoffCell({ h }: { h: HandoffMetricRow['handoffs'][HandoffKind] }) {
  if (!h) return <span className="text-xs text-muted-foreground/60">—</span>
  if (!h.acceptedAt) return <span className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground">draft</span>
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-presales/40 px-2 py-0.5 text-[11px] text-presales">
      accepted <span className="tabular-nums text-muted-foreground">in {fmtHours(h.hoursToAccept)}</span>
    </span>
  )
}

function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: 'warn' }) {
  return (
    <div className={cn('rounded-xl border border-border/50 bg-card/40 p-4', tone === 'warn' && 'border-postsales/30')}>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn('mt-1 text-2xl font-semibold tabular-nums tracking-tight', tone === 'warn' && 'text-postsales')}>{value}</div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground/80">{hint}</div>}
    </div>
  )
}
