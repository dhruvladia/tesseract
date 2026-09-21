import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import type { IssueStatus, Priority } from '@tesseract/shared'
import { cn } from 'cn'
import { format, formatDistanceToNow } from 'date-fns'
import { CornerDownRight, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { DescriptionEditor } from './description-editor'
import { PRIORITY_LABELS, STATUS_LABELS, StatusIcon } from './icons'
import { NewIssueDialog } from './new-issue-dialog'
import { AssigneePicker, LabelPicker, PriorityPicker, StatusPicker } from './pickers'
import { UserAvatar, UserName } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { Textarea } from '@/components/ui/textarea'
import { useMember } from '@/lib/me'
import { issueQuery, useAddComment, useDeleteIssue, useUpdateIssue, type IssueDetail as Detail } from '@/lib/queries-issues'

export function IssueDetail({ id, onClose }: { id: string; onClose?: () => void }) {
  const { data: issue, isLoading } = useQuery(issueQuery(id))
  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  if (!issue) return <div className="p-6 text-sm text-muted-foreground">Issue not found.</div>
  return <Body issue={issue} onClose={onClose} />
}

function Body({ issue: i, onClose }: { issue: Detail; onClose?: () => void }) {
  const update = useUpdateIssue(i.id)
  const del = useDeleteIssue()
  const navigate = useNavigate()
  const titleRef = useRef<HTMLInputElement>(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [prioOpen, setPrioOpen] = useState(false)

  // Keyboard: E edit title, A assignee, S status, P priority, 0-4 priority, Esc close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target
      if (t instanceof Element && t.closest('input, textarea, [contenteditable], [role=dialog] [cmdk-root]')) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'e') (e.preventDefault(), titleRef.current?.focus(), titleRef.current?.select())
      else if (k === 'a') (e.preventDefault(), setAssignOpen(true))
      else if (k === 's') (e.preventDefault(), setStatusOpen(true))
      else if (k === 'p') (e.preventDefault(), setPrioOpen(true))
      else if (/^[0-4]$/.test(k)) (e.preventDefault(), update.mutate({ priority: (['none', 'urgent', 'high', 'medium', 'low'] as Priority[])[Number(k)] }))
      else if (k === 'escape' && onClose) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, update])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2 text-xs text-muted-foreground">
        {i.thread.engagement && (
          <>
            <Link to="/engagements/$id" params={{ id: i.thread.engagement.id }} search={{ tab: 'work' }} className="hover:text-foreground">
              {i.thread.engagement.name}
            </Link>
            <span>/</span>
          </>
        )}
        <Link to="/threads/$id" params={{ id: i.thread.id }} className="hover:text-foreground">
          {i.thread.name}
        </Link>
        <span>/</span>
        <span className="font-mono">{i.identifier}</span>
        <span className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-destructive"
            title="Delete issue"
            onClick={async () => {
              if (!confirm(`Delete ${i.identifier}?`)) return
              await del.mutateAsync(i.id)
              onClose ? onClose() : navigate({ to: '/issues' })
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="space-y-5 p-5">
          {i.parent && (
            <Link
              to="."
              search={(prev) => ({ ...prev, issue: i.parent!.id })}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <CornerDownRight className="size-3" /> <span className="font-mono">{i.parent.identifier}</span> {i.parent.title}
            </Link>
          )}
          <Input
            ref={titleRef}
            key={i.updatedAt}
            defaultValue={i.title}
            className="h-auto border-0 bg-transparent px-0 text-lg font-semibold tracking-tight shadow-none focus-visible:ring-0"
            onBlur={(e) => e.target.value.trim() && e.target.value !== i.title && update.mutate({ title: e.target.value.trim() })}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />

          <div className="flex flex-wrap items-center gap-1">
            <StatusPicker value={i.status as IssueStatus} onChange={(status) => update.mutate({ status })} open={statusOpen} onOpenChange={setStatusOpen} />
            <PriorityPicker value={i.priority as Priority} onChange={(priority) => update.mutate({ priority })} open={prioOpen} onOpenChange={setPrioOpen} />
            <AssigneePicker value={i.assigneeId} onChange={(assigneeId) => update.mutate({ assigneeId })} open={assignOpen} onOpenChange={setAssignOpen} />
            <LabelPicker value={i.labels.map((l) => l.labelId)} onChange={(labelIds) => update.mutate({ labelIds })} />
            <label className="inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 text-xs text-muted-foreground hover:bg-accent">
              Due
              <input
                type="date"
                className="bg-transparent text-xs text-foreground [color-scheme:dark] focus:outline-none"
                value={i.dueDate ?? ''}
                onChange={(e) => update.mutate({ dueDate: e.target.value || null })}
              />
            </label>
          </div>

          <DescriptionEditor key={i.id} value={i.description as never} onChange={(description) => update.mutate({ description })} />

          <section>
            <div className="mb-1.5 flex items-center justify-between">
              <h3 className="text-xs font-medium text-muted-foreground">Sub-issues {i.subIssues.length > 0 && `(${i.subIssues.filter((s) => s.status === 'done').length}/${i.subIssues.length})`}</h3>
              <NewIssueDialog
                defaults={{ threadId: i.thread.id, parentId: i.id }}
                trigger={
                  <Button variant="ghost" size="sm" className="h-6 text-xs">
                    <Plus className="size-3" /> Add
                  </Button>
                }
              />
            </div>
            <ul className="divide-y divide-border/40 rounded-md border border-border/50">
              {i.subIssues.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">Break this down into smaller steps.</li>}
              {i.subIssues.map((s) => (
                <li key={s.id}>
                  <Link to="." search={(prev) => ({ ...prev, issue: s.id })} className="row-hover flex items-center gap-2 px-3 py-1.5 text-sm">
                    <StatusIcon status={s.status as IssueStatus} />
                    <span className="font-mono text-[11px] text-muted-foreground">{s.identifier}</span>
                    <span className={cn('flex-1 truncate', s.status === 'done' && 'text-muted-foreground line-through')}>{s.title}</span>
                    <UserAvatar userId={s.assigneeId} className="size-4" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <Activity issue={i} />
        </div>
      </div>

      <div className="border-t border-border/60 px-4 py-1.5 text-[10px] text-muted-foreground">
        <Kbd>E</Kbd> title · <Kbd>S</Kbd> status · <Kbd>P</Kbd> priority · <Kbd>A</Kbd> assignee · <Kbd>0-4</Kbd> set priority
      </div>
    </div>
  )
}

function Activity({ issue: i }: { issue: Detail }) {
  const add = useAddComment(i.id)
  const [body, setBody] = useState('')
  const items = [
    ...i.activities.map((a) => ({ kind: 'activity' as const, at: a.createdAt, a })),
    ...i.comments.map((c) => ({ kind: 'comment' as const, at: c.createdAt, c })),
  ].sort((x, y) => new Date(x.at).getTime() - new Date(y.at).getTime())

  return (
    <section>
      <h3 className="mb-2 text-xs font-medium text-muted-foreground">Activity</h3>
      <ol className="space-y-2">
        {items.map((it, idx) =>
          it.kind === 'activity' ? (
            <li key={`a${idx}`} className="flex items-center gap-2 text-xs text-muted-foreground">
              <UserAvatar userId={it.a.actorId} className="size-4" />
              <span>
                <UserName userId={it.a.actorId} fallback="Someone" /> {describe(it.a)}
              </span>
              <span className="ml-auto shrink-0" title={format(new Date(it.at), 'PPpp')}>
                {formatDistanceToNow(new Date(it.at), { addSuffix: true })}
              </span>
            </li>
          ) : (
            <li key={`c${idx}`} className="rounded-md border border-border/50 bg-card/50 p-2.5 text-sm">
              <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                <UserAvatar userId={it.c.authorId} className="size-4" />
                <UserName userId={it.c.authorId} fallback="Someone" />
                <span className="ml-auto">{formatDistanceToNow(new Date(it.at), { addSuffix: true })}</span>
              </div>
              <p className="whitespace-pre-wrap">{it.c.body}</p>
            </li>
          ),
        )}
      </ol>
      <form
        className="mt-3 space-y-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!body.trim()) return
          await add.mutateAsync({ body })
          setBody('')
        }}
      >
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Leave a comment… (⌘↵ to send)"
          onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && e.currentTarget.form?.requestSubmit()}
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={!body.trim() || add.isPending}>
            Comment
          </Button>
        </div>
      </form>
    </section>
  )
}

function describe(a: Detail['activities'][number]) {
  switch (a.field) {
    case 'created':
      return 'created the issue'
    case 'status':
      return `changed status to ${STATUS_LABELS[a.to as IssueStatus] ?? a.to}`
    case 'priority':
      return `set priority to ${PRIORITY_LABELS[a.to as Priority] ?? a.to}`
    case 'assigneeId':
      return a.to ? <AssignedTo userId={a.to} /> : 'unassigned the issue'
    case 'dueDate':
      return a.to ? `set due date to ${format(new Date(a.to), 'MMM d')}` : 'removed the due date'
    case 'parentId':
      return a.to ? 'moved under a parent issue' : 'detached from parent'
    case 'title':
      return 'renamed the issue'
    default:
      return `changed ${a.field}`
  }
}

function AssignedTo({ userId }: { userId: string }) {
  const m = useMember(userId)
  return <>assigned to {m?.name ?? 'someone'}</>
}
