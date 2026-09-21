import { queryOptions } from '@tanstack/react-query'
import { api, unwrap } from './api'

const fetchHandoffMetrics = () => unwrap(api.metrics.handoffs.$get())
export type HandoffMetrics = Awaited<ReturnType<typeof fetchHandoffMetrics>>
export type HandoffMetricRow = HandoffMetrics['rows'][number]

export const handoffMetricsQuery = queryOptions({ queryKey: ['metrics', 'handoffs'], queryFn: fetchHandoffMetrics, staleTime: 30_000 })
