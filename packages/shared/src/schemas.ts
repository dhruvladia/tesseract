import { z } from 'zod'
import {
  ENGAGEMENT_OUTCOMES,
  GAP_IMPACTS,
  GAP_SEVERITIES,
  HANDOFF_KINDS,
  HANDOFF_SECTION_KEYS,
  HANDOFF_SECTION_STATES,
  ISSUE_STATUSES,
  MEMBER_ROLES,
  MILESTONE_KINDS,
  OUTCOME_DIRECTIONS,
  PHASES,
  PRIORITIES,
  PRODUCT_GAP_STATUSES,
  SIDES,
  STAKEHOLDER_ROLES,
} from './enums.ts'

const id = z.string().min(1)
const nullableId = id.nullable().optional()
const text = z.string().trim()
const optText = text.max(5000).nullable().optional()
const money = z.union([z.number(), z.string()]).transform(String).nullable().optional()
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional()

// ---- Accounts ------------------------------------------------------------------
export const accountCreateSchema = z.object({
  name: text.min(1).max(200),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9]{1,5}$/, '2-6 uppercase letters/digits, e.g. ACME'),
  domain: optText,
  arr: money,
  notes: optText,
})
export const accountUpdateSchema = accountCreateSchema.partial()

export const stakeholderCreateSchema = z.object({
  name: text.min(1).max(200),
  title: optText,
  email: z.string().trim().email().nullable().optional().or(z.literal('')),
  role: z.enum(STAKEHOLDER_ROLES),
  notes: optText,
})
export const stakeholderUpdateSchema = stakeholderCreateSchema.partial()

// ---- Engagements ---------------------------------------------------------------
export const engagementCreateSchema = z.object({
  accountId: id,
  name: text.min(1).max(200),
  side: z.enum(SIDES),
  phase: z.enum(PHASES).optional(),
  decision: optText,
  description: optText,
  fdeId: nullableId,
  engagementManagerId: nullableId,
  aeId: nullableId,
  csmId: nullableId,
})
export const engagementUpdateSchema = engagementCreateSchema
  .omit({ accountId: true, side: true, phase: true })
  .partial()
  .extend({ outcome: z.enum(ENGAGEMENT_OUTCOMES).nullable().optional() })
export const phaseChangeSchema = z.object({
  phase: z.enum(PHASES),
  outcome: z.enum(ENGAGEMENT_OUTCOMES).nullable().optional(), // when closing
})

// Update schemas derive from default-free bases: zod's .partial() still applies .default() to
// missing keys, which would silently reset fields on PATCH.
const outcomeBase = z.object({
  metric: text.min(1).max(200),
  unit: optText,
  baseline: money,
  target: money,
  current: money,
  direction: z.enum(OUTCOME_DIRECTIONS),
  firstValueVerifiedAt: z.string().datetime().nullable().optional(),
})
export const outcomeCreateSchema = outcomeBase.extend({ direction: outcomeBase.shape.direction.default('up') })
export const outcomeUpdateSchema = outcomeBase.partial()

const milestoneBase = z.object({
  kind: z.enum(MILESTONE_KINDS),
  title: text.min(1).max(200),
  targetDate: isoDate,
  completedAt: z.string().datetime().nullable().optional(),
})
export const milestoneCreateSchema = milestoneBase.extend({ kind: milestoneBase.shape.kind.default('custom') })
export const milestoneUpdateSchema = milestoneBase.partial()

// ---- Handoffs ------------------------------------------------------------------
const evidenceRef = z.object({ quote: z.string(), line: z.number().int(), verified: z.boolean(), sourceId: z.string().optional() })
export const handoffSectionSchema = z.object({
  state: z.enum(HANDOFF_SECTION_STATES),
  notes: z.string().max(10_000).default(''),
  evidence: z.array(evidenceRef).optional(),
})
export const handoffGapSchema = z.object({
  id: id,
  title: text.max(300), // may be empty while drafting; acceptance requires a title
  severity: z.enum(GAP_SEVERITIES),
  ownerId: id.nullable(),
  resolvedAt: z.string().datetime().nullable(),
  evidence: z.array(evidenceRef).optional(),
})
export const handoffUpsertSchema = z.object({
  sections: z.partialRecord(z.enum(HANDOFF_SECTION_KEYS), handoffSectionSchema),
  gaps: z.array(handoffGapSchema),
})
export const handoffKindSchema = z.enum(HANDOFF_KINDS)

// ---- Threads and issues --------------------------------------------------------
export const threadCreateSchema = z.object({
  name: text.min(1).max(200),
  description: optText,
  engagementId: nullableId,
})
export const threadUpdateSchema = threadCreateSchema.omit({ engagementId: true }).partial()

const issueBase = z.object({
  title: text.min(1).max(300),
  description: z.unknown().nullable().optional(), // TipTap JSON
  status: z.enum(ISSUE_STATUSES),
  priority: z.enum(PRIORITIES),
  assigneeId: nullableId,
  parentId: nullableId,
  dueDate: isoDate,
  labelIds: z.array(id).optional(),
})
export const issueCreateSchema = issueBase.extend({
  threadId: id,
  status: issueBase.shape.status.default('todo'),
  priority: issueBase.shape.priority.default('none'),
})
export const issueUpdateSchema = issueBase.partial()

export const issueListQuerySchema = z.object({
  threadId: id.optional(),
  engagementId: id.optional(),
  accountId: id.optional(),
  assigneeId: z.union([id, z.literal('me')]).optional(),
  status: z.enum(ISSUE_STATUSES).optional(),
  q: z.string().optional(),
})

export const commentCreateSchema = z.object({ body: text.min(1).max(10_000) })

const labelBase = z.object({ name: text.min(1).max(50), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) })
export const labelCreateSchema = labelBase.extend({ color: labelBase.shape.color.default('#8b8b8b') })
export const labelUpdateSchema = labelBase.partial()

// ---- Product gaps --------------------------------------------------------------
const productGapBase = z.object({
  title: text.min(1).max(300),
  description: optText,
  status: z.enum(PRODUCT_GAP_STATUSES),
  parentId: nullableId,
  linkedIssueUrl: z.string().trim().url().nullable().optional().or(z.literal('')),
})
export const productGapCreateSchema = productGapBase.extend({
  status: productGapBase.shape.status.default('raised'),
  // optionally link to an engagement at creation
  engagementId: nullableId,
  impact: z.enum(GAP_IMPACTS).optional(),
  arrInfluenced: money,
})
export const productGapUpdateSchema = productGapBase.partial()

export const engagementGapLinkSchema = z.object({
  engagementId: id,
  impact: z.enum(GAP_IMPACTS).default('major'),
  arrInfluenced: money,
  note: optText,
})

// ---- Members -------------------------------------------------------------------
export const memberRoleSchema = z.object({ role: z.enum(MEMBER_ROLES).exclude(['owner']) })
export const memberAddSchema = z.object({ email: z.string().trim().email(), role: z.enum(MEMBER_ROLES).exclude(['owner']) })

export const searchQuerySchema = z.object({ q: z.string().trim().min(1).max(100) })
