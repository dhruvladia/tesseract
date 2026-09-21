import { queryOptions, useQuery } from '@tanstack/react-query'
import { api, unwrap } from './api'
import { useMe } from './me'

const fetchAttention = () => unwrap(api.attention.$get())
export type AttentionItem = Awaited<ReturnType<typeof fetchAttention>>['items'][number]

export const attentionQuery = queryOptions({ queryKey: ['attention'], queryFn: fetchAttention, staleTime: 30_000, refetchInterval: 120_000 })

/** Items routed to the signed-in user. */
export function useMyAttention() {
  const me = useMe()
  const { data } = useQuery(attentionQuery)
  const items = data?.items ?? []
  return { all: items, mine: items.filter((i) => i.ownerId === me.userId) }
}

/** engagementId -> highest severity among its items (for board dots). */
export function useAttentionByEngagement() {
  const { data } = useQuery(attentionQuery)
  const map = new Map<string, { count: number; severity: AttentionItem['severity'] }>()
  for (const i of data?.items ?? []) {
    const cur = map.get(i.engagementId)
    if (!cur) map.set(i.engagementId, { count: 1, severity: i.severity })
    else map.set(i.engagementId, { count: cur.count + 1, severity: cur.severity === 'high' ? 'high' : i.severity === 'high' ? 'high' : cur.severity === 'medium' || i.severity === 'medium' ? 'medium' : 'low' })
  }
  return map
}
