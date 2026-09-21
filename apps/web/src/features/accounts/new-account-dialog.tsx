import { useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Field } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useCreateAccount } from '@/lib/queries'

const suggestKey = (name: string) =>
  name
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!)
    .join('')
    .toUpperCase()
    .slice(0, 4)
    .padEnd(2, 'X')

export function NewAccountDialog({ trigger }: { trigger?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [touchedKey, setTouchedKey] = useState(false)
  const create = useCreateAccount()
  const navigate = useNavigate()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const row = await create.mutateAsync({
      name,
      key: key || suggestKey(name),
      domain: String(f.get('domain') || '') || null,
      arr: String(f.get('arr') || '') || null,
    })
    setOpen(false)
    navigate({ to: '/accounts/$id', params: { id: row.id } })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="size-4" /> New account
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New customer account</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Company">
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (!touchedKey) setKey(suggestKey(e.target.value))
              }}
              required
              autoFocus
              placeholder="Northwind Bank"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Key" hint="Prefix for issue IDs, e.g. NWB-12">
              <Input
                value={key}
                onChange={(e) => {
                  setTouchedKey(true)
                  setKey(e.target.value.toUpperCase())
                }}
                pattern="[A-Z][A-Z0-9]{1,5}"
                className="font-mono uppercase"
                required
              />
            </Field>
            <Field label="ARR (USD)">
              <Input name="arr" type="number" min={0} step={1000} placeholder="250000" />
            </Field>
          </div>
          <Field label="Domain">
            <Input name="domain" placeholder="northwind.com" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
