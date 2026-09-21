import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { MEMBER_ROLES, MEMBER_ROLE_LABELS, type MemberRole } from '@tesseract/shared'
import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field, PageHeader, UserAvatar } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api, unwrap } from '@/lib/api'
import { useMe } from '@/lib/me'
import { labelsQuery, useCreateLabel, useDeleteLabel } from '@/lib/queries-issues'

export const Route = createFileRoute('/_app/settings')({ component: SettingsPage })

const ROLE_HELP: Record<MemberRole, string> = {
  owner: 'Created the workspace',
  admin: 'Manages members and settings',
  fde: 'Builds; owns the technical outcome',
  engagement_manager: 'Owns stakeholders, sequencing, adoption',
  account_exec: 'Owns the commercial decision',
  csm: 'Receives the post-sales handoff',
  product: 'Triages and ships product gaps',
}

function SettingsPage() {
  const me = useMe()
  const qc = useQueryClient()
  const isAdmin = me.role === 'owner' || me.role === 'admin'
  const invalidate = () => qc.invalidateQueries({ queryKey: ['me'] })
  const onError = (e: Error) => toast.error(e.message)

  const rename = useMutation({ mutationFn: (name: string) => unwrap(api.members.org.$patch({ json: { name } })), onSuccess: invalidate, onError })
  const add = useMutation({
    mutationFn: (json: { email: string; role: Exclude<MemberRole, 'owner'> }) => unwrap(api.members.$post({ json })),
    onSuccess: () => {
      invalidate()
      toast.success('Member added')
    },
    onError,
  })
  const setRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Exclude<MemberRole, 'owner'> }) => unwrap(api.members[':userId'].$patch({ param: { userId }, json: { role } })),
    onSuccess: invalidate,
    onError,
  })
  const remove = useMutation({ mutationFn: (userId: string) => unwrap(api.members[':userId'].$delete({ param: { userId } })), onSuccess: invalidate, onError })
  const [newRole, setNewRole] = useState<Exclude<MemberRole, 'owner'>>('fde')

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Settings" subtitle={me.organization.name} />
      <div className="max-w-3xl space-y-10 overflow-auto p-5">
        <section>
          <h2 className="mb-3 text-sm font-semibold">Organization</h2>
          <Field label="Name">
            <Input
              key={me.organization.name}
              defaultValue={me.organization.name}
              disabled={!isAdmin}
              className="max-w-sm"
              onBlur={(e) => e.target.value.trim() && e.target.value !== me.organization.name && rename.mutate(e.target.value.trim())}
            />
          </Field>
        </section>

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Members</h2>
            <span className="text-xs text-muted-foreground">{me.members.length} people</span>
          </div>
          <ul className="divide-y divide-border/40 rounded-lg border border-border/50">
            {me.members.map((m) => (
              <li key={m.userId} className="flex items-center gap-3 px-3 py-2 text-sm">
                <UserAvatar userId={m.userId} className="size-7" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {m.name} {m.userId === me.userId && <span className="text-xs text-muted-foreground">(you)</span>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{m.email}</div>
                </div>
                {isAdmin && m.role !== 'owner' ? (
                  <Select value={m.role} onValueChange={(v) => setRole.mutate({ userId: m.userId, role: v as Exclude<MemberRole, 'owner'> })}>
                    <SelectTrigger className="h-8 w-48 text-xs">
                      <SelectValue>{MEMBER_ROLE_LABELS[m.role as MemberRole] ?? m.role}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {MEMBER_ROLES.filter((r) => r !== 'owner').map((r) => (
                        <SelectItem key={r} value={r}>
                          <span className="flex flex-col">
                            <span>{MEMBER_ROLE_LABELS[r]}</span>
                            <span className="text-[10px] text-muted-foreground">{ROLE_HELP[r]}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="w-48 text-right text-xs text-muted-foreground">{MEMBER_ROLE_LABELS[m.role as MemberRole] ?? m.role}</span>
                )}
                {isAdmin && m.role !== 'owner' && m.userId !== me.userId && (
                  <button type="button" onClick={() => confirm(`Remove ${m.name}?`) && remove.mutate(m.userId)} title="Remove">
                    <X className="size-4 text-muted-foreground hover:text-destructive" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {isAdmin && (
            <form
              className="mt-3 flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                const f = new FormData(e.currentTarget)
                add.mutate({ email: String(f.get('email')), role: newRole })
                e.currentTarget.reset()
              }}
            >
              <Field label="Add a member who has signed up">
                <Input name="email" type="email" required placeholder="teammate@company.com" className="h-8 w-64" />
              </Field>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as Exclude<MemberRole, 'owner'>)}>
                <SelectTrigger className="h-8 w-44 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEMBER_ROLES.filter((r) => r !== 'owner').map((r) => (
                    <SelectItem key={r} value={r}>
                      {MEMBER_ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" size="sm" className="h-8" disabled={add.isPending}>
                <Plus className="size-3.5" /> Add
              </Button>
              <p className="w-full text-[11px] text-muted-foreground">
                New sign-ups join this workspace automatically unless the API runs with <code>AUTO_JOIN=false</code>.
              </p>
            </form>
          )}
        </section>

        <Labels />

        <section>
          <h2 className="mb-1 text-sm font-semibold">AI-assisted handoffs</h2>
          {me.ai.enabled ? (
            <p className="text-sm text-muted-foreground">
              Enabled. Drafts are generated with <code className="text-foreground">{me.ai.provider}/{me.ai.model}</code>. Pasted notes are sent to that provider and stored with
              the engagement. The model proposes; a person applies. Items without a verbatim quote in the notes are flagged and never applied by default.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Not configured. Set <code className="text-foreground">LLM_PROVIDER</code> (anthropic, openai, or openai-compatible), <code className="text-foreground">LLM_MODEL</code>,{' '}
              <code className="text-foreground">LLM_API_KEY</code> (and <code className="text-foreground">LLM_BASE_URL</code> for compatible endpoints) on the API to enable
              “Draft from notes” on the Handoffs tab.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

function Labels() {
  const { data: labels = [] } = useQuery(labelsQuery)
  const create = useCreateLabel()
  const del = useDeleteLabel()
  const [color, setColor] = useState('#8b7cf6')
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">Labels</h2>
      <div className="flex flex-wrap gap-2">
        {labels.map((l) => (
          <span key={l.id} className="group inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1 text-xs">
            <span className="size-2 rounded-full" style={{ background: l.color }} /> {l.name}
            <button type="button" onClick={() => del.mutate(l.id)} className="opacity-0 group-hover:opacity-100" title="Delete">
              <X className="size-3 text-muted-foreground hover:text-destructive" />
            </button>
          </span>
        ))}
        {labels.length === 0 && <span className="text-xs text-muted-foreground">No labels yet.</span>}
      </div>
      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const f = new FormData(e.currentTarget)
          create.mutate({ name: String(f.get('name')), color })
          e.currentTarget.reset()
        }}
      >
        <Field label="New label">
          <Input name="name" required placeholder="eval, data-access, security-review" className="h-8 w-56" />
        </Field>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="size-8 cursor-pointer rounded-md border border-border bg-transparent" />
        <Button type="submit" size="sm" className="h-8" disabled={create.isPending}>
          <Plus className="size-3.5" /> Add
        </Button>
      </form>
    </section>
  )
}
