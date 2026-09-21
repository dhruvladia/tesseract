import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import type {
  accountCreateSchema,
  accountUpdateSchema,
  engagementCreateSchema,
  engagementUpdateSchema,
  phaseChangeSchema,
  Side,
} from '@tesseract/shared'
import { toast } from 'sonner'
import { api, unwrap } from './api'

type In<S extends z.ZodType> = z.input<S>

// ---- Accounts ------------------------------------------------------------------

const fetchAccounts = () => unwrap(api.accounts.$get())
const fetchAccount = (id: string) => unwrap(api.accounts[':id'].$get({ param: { id } }))
export type AccountListItem = Awaited<ReturnType<typeof fetchAccounts>>[number]
export type AccountDetail = Awaited<ReturnType<typeof fetchAccount>>

export const accountsQuery = queryOptions({ queryKey: ['accounts'], queryFn: fetchAccounts })
export const accountQuery = (id: string) => queryOptions({ queryKey: ['accounts', id], queryFn: () => fetchAccount(id) })

export function useCreateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (json: In<typeof accountCreateSchema>) => unwrap(api.accounts.$post({ json })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
    onError: (e) => toast.error(e.message),
  })
}

export function useUpdateAccount(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (json: In<typeof accountUpdateSchema>) => unwrap(api.accounts[':id'].$patch({ param: { id }, json })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
    onError: (e) => toast.error(e.message),
  })
}

// ---- Engagements ---------------------------------------------------------------

const fetchEngagements = (side?: Side, includeClosed = false) =>
  unwrap(api.engagements.$get({ query: { side, includeClosed: includeClosed ? '1' : '0' } }))
const fetchEngagement = (id: string) => unwrap(api.engagements[':id'].$get({ param: { id } }))
export type EngagementListItem = Awaited<ReturnType<typeof fetchEngagements>>[number]
export type EngagementDetail = Awaited<ReturnType<typeof fetchEngagement>>

export const engagementsQuery = (side?: Side, includeClosed = false) =>
  queryOptions({ queryKey: ['engagements', { side, includeClosed }], queryFn: () => fetchEngagements(side, includeClosed) })
export const engagementQuery = (id: string) =>
  queryOptions({ queryKey: ['engagements', 'detail', id], queryFn: () => fetchEngagement(id) })

export function useInvalidateEngagement(id?: string) {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['engagements'] })
    if (id) qc.invalidateQueries({ queryKey: ['engagements', 'detail', id] })
    qc.invalidateQueries({ queryKey: ['accounts'] })
  }
}

export function useCreateEngagement() {
  const invalidate = useInvalidateEngagement()
  return useMutation({
    mutationFn: (json: In<typeof engagementCreateSchema>) => unwrap(api.engagements.$post({ json })),
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  })
}

export function useUpdateEngagement(id: string) {
  const invalidate = useInvalidateEngagement(id)
  return useMutation({
    mutationFn: (json: In<typeof engagementUpdateSchema>) => unwrap(api.engagements[':id'].$patch({ param: { id }, json })),
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  })
}

/** Phase change with optimistic board update; the server's gate reason surfaces as a toast on rollback. */
export function useChangePhase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...json }: { id: string } & In<typeof phaseChangeSchema>) =>
      unwrap(api.engagements[':id'].phase.$post({ param: { id }, json })),
    onMutate: async ({ id, phase }) => {
      await qc.cancelQueries({ queryKey: ['engagements'] })
      const snapshots = qc.getQueriesData<EngagementListItem[]>({ queryKey: ['engagements'] })
      qc.setQueriesData<EngagementListItem[]>({ queryKey: ['engagements'] }, (old) =>
        Array.isArray(old) ? old.map((e) => (e.id === id ? { ...e, phase, phaseEnteredAt: new Date().toISOString() } : e)) : old,
      )
      return { snapshots }
    },
    onError: (e, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data))
      toast.error(e.message)
    },
    onSettled: (_d, _e, { id }) => {
      qc.invalidateQueries({ queryKey: ['engagements'] })
      qc.invalidateQueries({ queryKey: ['engagements', 'detail', id] })
    },
  })
}
