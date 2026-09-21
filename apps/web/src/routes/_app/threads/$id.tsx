import { useQuery } from '@tanstack/react-query'
import { RouteNotFound } from '@/components/route-fallbacks'
import { ensure } from '@/lib/me'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { IssueList } from '@/features/issues/issue-list'
import { useIssueDefaults, useOpenNewIssue } from '@/features/issues/new-issue-dialog'
import { issuesQuery, threadQuery, useDeleteThread } from '@/lib/queries-issues'

export const Route = createFileRoute('/_app/threads/$id')({
  loader: ({ context, params }) => Promise.all([ensure(context.queryClient, threadQuery(params.id)), context.queryClient.ensureQueryData(issuesQuery({ threadId: params.id }))]),
  notFoundComponent: () => <RouteNotFound what="thread" />,
  component: ThreadPage,
})

function ThreadPage() {
  const { id } = Route.useParams()
  const { data: t } = useQuery(threadQuery(id))
  const { data: issues = [] } = useQuery(issuesQuery({ threadId: id }))
  const openNew = useOpenNewIssue()
  const del = useDeleteThread()
  const navigate = useNavigate()
  useIssueDefaults({ threadId: id, engagementId: t?.engagementId })
  if (!t) return null

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Link to="/threads" className="text-muted-foreground hover:text-foreground">
              Threads
            </Link>
            <span className="text-muted-foreground">/</span>
            {t.engagement && (
              <>
                <Link to="/engagements/$id" params={{ id: t.engagement.id }} search={{ tab: 'work' }} className="text-muted-foreground hover:text-foreground">
                  <span className="font-mono text-xs">{t.engagement.account.key}</span> {t.engagement.name}
                </Link>
                <span className="text-muted-foreground">/</span>
              </>
            )}
            {t.name}
          </span>
        }
        subtitle={t.description}
        actions={
          <>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 text-muted-foreground hover:text-destructive"
              title="Delete thread"
              onClick={async () => {
                if (!confirm(`Delete thread "${t.name}" and its ${issues.length} issues?`)) return
                await del.mutateAsync(t.id)
                navigate({ to: '/threads' })
              }}
            >
              <Trash2 className="size-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => openNew(true)}>
              <Plus className="size-4" /> New issue <Kbd className="ml-1">C</Kbd>
            </Button>
          </>
        }
      />
      <div className="flex-1 overflow-auto">
        <IssueList issues={issues} emptyText="No issues in this thread yet. Press C." />
      </div>
    </div>
  )
}
