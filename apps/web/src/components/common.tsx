import { PHASE_LABELS, type Phase, type Side } from '@tesseract/shared'
import { cn } from 'cn'
import { differenceInCalendarDays } from 'date-fns'
import type { ReactNode } from 'react'
import { initials } from './app-shell'
import { Orbs } from './orbs'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { useMember, useMembers } from '@/lib/me'

export function UserAvatar({ userId, className = 'size-5' }: { userId: string | null | undefined; className?: string }) {
  const m = useMember(userId)
  if (!m) return <span className={cn('rounded-full border border-dashed border-border', className)} />
  return (
    <Avatar className={className} title={m.name}>
      <AvatarImage src={m.image ?? undefined} />
      <AvatarFallback className="text-[9px]">{initials(m.name)}</AvatarFallback>
    </Avatar>
  )
}

export function UserName({ userId, fallback = 'Unassigned' }: { userId: string | null | undefined; fallback?: string }) {
  const m = useMember(userId)
  return <span className={cn(!m && 'text-muted-foreground')}>{m?.name ?? fallback}</span>
}

const NONE = '__none__'

export function MemberPicker({
  value,
  onChange,
  placeholder = 'Unassigned',
  filterRole,
  className,
}: {
  value: string | null | undefined
  onChange: (v: string | null) => void
  placeholder?: string
  filterRole?: string[]
  className?: string
}) {
  const members = useMembers().filter((m) => !filterRole || filterRole.includes(m.role) || m.role === 'owner' || m.role === 'admin')
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger className={cn('h-8', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>
          <span className="text-muted-foreground">{placeholder}</span>
        </SelectItem>
        {members.map((m) => (
          <SelectItem key={m.userId} value={m.userId}>
            <span className="flex items-center gap-2">
              <UserAvatar userId={m.userId} className="size-4" /> {m.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function SideDot({ side, className }: { side: Side; className?: string }) {
  return <span className={cn('inline-block size-2 rounded-full', side === 'presales' ? 'bg-presales' : 'bg-postsales', className)} />
}

export function PhasePill({ phase, side }: { phase: Phase; side: Side }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/40 px-2 py-0.5 text-[11px] font-medium">
      <SideDot side={side} />
      {PHASE_LABELS[phase]}
    </span>
  )
}

export function daysSince(date: string | Date) {
  return differenceInCalendarDays(new Date(), new Date(date))
}

export function PageHeader({ title, subtitle, actions, className }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex h-12 shrink-0 items-center justify-between border-b border-border/60 px-5', className)}>
      <div className="flex min-w-0 items-baseline gap-2">
        <h1 className="whitespace-nowrap text-sm font-semibold tracking-tight">{title}</h1>
        {subtitle && <span className="min-w-0 truncate text-xs text-muted-foreground">{subtitle}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  preset = 'ember',
}: {
  title: string
  description?: string
  action?: ReactNode
  preset?: 'aurora' | 'presales' | 'postsales' | 'ember'
}) {
  return (
    <div className="relative m-6 grid min-h-[320px] place-items-center overflow-hidden rounded-2xl border border-border/60">
      <Orbs preset={preset} opacity={0.35} />
      <div className="relative max-w-sm text-center">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground/80">{hint}</span>}
    </label>
  )
}

export function money(v: string | number | null | undefined) {
  if (v == null || v === '') return null
  const n = Number(v)
  if (Number.isNaN(n)) return null
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0, notation: n >= 1e6 ? 'compact' : 'standard' }).format(n)
}
