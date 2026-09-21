import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { AuthShell } from '@/components/auth-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth-client'

export const Route = createFileRoute('/onboarding')({ component: Onboarding })

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

function Onboarding() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await authClient.organization.create({ name, slug: slugify(name) || 'workspace' })
    setBusy(false)
    if (error) return setError(error.message ?? 'Could not create organization')
    await qc.invalidateQueries({ queryKey: ['me'] })
    navigate({ to: '/' })
  }

  return (
    <AuthShell
      title="Name your organization"
      subtitle="This is your team's workspace. Teammates who sign up will join it automatically. If your team already has one, ask an admin to add you from Settings instead."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Organization name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="Acme AI" />
          {name && <p className="text-xs text-muted-foreground">tesseract/{slugify(name)}</p>}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy || !name}>
          {busy ? 'Creating…' : 'Create organization'}
        </Button>
      </form>
    </AuthShell>
  )
}
