import type { HandoffKind } from '@tesseract/shared'
import { Loader2, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Field } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useMe } from '@/lib/me'
import { useDrafts } from '@/lib/queries-drafts'

/** Paste call notes; get a reviewable draft. Hidden entirely when the API has no model configured. */
export function DraftFromNotesButton({ engagementId, kind, hasPending }: { engagementId: string; kind: HandoffKind; hasPending: boolean }) {
  const me = useMe()
  const { generate } = useDrafts(engagementId, kind)
  const [open, setOpen] = useState(false)
  if (!me.ai.enabled) return null

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    await generate.mutateAsync({ label: String(f.get('label')), text: String(f.get('text')) })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !generate.isPending && setOpen(o)}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs">
          <Sparkles className="size-3.5" /> {hasPending ? 'Redraft from notes' : 'Draft from notes'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Draft this handoff from notes</DialogTitle>
          <DialogDescription>
            Paste call notes or a transcript. The model proposes sections, stakeholders, outcomes, commitments and gaps; every item must quote the notes
            verbatim or it is flagged. Nothing is written to the handoff until you review and apply it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="Source label">
            <Input name="label" required placeholder="Discovery call, Sep 18" defaultValue={`Notes, ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`} />
          </Field>
          <Field label="Notes or transcript" hint="Up to 60,000 characters. Sent to the configured model provider and stored with this engagement.">
            <Textarea name="text" required minLength={40} rows={14} className="font-mono text-xs" placeholder="Paste here…" autoFocus />
          </Field>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              Model: {me.ai.provider}/{me.ai.model}
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={generate.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={generate.isPending}>
                {generate.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Drafting…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" /> Generate draft
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
