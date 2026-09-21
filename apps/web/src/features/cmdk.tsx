import { useQuery } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { PHASE_LABELS, canTransition, phasesFor, type IssueStatus, type Phase } from '@tesseract/shared'
import { BarChart3, Bell, Building2, ChevronRight, Inbox, Layers, Plus, Radar, Rocket, Settings, Sparkles, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { StatusIcon } from './issues/icons'
import { useOpenNewIssue } from './issues/new-issue-dialog'
import { SideDot, UserAvatar } from '@/components/common'
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from '@/components/ui/command'
import { useMembers } from '@/lib/me'
import { engagementQuery, useChangePhase, useUpdateEngagement } from '@/lib/queries'
import { searchQuery } from '@/lib/queries-issues'

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [page, setPage] = useState<'root' | 'phase' | 'assign'>('root')
  const dq = useDebounced(q, 150)
  const navigate = useNavigate()
  const openNewIssue = useOpenNewIssue()
  const members = useMembers()
  const { data: results } = useQuery(searchQuery(dq))

  // Context: are we on an engagement page? Enables phase/assign actions.
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const engagementId = pathname.match(/^\/engagements\/([^/]+)/)?.[1]
  const { data: eng } = useQuery({ ...engagementQuery(engagementId ?? ''), enabled: !!engagementId && open })
  const changePhase = useChangePhase()
  const updateEng = useUpdateEngagement(engagementId ?? '')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') (e.preventDefault(), setOpen((o) => !o))
    }
    const onCustom = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    document.addEventListener('tesseract:cmdk', onCustom)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('tesseract:cmdk', onCustom)
    }
  }, [])
  useEffect(() => {
    if (!open) (setQ(''), setPage('root'))
  }, [open])

  const go = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Command palette" description="Jump anywhere or run an action" className="sm:max-w-xl">
      <Command loop>
      <CommandInput
        placeholder={page === 'phase' ? 'Move to phase…' : page === 'assign' ? 'Assign FDE…' : 'Search accounts, engagements, issues… or run an action'}
        value={q}
        onValueChange={setQ}
        onKeyDown={(e) => e.key === 'Backspace' && !q && page !== 'root' && setPage('root')}
      />
      <CommandList className="max-h-[420px]">
        <CommandEmpty>Nothing found.</CommandEmpty>

        {page === 'phase' && eng && (
          <CommandGroup heading={`Move ${eng.name}`}>
            {[...phasesFor(eng.side), ...(eng.side === 'presales' ? (['kickoff'] as Phase[]) : []), 'closed' as Phase].map((p) => {
              const verdict = canTransition(eng, p, eng.handoffs)
              return (
                <CommandItem key={p} value={PHASE_LABELS[p]} disabled={!verdict.ok} onSelect={go(() => changePhase.mutate({ id: eng.id, phase: p }))}>
                  <SideDot side={p === 'kickoff' ? 'postsales' : eng.side} /> {PHASE_LABELS[p]}
                  {!verdict.ok && <span className="ml-auto truncate text-[10px] text-muted-foreground">{verdict.reason}</span>}
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}

        {page === 'assign' && eng && (
          <CommandGroup heading="Assign FDE">
            {members.map((m) => (
              <CommandItem key={m.userId} value={m.name} onSelect={go(() => updateEng.mutate({ fdeId: m.userId }))}>
                <UserAvatar userId={m.userId} className="size-4" /> {m.name}
                <span className="ml-auto text-[10px] capitalize text-muted-foreground">{m.role.replace('_', ' ')}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {page === 'root' && (
          <>
            {results && (results.issues.length + results.engagements.length + results.accounts.length + results.gaps.length > 0) && (
              <>
                {results.engagements.length > 0 && (
                  <CommandGroup heading="Engagements">
                    {results.engagements.map((e) => (
                      <CommandItem key={e.id} value={`${e.name} ${e.accountKey} ${e.accountName}`} onSelect={go(() => navigate({ to: '/engagements/$id', params: { id: e.id } }))}>
                        <SideDot side={e.side} />
                        <span className="font-mono text-[10px] text-muted-foreground">{e.accountKey}</span> {e.name}
                        <span className="ml-auto text-[10px] text-muted-foreground">{PHASE_LABELS[e.phase]}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {results.issues.length > 0 && (
                  <CommandGroup heading="Issues">
                    {results.issues.map((i) => (
                      <CommandItem key={i.id} value={`${i.identifier} ${i.title}`} onSelect={go(() => navigate({ to: '.', search: (prev: Record<string, unknown>) => ({ ...prev, issue: i.id }) }))}>
                        <StatusIcon status={i.status as IssueStatus} />
                        <span className="font-mono text-[10px] text-muted-foreground">{i.identifier}</span> {i.title}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {results.accounts.length > 0 && (
                  <CommandGroup heading="Accounts">
                    {results.accounts.map((a) => (
                      <CommandItem key={a.id} value={`${a.name} ${a.key}`} onSelect={go(() => navigate({ to: '/accounts/$id', params: { id: a.id } }))}>
                        <Building2 className="size-3.5 text-muted-foreground" />
                        <span className="font-mono text-[10px] text-muted-foreground">{a.key}</span> {a.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {results.gaps.length > 0 && (
                  <CommandGroup heading="Product gaps">
                    {results.gaps.map((g) => (
                      <CommandItem key={g.id} value={g.title} onSelect={go(() => navigate({ to: '/gaps', search: { gap: g.id } }))}>
                        <Sparkles className="size-3.5 text-muted-foreground" /> {g.title}
                        <span className="ml-auto text-[10px] capitalize text-muted-foreground">{g.status}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                <CommandSeparator />
              </>
            )}

            <CommandGroup heading="Actions">
              <CommandItem value="new issue create" onSelect={go(() => openNewIssue(true))}>
                <Plus className="size-3.5" /> New issue <CommandShortcut>C</CommandShortcut>
              </CommandItem>
              {eng && (
                <>
                  <CommandItem value="move phase change" onSelect={() => (setQ(''), setPage('phase'))}>
                    <ChevronRight className="size-3.5" /> Move {eng.name} to phase…
                  </CommandItem>
                  <CommandItem value="assign fde" onSelect={() => (setQ(''), setPage('assign'))}>
                    <UserPlus className="size-3.5" /> Assign FDE…
                  </CommandItem>
                </>
              )}
            </CommandGroup>
            <CommandGroup heading="Go to">
              {[
                { to: '/attention', label: 'Attention', icon: Bell },
                { to: '/presales', label: 'Pre-sales board', icon: Radar },
                { to: '/postsales', label: 'Post-sales board', icon: Rocket },
                { to: '/accounts', label: 'Accounts', icon: Building2 },
                { to: '/issues', label: 'My issues', icon: Inbox },
                { to: '/threads', label: 'Threads', icon: Layers },
                { to: '/gaps', label: 'Product gaps', icon: Sparkles },
                { to: '/metrics', label: 'Metrics', icon: BarChart3 },
                { to: '/settings', label: 'Settings', icon: Settings },
              ].map((n) => (
                <CommandItem key={n.to} value={`go ${n.label}`} onSelect={go(() => navigate({ to: n.to }))}>
                  <n.icon className="size-3.5 text-muted-foreground" /> {n.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
      </Command>
    </CommandDialog>
  )
}
