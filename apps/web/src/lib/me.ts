import { queryOptions, useQuery } from '@tanstack/react-query'
import { api, unwrap } from './api'

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
