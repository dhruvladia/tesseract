import { PHASE_LABELS, type Phase } from '@tesseract/shared'
import { unwrap, type InternalClient } from './client.ts'

/**
 * One plain sentence for a pending write, with names instead of ids. Shown as the approval
 * prompt in the chat UI and written to the sim's audit log. Lookups are cached per request.
 */
export function makeDescriber(api: InternalClient) {
  const cache = new Map<string, Promise<string>>()
  const memo = (key: string, fn: () => Promise<string>) => {
    if (!cache.has(key)) cache.set(key, fn().catch(() => key))
    return cache.get(key)!
  }
  const eng = (id: string) =>
    memo(`eng:${id}`, async () => {
      const r = await unwrap(api.api.engagements[':id'].$get({ param: { id } }))
      return 'error' in r ? `engagement ${id.slice(0, 8)}` : `${r.name} (${r.account.key})`
    })
  const acct = (id: string) =>
    memo(`acct:${id}`, async () => {
      const r = await unwrap(api.api.accounts[':id'].$get({ param: { id } }))
      return 'error' in r ? `account ${id.slice(0, 8)}` : `${r.name} (${r.key})`
    })
  const issue = (id: string) =>
    memo(`issue:${id}`, async () => {
      const r = await unwrap(api.api.issues[':id'].$get({ param: { id } }))
      return 'error' in r ? `issue ${id.slice(0, 8)}` : `${r.identifier} "${r.title}"`
    })
  const gap = (id: string) =>
    memo(`gap:${id}`, async () => {
      const r = await unwrap(api.api.gaps[':id'].$get({ param: { id } }))
      return 'error' in r ? `gap ${id.slice(0, 8)}` : `gap "${r.title}"`
    })
  const thread = (id: string) =>
    memo(`thread:${id}`, async () => {
      const r = await unwrap(api.api.threads[':id'].$get({ param: { id } }))
      return 'error' in r ? `thread ${id.slice(0, 8)}` : `thread "${r.name}"`
    })
  const user = (id: string | null | undefined) =>
    id
      ? memo(`user:${id}`, async () => {
          const r = await unwrap(api.api.me.$get())
          return 'error' in r ? id : (r.members.find((m) => m.userId === id)?.name ?? id)
        })
      : Promise.resolve('nobody')

  const kindLabel = (k: string) => (k === 'pre_to_post' ? 'pre-sales → post-sales' : 'post-sales → CS')
  const patchSummary = async (patch: Record<string, unknown>) => {
    const parts: string[] = []
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue
      if (/Id$/.test(k) && (typeof v === 'string' || v === null)) parts.push(`${k.replace(/Id$/, '')} → ${await user(v as string | null)}`)
      else if (['fde', 'engagementManager', 'ae', 'csm', 'assignee', 'owner'].includes(k)) parts.push(`${k.replace(/([A-Z])/g, ' $1').toLowerCase()} → ${v === null ? 'nobody' : String(v)}`)
      else if (k === 'phase') parts.push(`phase → ${PHASE_LABELS[v as Phase] ?? v}`)
      else if (Array.isArray(v)) parts.push(`${k} (${v.length})`)
      else if (typeof v === 'string' && v.length > 60) parts.push(`${k} → "${v.slice(0, 57)}…"`)
      else parts.push(`${k} → ${JSON.stringify(v)}`)
    }
    return parts.join(', ')
  }

  return async function describeCall(name: string, raw: unknown): Promise<string> {
    const i = (raw ?? {}) as Record<string, unknown>
    const s = (k: string) => String(i[k] ?? '')
    const patch = (i.patch ?? {}) as Record<string, unknown>
    switch (name) {
      case 'create_account':
        return `Create account ${s('name')} with key ${s('key')}${i.arr ? `, ARR ${i.arr}` : ''}`
      case 'update_account':
        return `Update ${await acct(s('accountId'))}: ${await patchSummary(patch)}`
      case 'delete_account':
        return `Delete ${await acct(s('accountId'))} and everything under it (engagements, threads, issues, stakeholders). This cannot be undone.`
      case 'add_stakeholder': {
        const st = i.stakeholder as { name: string; role: string; title?: string | null }
        return `Add ${st.name}${st.title ? ` (${st.title})` : ''} as ${st.role.replace('_', ' ')} on ${await acct(s('accountId'))}`
      }
      case 'update_stakeholder':
        return `Update a stakeholder on ${await acct(s('accountId'))}: ${await patchSummary(patch)}`
      case 'remove_stakeholder':
        return `Remove a stakeholder from ${await acct(s('accountId'))}`
      case 'create_engagement':
        return `Create ${s('side') === 'presales' ? 'pre-sales' : 'post-sales'} engagement "${s('name')}" on ${await acct(s('accountId'))}${i.fdeId ? `, FDE ${await user(s('fdeId'))}` : ''}`
      case 'update_engagement':
        return `Update ${await eng(s('engagementId'))}: ${await patchSummary(patch)}`
      case 'delete_engagement':
        return `Delete ${await eng(s('engagementId'))} with its threads, issues and handoffs. This cannot be undone.`
      case 'change_phase':
        return `Move ${await eng(s('engagementId'))} to ${PHASE_LABELS[s('phase') as Phase] ?? s('phase')}${i.outcome ? ` (${s('outcome')})` : ''}`
      case 'create_thread':
        return i.engagementId ? `Create thread "${s('name')}" on ${await eng(s('engagementId'))}` : `Create internal thread "${s('name')}"`
      case 'update_thread':
        return `Update ${await thread(s('threadId'))}: ${await patchSummary(patch)}`
      case 'delete_thread':
        return `Delete ${await thread(s('threadId'))} and all its issues. This cannot be undone.`
      case 'create_issue':
        return `Create issue "${s('title')}" in ${await thread(s('threadId'))}${i.assignee ? `, assigned to ${s('assignee')}` : ''}${i.priority && i.priority !== 'none' ? `, ${s('priority')} priority` : ''}`
      case 'update_issue':
        return `Update ${await issue(s('issueId'))}: ${await patchSummary(patch)}`
      case 'delete_issue':
        return `Delete ${await issue(s('issueId'))}. This cannot be undone.`
      case 'add_comment':
        return `Comment on ${await issue(s('issueId'))}: "${String((i.comment as { body: string }).body).slice(0, 80)}"`
      case 'create_label':
        return `Create label "${s('name')}"`
      case 'delete_label':
        return `Delete a label`
      case 'mark_unmarked_sections':
        return `Mark every still-unmarked section of the ${kindLabel(s('kind'))} handoff of ${await eng(s('engagementId'))} as ${s('state').replace('_', ' ') || 'not discussed'} (sections with content are kept)`
      case 'update_handoff_sections': {
        const secs = Object.entries((i.sections ?? {}) as Record<string, { state: string }>)
        return `Mark ${secs.length} section${secs.length === 1 ? '' : 's'} on the ${kindLabel(s('kind'))} handoff of ${await eng(s('engagementId'))}: ${secs.map(([k, v]) => `${k.replace(/_/g, ' ')} → ${v.state.replace('_', ' ')}`).join(', ')}`
      }
      case 'add_handoff_gap':
        return `Add ${s('severity')} gap "${s('title')}" to the ${kindLabel(s('kind'))} handoff of ${await eng(s('engagementId'))}${i.owner ? `, owner ${s('owner')}` : ''}`
      case 'assign_unowned_gaps':
        return `Give every unowned open gap on the ${kindLabel(s('kind'))} handoff of ${await eng(s('engagementId'))} to ${s('owner')}`
      case 'update_handoff_gap': {
        const bits: string[] = []
        if (i.resolved === true) bits.push('resolve it')
        if (i.resolved === false) bits.push('reopen it')
        if (i.owner !== undefined) bits.push(`owner → ${i.owner === null ? 'nobody' : s('owner')}`)
        if (i.severity) bits.push(`severity → ${s('severity')}`)
        if (i.title) bits.push(`title → "${s('title')}"`)
        return `Update gap ${i.gapTitle ? `"${s('gapTitle')}"` : ''} on the ${kindLabel(s('kind'))} handoff of ${await eng(s('engagementId'))}: ${bits.join(', ') || 'no change'}`
      }
      case 'accept_handoff':
        return `Accept the ${kindLabel(s('kind'))} handoff on ${await eng(s('engagementId'))}. This signs off that the receiving team can execute from it.`
      case 'reopen_handoff':
        return `Reopen the ${kindLabel(s('kind'))} handoff on ${await eng(s('engagementId'))}`
      case 'add_outcome': {
        const o = i.outcome as { metric: string; baseline?: unknown; target?: unknown; unit?: string | null }
        return `Add outcome "${o.metric}" (${o.baseline ?? '?'} → ${o.target ?? '?'}${o.unit ? ` ${o.unit}` : ''}) to ${await eng(s('engagementId'))}`
      }
      case 'update_outcome':
        return `Update an outcome on ${await eng(s('engagementId'))}: ${await patchSummary(patch)}`
      case 'delete_outcome':
        return `Delete an outcome metric on ${await eng(s('engagementId'))}`
      case 'add_milestone': {
        const m = i.milestone as { title: string; targetDate?: string | null }
        return `Add milestone "${m.title}"${m.targetDate ? ` due ${m.targetDate}` : ''} to ${await eng(s('engagementId'))}`
      }
      case 'update_milestone':
        return `Update a milestone on ${await eng(s('engagementId'))}: ${await patchSummary(patch)}`
      case 'delete_milestone':
        return `Delete a milestone on ${await eng(s('engagementId'))}`
      case 'create_gap':
        return `Raise product gap "${s('title')}"${i.engagementId ? ` from ${await eng(s('engagementId'))} (${s('impact') || 'major'}${i.arrInfluenced ? `, ARR ${i.arrInfluenced}` : ''})` : ''}`
      case 'update_gap':
        return `Update ${await gap(s('gapId'))}: ${await patchSummary(patch)}`
      case 'delete_gap':
        return `Delete ${await gap(s('gapId'))}. This cannot be undone.`
      case 'link_gap': {
        const l = i.link as { engagementId: string; impact?: string }
        return `Link ${await gap(s('gapId'))} to ${await eng(l.engagementId)} as ${l.impact ?? 'major'}`
      }
      case 'unlink_gap':
        return `Unlink ${await gap(s('gapId'))} from ${await eng(s('engagementId'))}`
      case 'set_member_role':
        return `Change ${await user(s('userId'))}'s role to ${s('role').replace('_', ' ')}`
      case 'generate_handoff_draft':
        return `Send the notes "${(i.notes as { label: string }).label}" to the model and draft the ${kindLabel(s('kind'))} handoff on ${await eng(s('engagementId'))}. Nothing is written until you apply it.`
      case 'apply_handoff_draft':
        return `Apply the verified part of the pending draft to the ${kindLabel(s('kind'))} handoff on ${await eng(s('engagementId'))}`
      case 'dismiss_handoff_draft':
        return `Discard the pending ${kindLabel(s('kind'))} draft on ${await eng(s('engagementId'))}`
      default:
        return `Run ${name}`
    }
  }
}
