import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Orbs } from '@/components/orbs'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { HandoffsTab } from '@/features/engagements/handoffs-tab'
import { OverviewTab } from '@/features/engagements/overview-tab'
import { WorkTab } from '@/features/engagements/work-tab'
import { PhaseStepper } from '@/features/engagements/phase-stepper'
import { SignalsTab } from '@/features/engagements/signals-tab'
import { StakeholderMap } from '@/features/accounts/stakeholder-map'
import { engagementQuery } from '@/lib/queries'

const TABS = ['overview', 'work', 'stakeholders', 'handoffs', 'signals'] as const
type Tab = (typeof TABS)[number]

export const Route = createFileRoute('/_app/engagements/$id')({
  validateSearch: z.object({ tab: z.enum(TABS).optional() }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(engagementQuery(params.id)),
  component: EngagementPage,
})

function EngagementPage() {
  const { id } = Route.useParams()
  const { tab = 'overview' } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: e } = useQuery(engagementQuery(id))
  if (!e) return null

  return (
    <div className="flex h-full flex-col">
      <header className="relative shrink-0 overflow-hidden border-b border-border/60">
        <Orbs preset={e.side} opacity={0.28} grain={false} />
        <div className="relative px-5 pb-3 pt-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link to={e.side === 'presales' ? '/presales' : '/postsales'} className="hover:text-foreground">
              {e.side === 'presales' ? 'Pre-sales' : 'Post-sales'}
            </Link>
            <span>/</span>
            <Link to="/accounts/$id" params={{ id: e.accountId }} className="hover:text-foreground">
              <span className="font-mono">{e.account.key}</span> {e.account.name}
            </Link>
          </div>
          <h1 className="mt-1 text-lg font-semibold tracking-tight">{e.name}</h1>
          <div className="mt-3">
            <PhaseStepper e={e} />
          </div>
        </div>
      </header>

      <Tabs value={tab} onValueChange={(v) => navigate({ search: { tab: v as Tab }, replace: true })} className="min-h-0 flex-1">
        <TabsList className="h-10 w-full justify-start rounded-none border-b border-border/60 bg-transparent px-3">
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize data-[state=active]:bg-accent">
              {t}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="h-[calc(100%-2.5rem)] overflow-auto">
          <TabsContent value="overview" className="m-0 p-5">
            <OverviewTab e={e} />
          </TabsContent>
          <TabsContent value="work" className="m-0 h-full">
            <WorkTab e={e} />
          </TabsContent>
          <TabsContent value="stakeholders" className="m-0 p-5">
            <div className="max-w-xl">
              <StakeholderMap accountId={e.accountId} stakeholders={e.account.stakeholders} />
            </div>
          </TabsContent>
          <TabsContent value="handoffs" className="m-0 p-5">
            <HandoffsTab e={e} />
          </TabsContent>
          <TabsContent value="signals" className="m-0 p-5">
            <SignalsTab e={e} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
