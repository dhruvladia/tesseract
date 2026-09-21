import { useQuery } from '@tanstack/react-query'
import { GAP_IMPACTS, type GapImpact } from '@tesseract/shared'
import { Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Field, SideDot } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { engagementsQuery } from '@/lib/queries'
import { gapsQuery, useCreateGap, useLinkGap } from '@/lib/queries-gaps'

export const IMPACT_LABELS: Record<GapImpact, string> = { blocker: 'Blocks the engagement', major: 'Major workaround', minor: 'Minor friction' }
const NONE = '__none__'
const NEW = '__new__'

/** Raise a new gap, optionally from an engagement (Signals tab), or link an existing one. */
export function NewGapDialog({ engagementId, trigger }: { engagementId?: string; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [existing, setExisting] = useState(NEW)
  const [eng, setEng] = useState(engagementId ?? NONE)
  const [impact, setImpact] = useState<GapImpact>('major')
  const { data: engagements = [] } = useQuery({ ...engagementsQuery(), enabled: !engagementId })
  const { data: gaps = [] } = useQuery({ ...gapsQuery, enabled: !!engagementId })
  const create = useCreateGap()
  const { link } = useLinkGap(existing === NEW ? '' : existing)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const arr = String(f.get('arr') || '') || null
    const target = eng === NONE ? null : eng
    if (existing !== NEW && target) {
      await link.mutateAsync({ engagementId: target, impact, arrInfluenced: arr, note: String(f.get('note') || '') || null })
    } else {
      await create.mutateAsync({
        title: String(f.get('title')),
        description: String(f.get('description') || '') || null,
        engagementId: target,
        impact: target ? impact : undefined,
        arrInfluenced: target ? arr : null,
      })
    }
    setOpen(false)
    setExisting(NEW)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="size-4" /> Raise gap
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{engagementId ? 'Raise a product gap from this engagement' : 'Raise a product gap'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {engagementId && gaps.length > 0 && (
            <Field label="Gap">
              <Select value={existing} onValueChange={setExisting}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NEW}>New gap…</SelectItem>
                  {gaps
                    .filter((g) => g.status !== 'shipped' && g.status !== 'declined')
                    .map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {existing === NEW && (
            <>
              <Field label="What is missing?">
                <Input name="title" required autoFocus placeholder="Batch inference endpoint for nightly reprocessing" />
              </Field>
              <Field label="Context" hint="The job the customer is trying to do, not the feature they asked for.">
                <Textarea name="description" rows={3} />
              </Field>
            </>
          )}
          {!engagementId && (
            <Field label="Raised from engagement">
              <Select value={eng} onValueChange={setEng}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None (internal observation)</SelectItem>
                  {engagements.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      <span className="flex items-center gap-2">
                        <SideDot side={e.side} />
                        <span className="font-mono text-xs text-muted-foreground">{e.account.key}</span> {e.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {eng !== NONE && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Impact on the engagement">
                <Select value={impact} onValueChange={(v) => setImpact(v as GapImpact)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GAP_IMPACTS.map((i) => (
                      <SelectItem key={i} value={i}>
                        {IMPACT_LABELS[i]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="ARR influenced (USD)">
                <Input name="arr" type="number" min={0} step={1000} placeholder="250000" />
              </Field>
            </div>
          )}
          {existing !== NEW && (
            <Field label="Note">
              <Input name="note" placeholder="How it shows up in this account" />
            </Field>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || link.isPending}>
              {existing === NEW ? 'Raise' : 'Link'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
