import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { IssueList } from '@/features/issues/issue-list'
import { useOpenNewIssue } from '@/features/issues/new-issue-dialog'
import { issuesQuery } from '@/lib/queries-issues'

export const Route = createFileRoute('/_app/issues')({
  loader: ({ context }) => context.queryClient.ensureQueryData(issuesQuery({ assigneeId: 'me' })),
  component: MyIssues,
})

function MyIssues() {
  const { data = [] } = useQuery(issuesQuery({ assigneeId: 'me' }))
  const openNew = useOpenNewIssue()
  const open = data.filter((i) => i.status !== 'done' && i.status !== 'canceled').length
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="My issues"
        subtitle={`${open} open`}
        actions={
          <Button size="sm" variant="outline" onClick={() => openNew(true)}>
            <Plus className="size-4" /> New issue <Kbd className="ml-1">C</Kbd>
          </Button>
        }
      />
      <div className="flex-1 overflow-auto">
        <IssueList issues={data} showThread emptyText="Nothing assigned to you. Press C to create an issue." />
      </div>
    </div>
  )
}
