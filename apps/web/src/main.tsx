import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'
import './index.css'
import { RouteError, RouteNotFound } from './components/route-fallbacks'
import { ApiError } from './lib/api'
import { routeTree } from './routeTree.gen'

// Session expiry and connectivity are handled once here, not per query.
function onSessionOrNetworkError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    queryClient.clear()
    if (!location.pathname.startsWith('/login')) location.assign(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`)
    return true
  }
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    toast.error('Cannot reach the server. Check that the API is running.', { id: 'network' })
    return true
  }
  return false
}

// Dialogs `await mutateAsync(...)` so they can close on success; on failure the mutation's onError has
// already toasted the message, so the rejected promise carries nothing new. Keep it out of the console.
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason instanceof ApiError) e.preventDefault()
})

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 1 } },
  queryCache: new QueryCache({ onError: (error) => void onSessionOrNetworkError(error) }),
  mutationCache: new MutationCache({ onError: (error) => void onSessionOrNetworkError(error) }),
})

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultErrorComponent: RouteError,
  defaultNotFoundComponent: () => <RouteNotFound />,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
