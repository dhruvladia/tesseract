import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Layers } from 'lucide-react'
import { EmptyState, PageHeader, SideDot } from '@/components/common'
import { NewThreadDialog } from '@/features/threads/new-thread-dialog'
import { threadsQuery } from '@/lib/queries-issues'

export const Route = createFileRoute('/_app/threads/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(threadsQuery),
  component: ThreadsPage,
})

function ThreadsPage() {
  const { data = [] } = useQuery(threadsQuery)
  const groups = Object.entries(
    data.reduce<Record<string, typeof data>>((acc, t) => {
      const k = t.engagementId ? `${t.accountKey}::${t.engagementName}` : 'Internal'
      ;(acc[k] ??= []).push(t)
      return acc
    }, {}),
  )
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Threads" subtitle="Workstreams inside engagements, plus internal work" actions={<NewThreadDialog />} />
      {data.length === 0 ? (
        <EmptyState
          title="No threads yet"
          description="A thread is a workstream: discovery, data access, prototype, hardening, enablement. Issues live inside threads."
          action={<NewThreadDialog />}
        />
      ) : (
        <div className="flex-1 overflow-auto p-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {groups.map(([k, list]) => {
              const [key, name] = k.split('::')
              const first = list[0]!
              return (
                <div key={k} className="rounded-xl border border-border/50 bg-card/30">
                  <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2 text-xs">
                    {first.side ? <SideDot side={first.side} /> : <Layers className="size-3 text-muted-foreground" />}
                    {first.engagementId ? (
                      <Link to="/engagements/$id" params={{ id: first.engagementId }} search={{ tab: 'work' }} className="font-medium hover:underline">
                        <span className="mr-1.5 font-mono text-muted-foreground">{key}</span>
                        {name}
                      </Link>
                    ) : (
                      <span className="font-medium">Internal</span>
                    )}
                  </div>
                  <ul className="divide-y divide-border/40">
                    {list.map((t) => (
                      <li key={t.id}>
                        <Link to="/threads/$id" params={{ id: t.id }} className="row-hover flex items-center gap-2 px-3 py-2 text-sm">
                          <span className="flex-1 truncate">{t.name}</span>
                          <span className="text-[11px] tabular-nums text-muted-foreground">
                            {t.openCount} open · {t.issueCount}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
