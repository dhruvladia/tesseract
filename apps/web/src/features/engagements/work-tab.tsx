import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { IssueList } from '@/features/issues/issue-list'
import { useIssueDefaults, useOpenNewIssue } from '@/features/issues/new-issue-dialog'
import { NewThreadDialog } from '@/features/threads/new-thread-dialog'
import type { EngagementDetail } from '@/lib/queries'
import { issuesQuery } from '@/lib/queries-issues'

export function WorkTab({ e }: { e: EngagementDetail }) {
  const { data: issues = [] } = useQuery(issuesQuery({ engagementId: e.id }))
  const openNew = useOpenNewIssue()
  useIssueDefaults({ engagementId: e.id, threadId: e.threads[0]?.id ?? null })

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2">
        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Threads:</span>
          {e.threads.map((t) => (
            <Link
              key={t.id}
              to="/threads/$id"
              params={{ id: t.id }}
              className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] hover:border-border hover:bg-accent"
            >
              {t.name}
            </Link>
          ))}
          <NewThreadDialog
            engagementId={e.id}
            stay
            trigger={
              <button type="button" className="rounded-full border border-dashed border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground">
                + thread
              </button>
            }
          />
        </div>
        <Button size="sm" variant="outline" onClick={() => openNew(true)} disabled={e.threads.length === 0}>
          <Plus className="size-4" /> New issue <Kbd className="ml-1">C</Kbd>
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        <IssueList
          issues={issues}
          showThread
          emptyText={e.threads.length === 0 ? 'Create a thread (Discovery, Data access, Prototype…) to start tracking work.' : 'No issues yet. Press C.'}
        />
      </div>
    </div>
  )
}
