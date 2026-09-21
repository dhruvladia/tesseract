import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import type { commentCreateSchema, issueCreateSchema, issueListQuerySchema, issueUpdateSchema, labelCreateSchema, threadCreateSchema, threadUpdateSchema } from '@tesseract/shared'
import { toast } from 'sonner'
import type { z } from 'zod'
import { api, unwrap } from './api'

type In<S extends z.ZodType> = z.input<S>

// ---- Threads -------------------------------------------------------------------
const fetchThreads = () => unwrap(api.threads.$get())
const fetchThread = (id: string) => unwrap(api.threads[':id'].$get({ param: { id } }))
export type ThreadListItem = Awaited<ReturnType<typeof fetchThreads>>[number]
export type ThreadDetail = Awaited<ReturnType<typeof fetchThread>>
export const threadsQuery = queryOptions({ queryKey: ['threads'], queryFn: fetchThreads })
export const threadQuery = (id: string) => queryOptions({ queryKey: ['threads', id], queryFn: () => fetchThread(id) })

export function useCreateThread() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (json: In<typeof threadCreateSchema>) => unwrap(api.threads.$post({ json })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['threads'] })
      qc.invalidateQueries({ queryKey: ['engagements', 'detail'] })
    },
    onError: (e) => toast.error(e.message),
  })
}
export function useUpdateThread(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (json: In<typeof threadUpdateSchema>) => unwrap(api.threads[':id'].$patch({ param: { id }, json })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['threads'] }),
    onError: (e) => toast.error(e.message),
  })
}
export function useDeleteThread() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => unwrap(api.threads[':id'].$delete({ param: { id } })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['threads'] })
      qc.invalidateQueries({ queryKey: ['issues'] })
    },
    onError: (e) => toast.error(e.message),
  })
}

// ---- Issues --------------------------------------------------------------------
export type IssueFilter = In<typeof issueListQuerySchema>
const fetchIssues = (query: IssueFilter) => unwrap(api.issues.$get({ query }))
const fetchIssue = (id: string) => unwrap(api.issues[':id'].$get({ param: { id } }))
export type IssueListItem = Awaited<ReturnType<typeof fetchIssues>>[number]
export type IssueDetail = Awaited<ReturnType<typeof fetchIssue>>
export const issuesQuery = (filter: IssueFilter) => queryOptions({ queryKey: ['issues', filter], queryFn: () => fetchIssues(filter) })
export const issueQuery = (id: string) => queryOptions({ queryKey: ['issues', 'detail', id], queryFn: () => fetchIssue(id) })

function useInvalidateIssues(id?: string) {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['issues'] })
    qc.invalidateQueries({ queryKey: ['threads'] })
    if (id) qc.invalidateQueries({ queryKey: ['issues', 'detail', id] })
  }
}

export function useCreateIssue() {
  const invalidate = useInvalidateIssues()
  return useMutation({
    mutationFn: (json: In<typeof issueCreateSchema>) => unwrap(api.issues.$post({ json })),
    onSuccess: (row) => {
      invalidate()
      toast.success(`${row.identifier} created`)
    },
    onError: (e) => toast.error(e.message),
  })
}

/** Optimistic single-field updates so status/priority/assignee changes feel instant in lists. */
export function useUpdateIssue(id: string) {
  const qc = useQueryClient()
  const invalidate = useInvalidateIssues(id)
  return useMutation({
    mutationFn: (json: In<typeof issueUpdateSchema>) => unwrap(api.issues[':id'].$patch({ param: { id }, json })),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ['issues'] })
      const snaps = qc.getQueriesData<IssueListItem[] | IssueDetail>({ queryKey: ['issues'] })
      const { labelIds: _l, description: _d, ...simple } = patch
      qc.setQueriesData<IssueListItem[]>({ queryKey: ['issues'], predicate: (q) => Array.isArray(q.state.data) }, (old) =>
        old?.map((i) => (i.id === id ? ({ ...i, ...simple } as IssueListItem) : i)),
      )
      qc.setQueryData<IssueDetail>(['issues', 'detail', id], (old) => (old ? ({ ...old, ...simple } as IssueDetail) : old))
      return { snaps }
    },
    onError: (e, _v, ctx) => {
      ctx?.snaps.forEach(([k, d]) => qc.setQueryData(k, d))
      toast.error(e.message)
    },
    onSettled: invalidate,
  })
}

export function useDeleteIssue() {
  const invalidate = useInvalidateIssues()
  return useMutation({
    mutationFn: (id: string) => unwrap(api.issues[':id'].$delete({ param: { id } })),
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  })
}

export function useAddComment(issueId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (json: In<typeof commentCreateSchema>) => unwrap(api.issues[':id'].comments.$post({ param: { id: issueId }, json })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['issues', 'detail', issueId] }),
    onError: (e) => toast.error(e.message),
  })
}

// ---- Labels --------------------------------------------------------------------
const fetchLabels = () => unwrap(api.labels.$get())
export type Label = Awaited<ReturnType<typeof fetchLabels>>[number]
export const labelsQuery = queryOptions({ queryKey: ['labels'], queryFn: fetchLabels, staleTime: 5 * 60_000 })

export function useCreateLabel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (json: In<typeof labelCreateSchema>) => unwrap(api.labels.$post({ json })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['labels'] }),
    onError: (e) => toast.error(e.message),
  })
}
export function useDeleteLabel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => unwrap(api.labels[':id'].$delete({ param: { id } })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['labels'] })
      qc.invalidateQueries({ queryKey: ['issues'] })
    },
    onError: (e) => toast.error(e.message),
  })
}

// ---- Search --------------------------------------------------------------------
export const searchQuery = (q: string) =>
  queryOptions({
    queryKey: ['search', q],
    queryFn: () => unwrap(api.search.$get({ query: { q } })),
    enabled: q.trim().length > 0,
    staleTime: 10_000,
  })
