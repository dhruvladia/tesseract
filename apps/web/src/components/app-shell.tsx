import { Link, useNavigate } from '@tanstack/react-router'
import { Building2, Inbox, Layers, LogOut, Radar, Rocket, Settings, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from 'cn'
import { Logo } from './auth-shell'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Button } from './ui/button'
import { Kbd } from './ui/kbd'
import { authClient } from '@/lib/auth-client'
import { useMe } from '@/lib/me'

const nav = [
  { to: '/presales', label: 'Pre-sales', icon: Radar, tone: 'text-presales' },
  { to: '/postsales', label: 'Post-sales', icon: Rocket, tone: 'text-postsales' },
  { to: '/accounts', label: 'Accounts', icon: Building2 },
  { to: '/issues', label: 'My issues', icon: Inbox },
  { to: '/threads', label: 'Threads', icon: Layers },
  { to: '/gaps', label: 'Product gaps', icon: Sparkles },
] as const

export function AppShell({ children }: { children: ReactNode }) {
  const me = useMe()
  const navigate = useNavigate()
  const self = me.members.find((m) => m.userId === me.userId)

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <aside className="flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex h-12 items-center gap-2 px-4">
          <Logo className="size-5" />
          <span className="truncate text-sm font-semibold tracking-tight">{me.organization.name}</span>
        </div>
        <button
          type="button"
          onClick={() => document.dispatchEvent(new CustomEvent('tesseract:cmdk'))}
          className="mx-3 mb-2 flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent/60"
        >
          <span>Search or jump to…</span>
          <Kbd>⌘K</Kbd>
        </button>
        <nav className="flex-1 space-y-0.5 px-2">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              activeProps={{ className: 'bg-sidebar-accent text-sidebar-foreground' }}
            >
              <n.icon className={cn('size-4', 'tone' in n ? n.tone : 'text-muted-foreground')} />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-2">
          <Link
            to="/settings"
            className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent"
            activeProps={{ className: 'bg-sidebar-accent text-sidebar-foreground' }}
          >
            <Settings className="size-4 text-muted-foreground" /> Settings
          </Link>
          <div className="mt-1 flex items-center gap-2 px-2.5 py-1.5">
            <Avatar className="size-6">
              <AvatarImage src={self?.image ?? undefined} />
              <AvatarFallback className="text-[10px]">{initials(self?.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">{self?.name}</div>
              <div className="truncate text-[10px] text-muted-foreground">{self?.role.replace('_', ' ')}</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              title="Sign out"
              onClick={async () => {
                await authClient.signOut()
                navigate({ to: '/login' })
              }}
            >
              <LogOut className="size-3.5" />
            </Button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-auto">{children}</main>
    </div>
  )
}

export function initials(name?: string | null) {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}
