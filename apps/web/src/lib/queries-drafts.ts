import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import type { HandoffDraftApply, HandoffKind, handoffDraftGenerateSchema } from '@tesseract/shared'
import { toast } from 'sonner'
import type { z } from 'zod'
import { api, unwrap } from './api'

const hd = api.engagements[':id'].handoffs

const fetchPending = (id: string, kind: HandoffKind) => unwrap(hd[':kind'].drafts.pending.$get({ param: { id, kind } }))
export type PendingDraft = NonNullable<Awaited<ReturnType<typeof fetchPending>>>
export const pendingDraftQuery = (id: string, kind: HandoffKind) =>
  queryOptions({ queryKey: ['drafts', id, kind], queryFn: () => fetchPending(id, kind), staleTime: 30_000 })

export const snippetQuery = (id: string, sourceId: string, line: number) =>
  queryOptions({
    queryKey: ['snippet', sourceId, line],
    queryFn: () => unwrap(hd.sources[':sourceId'].snippet.$get({ param: { id, sourceId }, query: { line: String(line), context: '2' } })),
    staleTime: 5 * 60_000,
  })

export function useDrafts(engagementId: string, kind: HandoffKind) {
  const qc = useQueryClient()
  const id = engagementId
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['drafts', id, kind] })
    qc.invalidateQueries({ queryKey: ['engagements', 'detail', id] })
    qc.invalidateQueries({ queryKey: ['engagements'] })
    qc.invalidateQueries({ queryKey: ['accounts'] })
    qc.invalidateQueries({ queryKey: ['metrics'] })
    qc.invalidateQueries({ queryKey: ['attention'] })
  }
  const onError = (e: Error) => toast.error(e.message)
  return {
    generate: useMutation({
      mutationFn: (json: z.input<typeof handoffDraftGenerateSchema>) => unwrap(hd[':kind'].drafts.$post({ param: { id, kind }, json })),
      onSuccess: (d) => {
        invalidate()
        toast.success(`Draft ready: ${d.proposal.stats.verified} of ${d.proposal.stats.proposed} items backed by the notes`)
      },
      onError,
    }),
    apply: useMutation({
      mutationFn: ({ draftId, ...json }: { draftId: string } & HandoffDraftApply) =>
        unwrap(hd[':kind'].drafts[':draftId'].apply.$post({ param: { id, kind, draftId }, json })),
      onSuccess: (r) => {
        invalidate()
        toast.success(`Applied ${r.applied} item${r.applied === 1 ? '' : 's'} to the handoff`)
      },
      onError,
    }),
    dismiss: useMutation({
      mutationFn: (draftId: string) => unwrap(hd[':kind'].drafts[':draftId'].dismiss.$post({ param: { id, kind, draftId } })),
      onSuccess: invalidate,
      onError,
    }),
  }
}
