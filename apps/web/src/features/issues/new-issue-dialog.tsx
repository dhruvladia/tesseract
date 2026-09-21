import { useQuery } from '@tanstack/react-query'
import type { Priority } from '@tesseract/shared'
import { Plus } from 'lucide-react'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { AssigneePicker, PriorityPicker } from './pickers'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useMe } from '@/lib/me'
import { threadsQuery, useCreateIssue } from '@/lib/queries-issues'

export type IssueDefaults = { threadId?: string | null; engagementId?: string | null; parentId?: string | null }

// Pages publish their context (which thread/engagement is on screen) so `C` creates in the right place.
const Ctx = createContext<{ defaults: IssueDefaults; setDefaults: (d: IssueDefaults) => void; open: boolean; setOpen: (o: boolean) => void }>({
  defaults: {},
  setDefaults: () => {},
  open: false,
  setOpen: () => {},
})

export function NewIssueProvider({ children }: { children: ReactNode }) {
  const [defaults, setDefaults] = useState<IssueDefaults>({})
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target
      if (t instanceof Element && t.closest('input, textarea, [contenteditable], [role=dialog]')) return
      if (e.key.toLowerCase() === 'c' && !e.metaKey && !e.ctrlKey && !e.altKey) (e.preventDefault(), setOpen(true))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <Ctx.Provider value={{ defaults, setDefaults, open, setOpen }}>
      {children}
      <NewIssueDialog open={open} onOpenChange={setOpen} defaults={defaults} />
    </Ctx.Provider>
  )
}

export function useIssueDefaults(d: IssueDefaults) {
  const { setDefaults } = useContext(Ctx)
  useEffect(() => {
    setDefaults(d)
    return () => setDefaults({})
  }, [d.threadId, d.engagementId, d.parentId, setDefaults])
}

export function useOpenNewIssue() {
  return useContext(Ctx).setOpen
}

export function NewIssueDialog({
  defaults = {},
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  defaults?: IssueDefaults
  trigger?: ReactNode
  open?: boolean
  onOpenChange?: (o: boolean) => void
}) {
  const [localOpen, setLocalOpen] = useState(false)
  const open = controlledOpen ?? localOpen
  const setOpen = onOpenChange ?? setLocalOpen
  const { data: threads = [] } = useQuery(threadsQuery)
  const me = useMe()
  const create = useCreateIssue()
  const [threadId, setThreadId] = useState(defaults.threadId ?? '')
  const [priority, setPriority] = useState<Priority>('none')
  const [assigneeId, setAssigneeId] = useState<string | null>(null)

  // Recompute the default thread when the dialog opens with new context.
  useEffect(() => {
    if (!open) return
    const inEngagement = defaults.engagementId ? threads.filter((t) => t.engagementId === defaults.engagementId) : []
    setThreadId(defaults.threadId ?? inEngagement[0]?.id ?? threads[0]?.id ?? '')
    setPriority('none')
    setAssigneeId(null)
  }, [open, defaults.threadId, defaults.engagementId, threads])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const title = String(f.get('title')).trim()
    if (!title || !threadId) return
    const desc = String(f.get('desc') || '').trim()
    await create.mutateAsync({
      threadId,
      title,
      priority,
      assigneeId,
      parentId: defaults.parentId ?? null,
      description: desc ? { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: desc }] }] } : null,
    })
    setOpen(false)
  }

  const grouped = Object.entries(
    threads.reduce<Record<string, typeof threads>>((acc, t) => {
      const k = t.engagementName ? `${t.accountKey} · ${t.engagementName}` : 'Internal'
      ;(acc[k] ??= []).push(t)
      return acc
    }, {}),
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && (
        <span onClick={() => setOpen(true)} className="contents">
          {trigger}
        </span>
      )}
      <DialogContent className="top-[20%] translate-y-0 gap-0 p-0 sm:max-w-xl" showCloseButton={false}>
        <DialogTitle className="sr-only">New issue</DialogTitle>
        <form onSubmit={onSubmit}>
          <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2 text-xs text-muted-foreground">
            <Select value={threadId} onValueChange={setThreadId}>
              <SelectTrigger className="h-7 w-auto max-w-[280px] gap-1 border-0 bg-accent/50 px-2 text-xs shadow-none">
                <SelectValue placeholder="Choose a thread" />
              </SelectTrigger>
              <SelectContent>
                {grouped.map(([group, list]) => (
                  <div key={group}>
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">{group}</div>
                    {list.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
            {defaults.parentId && <span>· sub-issue</span>}
            <span className="ml-auto">
              {me.organization.name}
            </span>
          </div>
          <div className="space-y-2 px-4 pt-3">
            <Input
              name="title"
              autoFocus
              required
              placeholder="Issue title"
              className="h-auto border-0 bg-transparent px-0 text-base font-medium shadow-none focus-visible:ring-0"
            />
            <Textarea name="desc" rows={3} placeholder="Add description…" className="resize-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" />
          </div>
          <div className="flex items-center gap-1 px-3 pb-2 pt-1">
            <PriorityPicker value={priority} onChange={setPriority} />
            <AssigneePicker value={assigneeId} onChange={setAssigneeId} />
          </div>
          <div className="flex items-center justify-between border-t border-border/60 px-4 py-2">
            <span className="text-[10px] text-muted-foreground">
              <Kbd>⌘</Kbd> <Kbd>↵</Kbd> to create
            </span>
            <Button type="submit" size="sm" disabled={create.isPending || !threadId || threads.length === 0}>
              <Plus className="size-3.5" /> Create issue
            </Button>
          </div>
          {threads.length === 0 && <p className="px-4 pb-3 text-xs text-destructive">Create a thread first.</p>}
        </form>
      </DialogContent>
    </Dialog>
  )
}
