import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { PageHeader } from '@/components/common'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { GapBoard } from '@/features/gaps/gap-board'
import { GapDetail } from '@/features/gaps/gap-detail'
import { NewGapDialog } from '@/features/gaps/new-gap-dialog'
import { gapsQuery } from '@/lib/queries-gaps'

export const Route = createFileRoute('/_app/gaps')({
  validateSearch: z.object({ gap: z.string().optional() }),
  loader: ({ context }) => context.queryClient.ensureQueryData(gapsQuery),
  component: GapsPage,
})

function GapsPage() {
  const { gap } = Route.useSearch()
  const navigate = Route.useNavigate()
  const close = () => navigate({ search: (prev) => ({ ...prev, gap: undefined }), replace: true })
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Product gaps" subtitle="Field signals on their way back into the product" actions={<NewGapDialog />} />
      <div className="min-h-0 flex-1">
        <GapBoard />
      </div>
      <Sheet open={!!gap} onOpenChange={(o) => !o && close()}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-2xl" showCloseButton={false}>
          <SheetTitle className="sr-only">Product gap</SheetTitle>
          {gap && <GapDetail id={gap} onClose={close} />}
        </SheetContent>
      </Sheet>
    </div>
  )
}
