import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Field, SideDot } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { engagementsQuery } from '@/lib/queries'
import { useCreateThread } from '@/lib/queries-issues'

const INTERNAL = '__internal__'
const SUGGESTED = ['Discovery', 'Data access', 'Prototype', 'Hardening', 'Enablement', 'Handoff']

export function NewThreadDialog({ engagementId, trigger, stay }: { engagementId?: string | null; trigger?: ReactNode; stay?: boolean }) {
  const [open, setOpen] = useState(false)
  const [eng, setEng] = useState(engagementId ?? INTERNAL)
  const [name, setName] = useState('')
  const { data: engagements = [] } = useQuery({ ...engagementsQuery(), enabled: !engagementId })
  const create = useCreateThread()
  const navigate = useNavigate()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const row = await create.mutateAsync({ name, engagementId: eng === INTERNAL ? null : eng })
    setOpen(false)
    setName('')
    if (!stay) navigate({ to: '/threads/$id', params: { id: row.id } })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="size-4" /> New thread
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New thread</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {!engagementId && (
            <Field label="Engagement" hint="Internal threads get INT- identifiers.">
              <Select value={eng} onValueChange={setEng}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={INTERNAL}>Internal (no customer)</SelectItem>
                  {engagements.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      <span className="flex items-center gap-2">
                        <SideDot side={e.side} />
                        <span className="font-mono text-xs text-muted-foreground">{e.account.key}</span> {e.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="Discovery" />
          </Field>
          <div className="flex flex-wrap gap-1">
            {SUGGESTED.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setName(s)}
                className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground hover:border-border hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || !name.trim()}>
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
