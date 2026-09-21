import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/common'
import { EngagementBoard } from '@/features/engagements/board'
import { NewEngagementDialog } from '@/features/engagements/new-engagement-dialog'
import { engagementsQuery } from '@/lib/queries'

export const Route = createFileRoute('/_app/presales')({
  loader: ({ context }) => context.queryClient.ensureQueryData(engagementsQuery('presales')),
  component: () => (
    <div className="flex h-full flex-col">
      <PageHeader title="Pre-sales" subtitle="Qualify, discover, scope, prototype, win" actions={<NewEngagementDialog side="presales" />} />
      <div className="min-h-0 flex-1">
        <EngagementBoard side="presales" />
      </div>
    </div>
  ),
})
