import { useQuery } from '@tanstack/react-query'
import { RouteNotFound } from '@/components/route-fallbacks'
import { ensure } from '@/lib/me'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { PHASE_LABELS } from '@tesseract/shared'
import { PageHeader, PhasePill, UserAvatar, money } from '@/components/common'
import { StakeholderMap } from '@/features/accounts/stakeholder-map'
import { NewEngagementDialog } from '@/features/engagements/new-engagement-dialog'
import { Button } from '@/components/ui/button'
import { accountQuery, useDeleteAccount } from '@/lib/queries'
import { Trash2 } from 'lucide-react'

export const Route = createFileRoute('/_app/accounts/$id')({
  loader: ({ context, params }) => ensure(context.queryClient, accountQuery(params.id)),
  notFoundComponent: () => <RouteNotFound what="account" />,
  component: AccountPage,
})

function AccountPage() {
  const { id } = Route.useParams()
  const { data: a } = useQuery(accountQuery(id))
  const del = useDeleteAccount()
  const navigate = useNavigate()
  if (!a) return null
  const open = a.engagements.filter((e) => e.phase !== 'closed')
  const closed = a.engagements.filter((e) => e.phase === 'closed')

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Link to="/accounts" className="text-muted-foreground hover:text-foreground">
              Accounts
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-mono text-xs text-muted-foreground">{a.key}</span>
            {a.name}
          </span>
        }
        subtitle={[a.domain, money(a.arr) && `${money(a.arr)} ARR`].filter(Boolean).join(' · ')}
        actions={
          <>
            <NewEngagementDialog side="presales" accountId={a.id} trigger={<Button size="sm" variant="outline">New pre-sales</Button>} />
            <NewEngagementDialog side="postsales" accountId={a.id} trigger={<Button size="sm" variant="outline">New post-sales</Button>} />
            <Button
              size="icon"
              variant="ghost"
              className="size-8 text-muted-foreground hover:text-destructive"
              title="Delete account"
              onClick={async () => {
                const n = a.engagements.length
                if (!confirm(`Delete ${a.name}? This removes ${n} engagement${n === 1 ? '' : 's'}, their threads, issues and handoffs, and ${a.stakeholders.length} stakeholder${a.stakeholders.length === 1 ? '' : 's'}. This cannot be undone.`)) return
                await del.mutateAsync(a.id)
                navigate({ to: '/accounts' })
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </>
        }
      />
      <div className="grid flex-1 gap-6 overflow-auto p-5 lg:grid-cols-[1fr_380px]">
        <section>
          <h2 className="mb-2 text-xs font-medium text-muted-foreground">Engagements</h2>
          {a.engagements.length === 0 && <p className="text-sm text-muted-foreground">No engagements yet.</p>}
          <ul className="divide-y divide-border/50 rounded-lg border border-border/50">
            {[...open, ...closed].map((e) => (
              <li key={e.id}>
                <Link to="/engagements/$id" params={{ id: e.id }} className="row-hover flex items-center gap-3 px-3 py-2 text-sm">
                  <PhasePill phase={e.phase} side={e.side} />
                  <span className="flex-1 truncate font-medium">{e.name}</span>
                  {e.outcome && <span className="text-xs capitalize text-muted-foreground">{e.outcome.replace('_', ' ')}</span>}
                  <span className="text-[11px] text-muted-foreground">{PHASE_LABELS[e.phase]}</span>
                  <UserAvatar userId={e.fdeId} />
                </Link>
              </li>
            ))}
          </ul>
          {a.notes && <p className="mt-6 whitespace-pre-wrap text-sm text-muted-foreground">{a.notes}</p>}
        </section>
        <StakeholderMap accountId={a.id} stakeholders={a.stakeholders} />
      </div>
    </div>
  )
}
