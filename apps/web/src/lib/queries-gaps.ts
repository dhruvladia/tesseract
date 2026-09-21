import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import type { engagementGapLinkSchema, productGapCreateSchema, productGapUpdateSchema } from '@tesseract/shared'
import { toast } from 'sonner'
import type { z } from 'zod'
import { api, unwrap } from './api'

type In<S extends z.ZodType> = z.input<S>

const fetchGaps = () => unwrap(api.gaps.$get())
const fetchGap = (id: string) => unwrap(api.gaps[':id'].$get({ param: { id } }))
export type GapListItem = Awaited<ReturnType<typeof fetchGaps>>[number]
export type GapDetail = Awaited<ReturnType<typeof fetchGap>>
export const gapsQuery = queryOptions({ queryKey: ['gaps'], queryFn: fetchGaps })
export const gapQuery = (id: string) => queryOptions({ queryKey: ['gaps', 'detail', id], queryFn: () => fetchGap(id) })

function useInvalidateGaps(id?: string) {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['gaps'] })
    if (id) qc.invalidateQueries({ queryKey: ['gaps', 'detail', id] })
    qc.invalidateQueries({ queryKey: ['engagements'] })
  }
}
const onError = (e: Error) => toast.error(e.message)

export function useCreateGap() {
  const invalidate = useInvalidateGaps()
  return useMutation({ mutationFn: (json: In<typeof productGapCreateSchema>) => unwrap(api.gaps.$post({ json })), onSuccess: invalidate, onError })
}

/** Optimistic status/parent moves so the board feels instant. */
export function useUpdateGap() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...json }: { id: string } & In<typeof productGapUpdateSchema>) => unwrap(api.gaps[':id'].$patch({ param: { id }, json })),
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: ['gaps'] })
      const prev = qc.getQueryData<GapListItem[]>(['gaps'])
      qc.setQueryData<GapListItem[]>(['gaps'], (old) => old?.map((g) => (g.id === id ? ({ ...g, ...patch } as GapListItem) : g)))
      return { prev }
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['gaps'], ctx.prev)
      toast.error(e.message)
    },
    onSettled: (_d, _e, { id }) => {
      qc.invalidateQueries({ queryKey: ['gaps'] })
      qc.invalidateQueries({ queryKey: ['gaps', 'detail', id] })
      qc.invalidateQueries({ queryKey: ['engagements'] })
    },
  })
}

export function useDeleteGap() {
  const invalidate = useInvalidateGaps()
  return useMutation({ mutationFn: (id: string) => unwrap(api.gaps[':id'].$delete({ param: { id } })), onSuccess: invalidate, onError })
}

export function useLinkGap(gapId: string) {
  const invalidate = useInvalidateGaps(gapId)
  return {
    link: useMutation({
      mutationFn: (json: In<typeof engagementGapLinkSchema>) => unwrap(api.gaps[':id'].engagements.$post({ param: { id: gapId }, json })),
      onSuccess: invalidate,
      onError,
    }),
    update: useMutation({
      mutationFn: ({ eid, ...json }: { eid: string } & Partial<Omit<In<typeof engagementGapLinkSchema>, 'engagementId'>>) =>
        unwrap(api.gaps[':id'].engagements[':eid'].$patch({ param: { id: gapId, eid }, json })),
      onSuccess: invalidate,
      onError,
    }),
    unlink: useMutation({
      mutationFn: (eid: string) => unwrap(api.gaps[':id'].engagements[':eid'].$delete({ param: { id: gapId, eid } })),
      onSuccess: invalidate,
      onError,
    }),
  }
}
