import { useNavigate } from '@tanstack/react-router'
import type { IssueStatus } from '@tesseract/shared'
import { cn } from 'cn'
import { format, isPast } from 'date-fns'
import { CalendarDays } from 'lucide-react'
import { STATUS_LABELS, STATUS_ORDER, StatusIcon } from './icons'
import { AssigneePicker, LabelChip, PriorityPicker, StatusPicker } from './pickers'
import { useUpdateIssue, type IssueListItem } from '@/lib/queries-issues'

/** Dense, Linear-like list grouped by status. Click a row to peek; pickers edit inline. */
export function IssueList({ issues, showThread = false, emptyText = 'No issues.' }: { issues: IssueListItem[]; showThread?: boolean; emptyText?: string }) {
  if (issues.length === 0) return <p className="px-5 py-8 text-center text-sm text-muted-foreground">{emptyText}</p>
  return (
    <div>
      {STATUS_ORDER.map((status) => {
        const group = issues.filter((i) => i.status === status)
        if (group.length === 0) return null
        return (
          <section key={status}>
            <header className="sticky top-0 z-10 flex items-center gap-2 border-y border-border/40 bg-background/95 px-5 py-1.5 text-xs backdrop-blur">
              <StatusIcon status={status} />
              <span className="font-medium">{STATUS_LABELS[status]}</span>
              <span className="text-muted-foreground">{group.length}</span>
            </header>
            {group.map((i) => (
              <IssueRow key={i.id} issue={i} showThread={showThread} />
            ))}
          </section>
        )
      })}
    </div>
  )
}

function IssueRow({ issue: i, showThread }: { issue: IssueListItem; showThread: boolean }) {
  const navigate = useNavigate()
  const update = useUpdateIssue(i.id)
  const due = i.dueDate ? new Date(i.dueDate) : null
  const overdue = due && isPast(due) && i.status !== 'done' && i.status !== 'canceled'
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate({ to: '.', search: (prev) => ({ ...prev, issue: i.id }) })}
      onKeyDown={(e) => e.key === 'Enter' && navigate({ to: '.', search: (prev) => ({ ...prev, issue: i.id }) })}
      className="row-hover group flex h-9 cursor-default items-center gap-2 px-3 text-sm focus:outline-none focus-visible:bg-accent/60"
    >
      <PriorityPicker compact value={i.priority} onChange={(priority) => update.mutate({ priority })} />
      <span className="w-16 shrink-0 font-mono text-[11px] text-muted-foreground">{i.identifier}</span>
      <StatusPicker compact value={i.status as IssueStatus} onChange={(status) => update.mutate({ status })} />
      <span className={cn('min-w-0 flex-1 truncate', (i.status === 'done' || i.status === 'canceled') && 'text-muted-foreground')}>{i.title}</span>
      {showThread && i.thread && <span className="hidden truncate text-[11px] text-muted-foreground md:inline">{i.thread.name}</span>}
      <span className="hidden items-center gap-1 lg:flex">
        {i.labels.map((l) => (
          <LabelChip key={l.labelId} name={l.label.name} color={l.label.color} />
        ))}
      </span>
      {due && (
        <span className={cn('inline-flex items-center gap-1 text-[11px] tabular-nums', overdue ? 'text-destructive' : 'text-muted-foreground')}>
          <CalendarDays className="size-3" /> {format(due, 'MMM d')}
        </span>
      )}
      <AssigneePicker compact value={i.assigneeId} onChange={(assigneeId) => update.mutate({ assigneeId })} />
    </div>
  )
}
