import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { AppShell } from '@/components/app-shell'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { AgentPanel } from '@/features/agent/agent-panel'
import { CommandPalette } from '@/features/cmdk'
import { IssueDetail } from '@/features/issues/issue-detail'
import { NewIssueProvider } from '@/features/issues/new-issue-dialog'
import { ApiError } from '@/lib/api'
import { meQuery } from '@/lib/me'

// Auth-guarded layout. Loads the bootstrap payload once; 401 -> login, no org -> onboarding.
// `?issue=<id>` opens the issue peek panel from any page (search params are inherited by children).
export const Route = createFileRoute('/_app')({
  validateSearch: z.object({ issue: z.string().optional() }),
  beforeLoad: async ({ context, location }) => {
    try {
      await context.queryClient.ensureQueryData(meQuery)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) throw redirect({ to: '/login', search: { redirect: location.href } })
      if (e instanceof ApiError && e.status === 403) throw redirect({ to: '/onboarding' })
      throw e
    }
  },
  component: Layout,
})

function Layout() {
  const { issue } = Route.useSearch()
  const navigate = Route.useNavigate()
  const close = () => navigate({ to: '.', search: (prev) => ({ ...prev, issue: undefined }), replace: true })
  return (
    <NewIssueProvider>
      <AppShell>
        <Outlet />
      </AppShell>
      <CommandPalette />
      <AgentPanel />
      <Sheet open={!!issue} onOpenChange={(o) => !o && close()}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-2xl" showCloseButton={false}>
          <SheetTitle className="sr-only">Issue</SheetTitle>
          {issue && <IssueDetail id={issue} onClose={close} />}
        </SheetContent>
      </Sheet>
    </NewIssueProvider>
  )
}
