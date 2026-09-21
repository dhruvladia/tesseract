import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { stakeholderCreateSchema } from '@tesseract/shared'
import { toast } from 'sonner'
import type { z } from 'zod'
import { api, unwrap } from './api'

export function useCreateStakeholder(accountId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (json: z.input<typeof stakeholderCreateSchema>) =>
      unwrap(api.accounts[':id'].stakeholders.$post({ param: { id: accountId }, json })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts', accountId] })
      qc.invalidateQueries({ queryKey: ['engagements', 'detail'] })
    },
    onError: (e) => toast.error(e.message),
  })
}

export function useDeleteStakeholder(accountId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sid: string) => unwrap(api.accounts[':id'].stakeholders[':sid'].$delete({ param: { id: accountId, sid } })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts', accountId] })
      qc.invalidateQueries({ queryKey: ['engagements', 'detail'] })
    },
    onError: (e) => toast.error(e.message),
  })
}
