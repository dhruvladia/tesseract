import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { EmptyState, PageHeader, money } from '@/components/common'
import { NewAccountDialog } from '@/features/accounts/new-account-dialog'
import { accountsQuery } from '@/lib/queries'

export const Route = createFileRoute('/_app/accounts/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(accountsQuery),
  component: AccountsPage,
})

function AccountsPage() {
  const { data = [] } = useQuery(accountsQuery)
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Accounts" subtitle={`${data.length} customer${data.length === 1 ? '' : 's'}`} actions={<NewAccountDialog />} />
      {data.length === 0 ? (
        <EmptyState
          title="No accounts yet"
          description="An account is a customer. Engagements, stakeholders and issue identifiers hang off it."
          action={<NewAccountDialog />}
        />
      ) : (
        <div className="divide-y divide-border/50">
          <div className="grid grid-cols-[80px_1fr_120px_100px_100px] gap-3 px-5 py-1.5 text-[11px] font-medium text-muted-foreground">
            <span>Key</span>
            <span>Account</span>
            <span className="text-right">ARR</span>
            <span className="text-right">Active</span>
            <span className="text-right">Total</span>
          </div>
          {data.map((a) => (
            <Link
              key={a.id}
              to="/accounts/$id"
              params={{ id: a.id }}
              className="row-hover grid grid-cols-[80px_1fr_120px_100px_100px] items-center gap-3 px-5 py-2 text-sm"
            >
              <span className="font-mono text-xs text-muted-foreground">{a.key}</span>
              <span className="min-w-0 truncate">
                <span className="font-medium">{a.name}</span>
                {a.domain && <span className="ml-2 text-xs text-muted-foreground">{a.domain}</span>}
              </span>
              <span className="text-right tabular-nums text-muted-foreground">{money(a.arr) ?? '—'}</span>
              <span className="text-right tabular-nums">{a.activeCount}</span>
              <span className="text-right tabular-nums text-muted-foreground">{a.engagementCount}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
