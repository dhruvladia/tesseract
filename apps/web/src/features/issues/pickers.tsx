import { useQuery } from '@tanstack/react-query'
import { ISSUE_STATUSES, PRIORITIES, type IssueStatus, type Priority } from '@tesseract/shared'
import { cn } from 'cn'
import { Check, Tag } from 'lucide-react'
import { PRIORITY_LABELS, PriorityIcon, STATUS_LABELS, StatusIcon } from './icons'
import { UserAvatar, UserName } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useMembers } from '@/lib/me'
import { labelsQuery } from '@/lib/queries-issues'

type PickerProps<T> = { value: T; onChange: (v: T) => void; compact?: boolean; className?: string; open?: boolean; onOpenChange?: (o: boolean) => void }

function Trigger({ compact, className, children, ...rest }: React.ComponentProps<typeof Button> & { compact?: boolean }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn('h-7 gap-1.5 px-1.5 text-xs font-normal text-foreground/90', compact && 'size-6 p-0', className)}
      onClick={(e) => e.stopPropagation()}
      {...rest}
    >
      {children}
    </Button>
  )
}

export function StatusPicker({ value, onChange, compact, className, open, onOpenChange }: PickerProps<IssueStatus>) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Trigger compact={compact} className={className} title={STATUS_LABELS[value]}>
          <StatusIcon status={value} /> {!compact && STATUS_LABELS[value]}
        </Trigger>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0" align="start" onClick={(e) => e.stopPropagation()}>
        <Command>
          <CommandInput placeholder="Status…" />
          <CommandList>
            <CommandGroup>
              {ISSUE_STATUSES.map((s) => (
                <CommandItem key={s} value={STATUS_LABELS[s]} onSelect={() => onChange(s)}>
                  <StatusIcon status={s} /> {STATUS_LABELS[s]}
                  {s === value && <Check className="ml-auto size-3.5" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function PriorityPicker({ value, onChange, compact, className, open, onOpenChange }: PickerProps<Priority>) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Trigger compact={compact} className={className} title={PRIORITY_LABELS[value]}>
          <PriorityIcon priority={value} /> {!compact && PRIORITY_LABELS[value]}
        </Trigger>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0" align="start" onClick={(e) => e.stopPropagation()}>
        <Command>
          <CommandInput placeholder="Priority…" />
          <CommandList>
            <CommandGroup>
              {PRIORITIES.map((p, i) => (
                <CommandItem key={p} value={PRIORITY_LABELS[p]} onSelect={() => onChange(p)}>
                  <PriorityIcon priority={p} /> {PRIORITY_LABELS[p]}
                  <span className="ml-auto text-[10px] text-muted-foreground">{i}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function AssigneePicker({ value, onChange, compact, className, open, onOpenChange }: PickerProps<string | null>) {
  const members = useMembers()
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Trigger compact={compact} className={className} title="Assignee">
          <UserAvatar userId={value} className="size-4" /> {!compact && <UserName userId={value} />}
        </Trigger>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start" onClick={(e) => e.stopPropagation()}>
        <Command>
          <CommandInput placeholder="Assign to…" autoFocus />
          <CommandList>
            <CommandEmpty>No one found.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="Unassigned" onSelect={() => onChange(null)}>
                <span className="size-4 rounded-full border border-dashed border-border" /> Unassigned
                {!value && <Check className="ml-auto size-3.5" />}
              </CommandItem>
              {members.map((m) => (
                <CommandItem key={m.userId} value={m.name} onSelect={() => onChange(m.userId)}>
                  <UserAvatar userId={m.userId} className="size-4" /> {m.name}
                  {m.userId === value && <Check className="ml-auto size-3.5" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function LabelPicker({ value, onChange, className }: { value: string[]; onChange: (ids: string[]) => void; className?: string }) {
  const { data: labels = [] } = useQuery(labelsQuery)
  const selected = labels.filter((l) => value.includes(l.id))
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Trigger className={cn('flex-wrap', className)} title="Labels">
          {selected.length === 0 ? (
            <>
              <Tag className="size-3.5 text-muted-foreground" /> <span className="text-muted-foreground">Labels</span>
            </>
          ) : (
            selected.map((l) => <LabelChip key={l.id} name={l.name} color={l.color} />)
          )}
        </Trigger>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder="Labels…" />
          <CommandList>
            <CommandEmpty>No labels. Create them in Settings.</CommandEmpty>
            <CommandGroup>
              {labels.map((l) => {
                const on = value.includes(l.id)
                return (
                  <CommandItem key={l.id} value={l.name} onSelect={() => onChange(on ? value.filter((v) => v !== l.id) : [...value, l.id])}>
                    <span className="size-2.5 rounded-full" style={{ background: l.color }} /> {l.name}
                    {on && <Check className="ml-auto size-3.5" />}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function LabelChip({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-1.5 py-px text-[10px]">
      <span className="size-1.5 rounded-full" style={{ background: color }} /> {name}
    </span>
  )
}
