import { queryOptions, useQuery, type EnsureQueryDataOptions, type QueryClient, type QueryKey } from '@tanstack/react-query'
import { notFound } from '@tanstack/react-router'
import { ApiError, api, unwrap } from './api'

/** ensureQueryData that turns a 404 into the route's not-found page instead of an error card. */
export async function ensure<TQueryFnData, TError, TData, TQueryKey extends QueryKey>(
  qc: QueryClient,
  query: EnsureQueryDataOptions<TQueryFnData, TError, TData, TQueryKey>,
): Promise<TData> {
  try {
    return await qc.ensureQueryData(query)
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) throw notFound()
    throw e
  }
}

const fetchMe = () => unwrap(api.me.$get())

export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: fetchMe,
  staleTime: 60_000,
  retry: false,
})

export type Me = Awaited<ReturnType<typeof fetchMe>>
export type Member = Me['members'][number]

export function useMe() {
  const q = useQuery(meQuery)
  // Route guard guarantees data is loaded before rendering the app shell.
  return q.data!
}

export function useMembers() {
  return useMe().members
}

export function useMember(userId: string | null | undefined) {
  const members = useMembers()
  return userId ? members.find((m) => m.userId === userId) : undefined
}
