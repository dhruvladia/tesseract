import { format } from 'date-fns'
import { Field, MemberPicker, daysSince } from '@/components/common'
import { Textarea } from '@/components/ui/textarea'
import { Milestones, OutcomeContract } from './outcome-contract'
import { useUpdateEngagement, type EngagementDetail } from '@/lib/queries'

export function OverviewTab({ e }: { e: EngagementDetail }) {
  const update = useUpdateEngagement(e.id)
  const save = (patch: Parameters<typeof update.mutate>[0]) => update.mutate(patch)

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <Field label="Decision this engagement unlocks" hint="Name the decision, not the deliverable.">
          <Textarea
            key={`d-${e.updatedAt}`}
            defaultValue={e.decision ?? ''}
            rows={2}
            placeholder="Does the customer sign? Does the pilot go to production? Does a second business unit adopt?"
            onBlur={(ev) => ev.target.value !== (e.decision ?? '') && save({ decision: ev.target.value || null })}
          />
        </Field>
        <Field label="Context">
          <Textarea
            key={`c-${e.updatedAt}`}
            defaultValue={e.description ?? ''}
            rows={6}
            placeholder="Problem statement, first workflow wedge, constraints, what was sold vs what actually happens…"
            onBlur={(ev) => ev.target.value !== (e.description ?? '') && save({ description: ev.target.value || null })}
          />
        </Field>
        <OutcomeContract e={e} />
        <Milestones e={e} />
      </div>

      <aside className="space-y-4">
        <div className="rounded-lg border border-border/50 p-3">
          <h3 className="mb-3 text-xs font-medium text-muted-foreground">Team</h3>
          <div className="space-y-3">
            <Field label="FDE (builds)">
              <MemberPicker value={e.fdeId} onChange={(v) => save({ fdeId: v })} filterRole={['fde']} />
            </Field>
            <Field label="Engagement manager (owns adoption)">
              <MemberPicker value={e.engagementManagerId} onChange={(v) => save({ engagementManagerId: v })} filterRole={['engagement_manager']} />
            </Field>
            <Field label="Account executive">
              <MemberPicker value={e.aeId} onChange={(v) => save({ aeId: v })} filterRole={['account_exec']} />
            </Field>
            <Field label="Customer success">
              <MemberPicker value={e.csmId} onChange={(v) => save({ csmId: v })} filterRole={['csm']} />
            </Field>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-y-2 rounded-lg border border-border/50 p-3 text-xs">
          <dt className="text-muted-foreground">In phase</dt>
          <dd className="tabular-nums">{daysSince(e.phaseEnteredAt)} days</dd>
          <dt className="text-muted-foreground">Started</dt>
          <dd>{format(new Date(e.createdAt), 'MMM d, yyyy')}</dd>
          <dt className="text-muted-foreground">Threads</dt>
          <dd className="tabular-nums">{e.threads.length}</dd>
          <dt className="text-muted-foreground">Gaps raised</dt>
          <dd className="tabular-nums">{e.gaps.length}</dd>
        </dl>
      </aside>
    </div>
  )
}
