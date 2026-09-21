import { Link, useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { AlertTriangle, SearchX } from 'lucide-react'
import { Button } from './ui/button'
import { ApiError } from '@/lib/api'

/** Rendered inside the app shell when a route loader or component throws. */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  const api = error instanceof ApiError ? error : null
  const title = api?.status === 404 ? 'This no longer exists' : api?.status === 403 ? 'You do not have access to this' : 'Something went wrong'
  const detail = api ? api.message : error instanceof Error ? error.message : String(error)
  return (
    <div className="m-6 rounded-2xl border border-border/60 p-8">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 text-postsales" />
        <div className="min-w-0">
          <h1 className="text-base font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                reset()
                void router.invalidate()
              }}
            >
              Try again
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link to="/presales">Go to boards</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function RouteNotFound({ what = 'page' }: { what?: string }) {
  return (
    <div className="m-6 rounded-2xl border border-dashed border-border/60 p-8">
      <div className="flex items-start gap-3">
        <SearchX className="mt-0.5 size-5 text-muted-foreground" />
        <div>
          <h1 className="text-base font-semibold">This {what} does not exist</h1>
          <p className="mt-1 text-sm text-muted-foreground">It may have been deleted, or the link is wrong.</p>
          <div className="mt-4 flex gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link to="/presales">Boards</Link>
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link to="/accounts">Accounts</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
