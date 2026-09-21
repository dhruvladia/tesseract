import type { IssueStatus, Priority } from '@tesseract/shared'
import { cn } from 'cn'

export const STATUS_LABELS: Record<IssueStatus, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In progress',
  done: 'Done',
  canceled: 'Canceled',
}
export const PRIORITY_LABELS: Record<Priority, string> = { none: 'No priority', urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' }
export const STATUS_ORDER: IssueStatus[] = ['in_progress', 'todo', 'backlog', 'done', 'canceled']

/** Linear-style status glyphs: dashed circle, empty, half, filled check, crossed. */
export function StatusIcon({ status, className }: { status: IssueStatus; className?: string }) {
  const c = cn('size-3.5 shrink-0', className)
  switch (status) {
    case 'backlog':
      return (
        <svg viewBox="0 0 14 14" className={cn(c, 'text-muted-foreground/70')} fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="7" cy="7" r="5.5" strokeDasharray="2.2 2" />
        </svg>
      )
    case 'todo':
      return (
        <svg viewBox="0 0 14 14" className={cn(c, 'text-muted-foreground')} fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="7" cy="7" r="5.5" />
        </svg>
      )
    case 'in_progress':
      return (
        <svg viewBox="0 0 14 14" className={cn(c, 'text-postsales')} fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="7" cy="7" r="5.5" />
          <path d="M7 3.5 A3.5 3.5 0 0 1 7 10.5 Z" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'done':
      return (
        <svg viewBox="0 0 14 14" className={cn(c, 'text-primary')} fill="currentColor">
          <circle cx="7" cy="7" r="6" />
          <path d="M4.2 7.2 6.2 9.2 9.8 5.2" stroke="var(--background)" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'canceled':
      return (
        <svg viewBox="0 0 14 14" className={cn(c, 'text-muted-foreground/60')} fill="currentColor">
          <circle cx="7" cy="7" r="6" />
          <path d="M4.8 4.8 9.2 9.2 M9.2 4.8 4.8 9.2" stroke="var(--background)" strokeWidth="1.4" />
        </svg>
      )
  }
}

/** Signal-bar priority glyphs. */
export function PriorityIcon({ priority, className }: { priority: Priority; className?: string }) {
  const c = cn('size-3.5 shrink-0', className)
  if (priority === 'none')
    return (
      <svg viewBox="0 0 14 14" className={cn(c, 'text-muted-foreground/50')} fill="currentColor">
        <rect x="2" y="6.25" width="2" height="1.5" rx=".5" />
        <rect x="6" y="6.25" width="2" height="1.5" rx=".5" />
        <rect x="10" y="6.25" width="2" height="1.5" rx=".5" />
      </svg>
    )
  if (priority === 'urgent')
    return (
      <svg viewBox="0 0 14 14" className={cn(c, 'text-destructive')} fill="currentColor">
        <rect x="1" y="1" width="12" height="12" rx="2.5" />
        <path d="M7 3.5v4.2M7 10.3v.2" stroke="var(--background)" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  const bars = priority === 'high' ? 3 : priority === 'medium' ? 2 : 1
  return (
    <svg viewBox="0 0 14 14" className={cn(c, 'text-foreground')} fill="currentColor">
      {[0, 1, 2].map((i) => (
        <rect key={i} x={2 + i * 4} y={9 - i * 3} width="2.5" height={3 + i * 3} rx=".6" opacity={i < bars ? 1 : 0.2} />
      ))}
    </svg>
  )
}
