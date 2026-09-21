import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { HandoffKind, handoffUpsertSchema, milestoneCreateSchema, milestoneUpdateSchema, outcomeCreateSchema, outcomeUpdateSchema } from '@tesseract/shared'
import { toast } from 'sonner'
import type { z } from 'zod'
import { api, unwrap } from './api'

type In<S extends z.ZodType> = z.input<S>
const ex = api.engagements[':id']

function useInvalidate(engagementId: string) {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['engagements'] })
    qc.invalidateQueries({ queryKey: ['engagements', 'detail', engagementId] })
  }
}
const onError = (e: Error) => toast.error(e.message)

export function useOutcomes(engagementId: string) {
  const invalidate = useInvalidate(engagementId)
  const id = engagementId
  return {
    create: useMutation({ mutationFn: (json: In<typeof outcomeCreateSchema>) => unwrap(ex.outcomes.$post({ param: { id }, json })), onSuccess: invalidate, onError }),
    update: useMutation({
      mutationFn: ({ oid, ...json }: { oid: string } & In<typeof outcomeUpdateSchema>) => unwrap(ex.outcomes[':oid'].$patch({ param: { id, oid }, json })),
      onSuccess: invalidate,
      onError,
    }),
    remove: useMutation({ mutationFn: (oid: string) => unwrap(ex.outcomes[':oid'].$delete({ param: { id, oid } })), onSuccess: invalidate, onError }),
  }
}

export function useMilestones(engagementId: string) {
  const invalidate = useInvalidate(engagementId)
  const id = engagementId
  return {
    create: useMutation({ mutationFn: (json: In<typeof milestoneCreateSchema>) => unwrap(ex.milestones.$post({ param: { id }, json })), onSuccess: invalidate, onError }),
    update: useMutation({
      mutationFn: ({ mid, ...json }: { mid: string } & In<typeof milestoneUpdateSchema>) => unwrap(ex.milestones[':mid'].$patch({ param: { id, mid }, json })),
      onSuccess: invalidate,
      onError,
    }),
    remove: useMutation({ mutationFn: (mid: string) => unwrap(ex.milestones[':mid'].$delete({ param: { id, mid } })), onSuccess: invalidate, onError }),
  }
}

export function useHandoff(engagementId: string, kind: HandoffKind) {
  const invalidate = useInvalidate(engagementId)
  const id = engagementId
  return {
    save: useMutation({
      mutationFn: (json: In<typeof handoffUpsertSchema>) => unwrap(ex.handoffs[':kind'].$put({ param: { id, kind }, json })),
      onSuccess: invalidate,
      onError,
    }),
    accept: useMutation({
      mutationFn: () => unwrap(ex.handoffs[':kind'].accept.$post({ param: { id, kind } })),
      onSuccess: () => {
        invalidate()
        toast.success('Handoff accepted')
      },
      onError,
    }),
    reopen: useMutation({ mutationFn: () => unwrap(ex.handoffs[':kind'].reopen.$post({ param: { id, kind } })), onSuccess: invalidate, onError }),
  }
}
