import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/common'
import { EngagementBoard } from '@/features/engagements/board'
import { NewEngagementDialog } from '@/features/engagements/new-engagement-dialog'
import { engagementsQuery } from '@/lib/queries'

export const Route = createFileRoute('/_app/postsales')({
  loader: ({ context }) => context.queryClient.ensureQueryData(engagementsQuery('postsales')),
  component: () => (
    <div className="flex h-full flex-col">
      <PageHeader title="Post-sales" subtitle="Kickoff, build, validate, go live, adopt, hand off" actions={<NewEngagementDialog side="postsales" />} />
      <div className="min-h-0 flex-1">
        <EngagementBoard side="postsales" />
      </div>
    </div>
  ),
})
