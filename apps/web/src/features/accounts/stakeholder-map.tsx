import { STAKEHOLDER_ROLES, type StakeholderRole } from '@tesseract/shared'
import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Field } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { AccountDetail } from '@/lib/queries'
import { useCreateStakeholder, useDeleteStakeholder } from '@/lib/queries-stakeholders'

export const ROLE_LABELS: Record<StakeholderRole, string> = {
  sponsor: 'Executive sponsor',
  technical_owner: 'Technical owner',
  workflow_owner: 'Workflow owner',
  champion: 'Champion',
  user: 'End user',
  blocker: 'Blocker / skeptic',
}
const ROLE_HINT: Record<StakeholderRole, string> = {
  sponsor: 'Decides on scope, budget and rollout',
  technical_owner: 'Owns systems, data access and the production stack',
  workflow_owner: 'Owns the process being changed; operates it after handoff',
  champion: 'Advocates internally, unblocks politics',
  user: 'Does the work daily; adoption lives or dies here',
  blocker: 'Known resistance to plan change management around',
}

export function StakeholderMap({ accountId, stakeholders }: { accountId: string; stakeholders: AccountDetail['stakeholders'] }) {
  const del = useDeleteStakeholder(accountId)
  const required: StakeholderRole[] = ['sponsor', 'technical_owner', 'workflow_owner']
  const missing = required.filter((r) => !stakeholders.some((s) => s.role === r))

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-medium text-muted-foreground">Stakeholder map</h2>
        <NewStakeholderDialog accountId={accountId} />
      </div>
      {missing.length > 0 && (
        <p className="mb-2 rounded-md border border-postsales/30 bg-postsales/5 px-2.5 py-1.5 text-[11px] text-postsales">
          Qualification needs a named {missing.map((r) => ROLE_LABELS[r].toLowerCase()).join(', ')}.
        </p>
      )}
      <div className="grid gap-2">
        {STAKEHOLDER_ROLES.map((role) => {
          const list = stakeholders.filter((s) => s.role === role)
          if (list.length === 0 && !required.includes(role)) return null
          return (
            <div key={role} className="rounded-lg border border-border/50 p-2.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium">{ROLE_LABELS[role]}</span>
                <span className="text-[10px] text-muted-foreground">{ROLE_HINT[role]}</span>
              </div>
              {list.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground/70">Not yet identified</p>
              ) : (
                <ul className="mt-1.5 space-y-1">
                  {list.map((s) => (
                    <li key={s.id} className="group flex items-center gap-2 text-sm">
                      <span className="font-medium">{s.name}</span>
                      {s.title && <span className="text-xs text-muted-foreground">{s.title}</span>}
                      {s.email && (
                        <a href={`mailto:${s.email}`} className="text-xs text-muted-foreground hover:text-foreground">
                          {s.email}
                        </a>
                      )}
                      <button
                        type="button"
                        className="ml-auto opacity-0 transition group-hover:opacity-100"
                        onClick={() => del.mutate(s.id)}
                        title="Remove"
                      >
                        <X className="size-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function NewStakeholderDialog({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState<StakeholderRole>('sponsor')
  const create = useCreateStakeholder(accountId)
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    await create.mutateAsync({
      name: String(f.get('name')),
      title: String(f.get('title') || '') || null,
      email: String(f.get('email') || ''),
      role,
    })
    setOpen(false)
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 text-xs">
          <Plus className="size-3.5" /> Add
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add stakeholder</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="Role">
            <Select value={role} onValueChange={(v) => setRole(v as StakeholderRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAKEHOLDER_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Name">
            <Input name="name" required autoFocus />
          </Field>
          <Field label="Title">
            <Input name="title" placeholder="VP Claims Operations" />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              Add
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
