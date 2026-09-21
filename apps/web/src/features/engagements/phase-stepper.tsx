import { ENGAGEMENT_OUTCOMES, PHASE_LABELS, canTransition, phasesFor, type EngagementOutcome, type Phase } from '@tesseract/shared'
import { cn } from 'cn'
import { ArrowRight, Check, Lock } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useChangePhase, type EngagementDetail } from '@/lib/queries'

export function PhaseStepper({ e }: { e: EngagementDetail }) {
  const change = useChangePhase()
  const phases = phasesFor(e.side)
  const idx = phases.indexOf(e.phase)
  const [closing, setClosing] = useState(false)
  const [outcome, setOutcome] = useState<EngagementOutcome>(e.side === 'presales' ? 'lost' : 'handed_off')
  const closed = e.phase === 'closed'

  const convert = e.side === 'presales' ? canTransition(e, 'kickoff', e.handoffs) : null
  const close = canTransition(e, 'closed', e.handoffs)

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {phases.map((p, i) => {
        const verdict = canTransition(e, p, e.handoffs)
        const current = p === e.phase
        const done = !closed && i < idx
        return (
          <Tooltip key={p}>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled={!verdict.ok || current || change.isPending}
                onClick={() => change.mutate({ id: e.id, phase: p })}
                className={cn(
                  'relative inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition',
                  current ? 'border-transparent text-foreground' : 'border-border/40 text-muted-foreground',
                  !current && !done && 'hover:border-border hover:text-foreground',
                  !verdict.ok && !current && 'cursor-not-allowed opacity-50',
                )}
              >
                {current && (
                  <motion.span
                    layoutId="phase-current"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    className={cn('absolute inset-0 rounded-full border', e.side === 'presales' ? 'border-presales/60 bg-presales/15' : 'border-postsales/60 bg-postsales/15')}
                  />
                )}
                <span className="relative inline-flex items-center gap-1.5">
                  {done && <Check className="size-3" />}
                  {PHASE_LABELS[p as Phase]}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent>{current ? 'Current phase' : verdict.ok ? `Move to ${PHASE_LABELS[p as Phase]}` : verdict.reason}</TooltipContent>
          </Tooltip>
        )
      })}

      {closed ? (
        <span className="ml-2 rounded-full border border-border/60 px-2.5 py-1 text-xs text-muted-foreground">
          Closed{e.outcome && ` · ${e.outcome.replace('_', ' ')}`}
        </span>
      ) : (
        <div className="ml-2 flex items-center gap-1.5">
          {convert && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={convert.ok ? 'default' : 'outline'}
                  className="h-7 text-xs"
                  disabled={!convert.ok || change.isPending}
                  onClick={() => change.mutate({ id: e.id, phase: 'kickoff' })}
                >
                  {convert.ok ? <ArrowRight className="size-3.5" /> : <Lock className="size-3.5" />} Convert to post-sales
                </Button>
              </TooltipTrigger>
              <TooltipContent>{convert.ok ? 'Won. Moves this engagement to Kickoff.' : convert.reason}</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" disabled={!close.ok} onClick={() => setClosing(true)}>
                {!close.ok && <Lock className="size-3.5" />} Close
              </Button>
            </TooltipTrigger>
            <TooltipContent>{close.ok ? 'Close this engagement' : close.reason}</TooltipContent>
          </Tooltip>
        </div>
      )}

      <Dialog open={closing} onOpenChange={setClosing}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Close engagement</DialogTitle>
            <DialogDescription>Record why this engagement ended. It leaves the board but stays on the account.</DialogDescription>
          </DialogHeader>
          <Select value={outcome} onValueChange={(v) => setOutcome(v as EngagementOutcome)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENGAGEMENT_OUTCOMES.filter((o) => o !== 'won').map((o) => (
                <SelectItem key={o} value={o} className="capitalize">
                  {o.replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setClosing(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                await change.mutateAsync({ id: e.id, phase: 'closed', outcome })
                setClosing(false)
              }}
            >
              Close engagement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
