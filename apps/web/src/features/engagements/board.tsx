import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { PHASE_LABELS, allowedTargets, phasesFor, type Phase, type Side } from '@tesseract/shared'
import { cn } from 'cn'
import { format } from 'date-fns'
import { AlertTriangle, Flag } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { NewEngagementDialog } from './new-engagement-dialog'
import { EmptyState, UserAvatar, daysSince } from '@/components/common'
import { engagementsQuery, useChangePhase, type EngagementListItem } from '@/lib/queries'
import { useAttentionByEngagement } from '@/lib/queries-attention'

export function EngagementBoard({ side }: { side: Side }) {
  const { data = [], isLoading } = useQuery(engagementsQuery(side))
  const change = useChangePhase()
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const phases = phasesFor(side)
  const active = data.find((e) => e.id === activeId)
  const targets = useMemo(() => (active ? new Set(allowedTargets(active, active.handoffs)) : null), [active])

  function onDragEnd(ev: DragEndEvent) {
    setActiveId(null)
    const to = ev.over?.id as Phase | undefined
    const e = data.find((x) => x.id === ev.active.id)
    if (!e || !to || to === e.phase || !targets?.has(to)) return
    change.mutate({ id: e.id, phase: to })
  }

  if (!isLoading && data.length === 0) {
    return (
      <EmptyState
        preset={side}
        title={side === 'presales' ? 'No pre-sales engagements yet' : 'No post-sales engagements yet'}
        description={
          side === 'presales'
            ? 'Qualify an opportunity, discover the real workflow, scope the smallest valuable proof, prototype on real data, and win the technical decision.'
            : 'Post-sales engagements arrive here when a pre-sales engagement converts through a handoff, or you can start one directly.'
        }
        action={<NewEngagementDialog side={side} />}
      />
    )
  }

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="flex h-full gap-3 overflow-x-auto p-4">
        {phases.map((p) => (
          <Column key={p} phase={p} side={side} droppable={!active || targets?.has(p) === true} items={data.filter((e) => e.phase === p)} />
        ))}
        {active && (
          <Column phase="closed" side={side} droppable={targets?.has('closed') === true} items={[]} ghost />
        )}
      </div>
      <DragOverlay dropAnimation={null}>{active ? <Card e={active} overlay /> : null}</DragOverlay>
    </DndContext>
  )
}

function Column({ phase, side, items, droppable, ghost }: { phase: Phase; side: Side; items: EngagementListItem[]; droppable: boolean; ghost?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: phase, disabled: !droppable })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-64 shrink-0 flex-col rounded-xl border border-border/50 bg-card/30 transition-colors',
        isOver && droppable && 'border-primary/60 bg-primary/5',
        !droppable && 'opacity-40',
        ghost && 'border-dashed',
      )}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-medium">
          <span className={cn('size-1.5 rounded-full', ghost ? 'bg-muted-foreground' : side === 'presales' ? 'bg-presales' : 'bg-postsales')} />
          {PHASE_LABELS[phase]}
        </div>
        <span className="text-[11px] tabular-nums text-muted-foreground">{items.length}</span>
      </div>
      <div className="flex-1 space-y-2 px-2 pb-2">
        {items.map((e) => (
          <DraggableCard key={e.id} e={e} />
        ))}
        {ghost && <p className="px-2 py-6 text-center text-[11px] text-muted-foreground">Drop here to close (lost / deferred / handed off)</p>}
      </div>
    </div>
  )
}

function DraggableCard({ e }: { e: EngagementListItem }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: e.id })
  return (
    <motion.div
      ref={setNodeRef}
      layout
      layoutId={e.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: isDragging ? 0.3 : 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
      {...listeners}
      {...attributes}
    >
      <Card e={e} />
    </motion.div>
  )
}

export function Card({ e, overlay }: { e: EngagementListItem; overlay?: boolean }) {
  const attention = useAttentionByEngagement().get(e.id)
  const days = daysSince(e.phaseEnteredAt)
  const next = e.milestones.find((m) => !m.completedAt)
  const blocking = e.handoffs.reduce((n, h) => n + h.gaps.filter((g) => g.severity === 'blocking' && !g.resolvedAt).length, 0)
  const gapBlockers = e.gaps.filter((g) => g.impact === 'blocker').length
  return (
    <Link
      to="/engagements/$id"
      params={{ id: e.id }}
      className={cn(
        'block rounded-lg border border-border/60 bg-card p-3 text-left shadow-sm transition hover:border-border hover:bg-accent/40',
        overlay && 'rotate-1 shadow-xl ring-1 ring-primary/40',
      )}
      onClick={(ev) => overlay && ev.preventDefault()}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {attention && (
            <span
              className={cn('size-1.5 rounded-full', attention.severity === 'high' ? 'bg-destructive' : attention.severity === 'medium' ? 'bg-postsales' : 'bg-muted-foreground/60')}
              title={`${attention.count} item${attention.count === 1 ? '' : 's'} need attention`}
            />
          )}
          {e.account.key}
        </span>
        <span className={cn('text-[10px] tabular-nums', days > 21 ? 'text-postsales' : 'text-muted-foreground')} title="Days in phase">
          {days}d
        </span>
      </div>
      <div className="mt-1 text-sm font-medium leading-tight">{e.name}</div>
      <div className="truncate text-xs text-muted-foreground">{e.account.name}</div>
      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex -space-x-1.5">
          <UserAvatar userId={e.fdeId} className="size-5 ring-2 ring-card" />
          <UserAvatar userId={e.engagementManagerId} className="size-5 ring-2 ring-card" />
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {next && (
            <span className="inline-flex items-center gap-1" title={next.title}>
              <Flag className="size-3" /> {next.targetDate ? format(new Date(next.targetDate), 'MMM d') : next.title}
            </span>
          )}
          {blocking + gapBlockers > 0 && (
            <span className="inline-flex items-center gap-1 text-destructive" title="Blocking gaps">
              <AlertTriangle className="size-3" /> {blocking + gapBlockers}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
