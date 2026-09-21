import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { Side } from '@tesseract/shared'
import { Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Field, MemberPicker } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { accountsQuery, useCreateEngagement } from '@/lib/queries'

export function NewEngagementDialog({ side, accountId, trigger }: { side: Side; accountId?: string; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const accounts = useQuery(accountsQuery)
  const create = useCreateEngagement()
  const navigate = useNavigate()
  const [acct, setAcct] = useState(accountId ?? '')
  const [fde, setFde] = useState<string | null>(null)
  const [em, setEm] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const row = await create.mutateAsync({
      accountId: acct,
      side,
      name: String(f.get('name')),
      decision: String(f.get('decision') || '') || null,
      fdeId: fde,
      engagementManagerId: em,
    })
    setOpen(false)
    navigate({ to: '/engagements/$id', params: { id: row.id } })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="size-4" /> New engagement
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New {side === 'presales' ? 'pre-sales' : 'post-sales'} engagement</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {!accountId && (
            <Field label="Account">
              <Select value={acct} onValueChange={setAcct} required>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.data?.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="font-mono text-xs text-muted-foreground">{a.key}</span> {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Engagement name">
            <Input name="name" required autoFocus placeholder="Claims triage agent" />
          </Field>
          <Field label="Decision this engagement unlocks" hint="Pre-sales: does the customer sign? Post-sales: does the pilot go to production?">
            <Textarea name="decision" rows={2} placeholder="Sign a 12-month platform contract for the claims org" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="FDE">
              <MemberPicker value={fde} onChange={setFde} filterRole={['fde']} />
            </Field>
            <Field label="Engagement manager">
              <MemberPicker value={em} onChange={setEm} filterRole={['engagement_manager', 'account_exec', 'csm']} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || !acct}>
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
