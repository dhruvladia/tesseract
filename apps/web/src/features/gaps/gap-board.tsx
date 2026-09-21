import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { PRODUCT_GAP_STATUSES, type ProductGapStatus } from '@tesseract/shared'
import { cn } from 'cn'
import { AlertTriangle, Building2, Layers } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { NewGapDialog } from './new-gap-dialog'
import { EmptyState, money } from '@/components/common'
import { gapsQuery, useUpdateGap, type GapListItem } from '@/lib/queries-gaps'

export const GAP_STATUS_LABELS: Record<ProductGapStatus, string> = {
  raised: 'Raised',
  triaged: 'Triaged',
  accepted: 'Accepted',
  shipped: 'Shipped',
  declined: 'Declined',
}
const HINTS: Record<ProductGapStatus, string> = {
  raised: 'Fresh from the field',
  triaged: 'Product has looked',
  accepted: 'On the roadmap',
  shipped: 'In the core product',
  declined: 'Not generalizable',
}

/** Kanban by status. Drop on a column to change status; drop on a card to cluster under it. */
export function GapBoard() {
  const { data = [], isLoading } = useQuery(gapsQuery)
  const update = useUpdateGap()
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const active = data.find((g) => g.id === activeId)
  const roots = data.filter((g) => !g.parentId)
  const childrenOf = (id: string) => data.filter((g) => g.parentId === id)

  function onDragEnd(ev: DragEndEvent) {
    setActiveId(null)
    const g = data.find((x) => x.id === ev.active.id)
    const over = ev.over?.id as string | undefined
    if (!g || !over) return
    if ((PRODUCT_GAP_STATUSES as readonly string[]).includes(over)) {
      if (over !== g.status) update.mutate({ id: g.id, status: over as ProductGapStatus })
      return
    }
    // dropped on a card -> cluster under it (server enforces one level)
    const target = data.find((x) => x.id === over)
    if (target && target.id !== g.id && target.id !== g.parentId) update.mutate({ id: g.id, parentId: target.parentId ?? target.id })
  }

  if (!isLoading && data.length === 0)
    return (
      <EmptyState
        preset="ember"
        title="No product gaps yet"
        description="Every missing connector, primitive or workflow you hit in the field is a signal. Raise it, tie it to the engagements and revenue it blocks, and track it until it ships back into the product."
        action={<NewGapDialog />}
      />
    )

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="flex h-full gap-3 overflow-x-auto p-4">
        {PRODUCT_GAP_STATUSES.map((s) => (
          <Column key={s} status={s} items={roots.filter((g) => g.status === s)} childrenOf={childrenOf} dragging={!!active} />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>{active ? <GapCard g={active} childCount={childrenOf(active.id).length} overlay /> : null}</DragOverlay>
    </DndContext>
  )
}

function Column({ status, items, childrenOf, dragging }: { status: ProductGapStatus; items: GapListItem[]; childrenOf: (id: string) => GapListItem[]; dragging: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const arr = items.reduce((n, g) => n + (g.arrInfluenced ?? 0), 0)
  return (
    <div ref={setNodeRef} className={cn('flex w-64 shrink-0 flex-col rounded-xl border border-border/50 bg-card/30 transition-colors', isOver && 'border-primary/60 bg-primary/5')}>
      <div className="px-3 py-2">
        <div className="flex items-center justify-between text-xs font-medium">
          {GAP_STATUS_LABELS[status]}
          <span className="tabular-nums text-muted-foreground">{items.length}</span>
        </div>
        <div className="text-[10px] text-muted-foreground">{arr > 0 ? `${money(arr)} influenced` : HINTS[status]}</div>
      </div>
      <div className="flex-1 space-y-2 px-2 pb-2">
        {items.map((g) => (
          <DraggableCard key={g.id} g={g} children={childrenOf(g.id)} dragging={dragging} />
        ))}
      </div>
    </div>
  )
}

function DraggableCard({ g, children, dragging }: { g: GapListItem; children: GapListItem[]; dragging: boolean }) {
  const drag = useDraggable({ id: g.id })
  const drop = useDroppable({ id: g.id, disabled: !dragging })
  return (
    <motion.div
      ref={(el) => {
        drag.setNodeRef(el)
        drop.setNodeRef(el)
      }}
      layout
      layoutId={g.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: drag.isDragging ? 0.3 : 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
      {...drag.listeners}
      {...drag.attributes}
      className={cn('rounded-lg', drop.isOver && 'ring-2 ring-primary/60')}
    >
      <GapCard g={g} childCount={children.length} />
      {children.length > 0 && (
        <ul className="ml-3 mt-1 space-y-1 border-l border-border/50 pl-2">
          {children.map((c) => (
            <li key={c.id}>
              <DraggableChild g={c} />
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  )
}

function DraggableChild({ g }: { g: GapListItem }) {
  const drag = useDraggable({ id: g.id })
  const navigate = useNavigate()
  return (
    <button
      ref={drag.setNodeRef}
      {...drag.listeners}
      {...drag.attributes}
      type="button"
      onClick={() => navigate({ to: '/gaps', search: { gap: g.id } })}
      className={cn('flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground', drag.isDragging && 'opacity-30')}
    >
      <span className="flex-1 truncate">{g.title}</span>
      {g.engagementCount > 0 && <span className="tabular-nums">{g.engagementCount}</span>}
    </button>
  )
}

export function GapCard({ g, childCount, overlay }: { g: GapListItem; childCount: number; overlay?: boolean }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => !overlay && navigate({ to: '/gaps', search: { gap: g.id } })}
      className={cn(
        'block w-full rounded-lg border border-border/60 bg-card p-3 text-left shadow-sm transition hover:border-border hover:bg-accent/40',
        overlay && 'rotate-1 shadow-xl ring-1 ring-primary/40',
      )}
    >
      <div className="text-sm font-medium leading-tight">{g.title}</div>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1" title="Engagements hitting this gap">
          <Building2 className="size-3" /> {g.engagementCount}
        </span>
        {g.arrInfluenced ? <span className="tabular-nums">{money(g.arrInfluenced)}</span> : null}
        {g.blockerCount > 0 && (
          <span className="inline-flex items-center gap-1 text-destructive" title="Blocking an engagement">
            <AlertTriangle className="size-3" /> {g.blockerCount}
          </span>
        )}
        {childCount > 0 && (
          <span className="ml-auto inline-flex items-center gap-1" title="Clustered gaps">
            <Layers className="size-3" /> {childCount}
          </span>
        )}
      </div>
    </button>
  )
}
