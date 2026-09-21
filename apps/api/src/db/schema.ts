import { relations } from 'drizzle-orm'
import {
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import {
  ENGAGEMENT_OUTCOMES,
  GAP_IMPACTS,
  HANDOFF_KINDS,
  ISSUE_STATUSES,
  MILESTONE_KINDS,
  OUTCOME_DIRECTIONS,
  PHASES,
  PRIORITIES,
  PRODUCT_GAP_STATUSES,
  SIDES,
  STAKEHOLDER_ROLES,
} from '@tesseract/shared'
import { organization, user } from './auth-schema.ts'

export * from './auth-schema.ts'

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID())
const orgId = () =>
  text('organizationId')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' })
const createdAt = () => timestamp('createdAt', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () =>
  timestamp('updatedAt', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())
const userRef = (name: string) => text(name).references(() => user.id, { onDelete: 'set null' })

export const sideEnum = pgEnum('side', SIDES)
export const phaseEnum = pgEnum('phase', PHASES)
export const engagementOutcomeEnum = pgEnum('engagement_outcome', ENGAGEMENT_OUTCOMES)
export const issueStatusEnum = pgEnum('issue_status', ISSUE_STATUSES)
export const priorityEnum = pgEnum('priority', PRIORITIES)
export const milestoneKindEnum = pgEnum('milestone_kind', MILESTONE_KINDS)
export const outcomeDirectionEnum = pgEnum('outcome_direction', OUTCOME_DIRECTIONS)
export const handoffKindEnum = pgEnum('handoff_kind', HANDOFF_KINDS)
export const stakeholderRoleEnum = pgEnum('stakeholder_role', STAKEHOLDER_ROLES)
export const productGapStatusEnum = pgEnum('product_gap_status', PRODUCT_GAP_STATUSES)
export const gapImpactEnum = pgEnum('gap_impact', GAP_IMPACTS)

// ---- Customer accounts -------------------------------------------------------

export const customerAccount = pgTable(
  'customer_account',
  {
    id: id(),
    organizationId: orgId(),
    name: text('name').notNull(),
    key: text('key').notNull(), // short code used in issue identifiers, e.g. ACME
    domain: text('domain'),
    arr: numeric('arr', { precision: 14, scale: 2 }),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('customer_account_org_key_idx').on(t.organizationId, t.key)],
)

export const stakeholder = pgTable(
  'stakeholder',
  {
    id: id(),
    organizationId: orgId(),
    accountId: text('accountId')
      .notNull()
      .references(() => customerAccount.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    title: text('title'),
    email: text('email'),
    role: stakeholderRoleEnum('role').notNull(),
    notes: text('notes'),
    createdAt: createdAt(),
  },
  (t) => [index('stakeholder_account_idx').on(t.accountId)],
)

// ---- Engagements --------------------------------------------------------------

export const engagement = pgTable(
  'engagement',
  {
    id: id(),
    organizationId: orgId(),
    accountId: text('accountId')
      .notNull()
      .references(() => customerAccount.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    side: sideEnum('side').notNull(),
    phase: phaseEnum('phase').notNull(),
    decision: text('decision'), // the decision this engagement is meant to unlock
    description: text('description'),
    fdeId: userRef('fdeId'),
    engagementManagerId: userRef('engagementManagerId'),
    aeId: userRef('aeId'),
    csmId: userRef('csmId'),
    outcome: engagementOutcomeEnum('outcome'),
    phaseEnteredAt: timestamp('phaseEnteredAt', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closedAt', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('engagement_org_side_idx').on(t.organizationId, t.side), index('engagement_account_idx').on(t.accountId)],
)

export const outcome = pgTable(
  'outcome',
  {
    id: id(),
    organizationId: orgId(),
    engagementId: text('engagementId')
      .notNull()
      .references(() => engagement.id, { onDelete: 'cascade' }),
    metric: text('metric').notNull(),
    unit: text('unit'),
    baseline: numeric('baseline', { precision: 18, scale: 4 }),
    target: numeric('target', { precision: 18, scale: 4 }),
    current: numeric('current', { precision: 18, scale: 4 }),
    direction: outcomeDirectionEnum('direction').notNull().default('up'),
    firstValueVerifiedAt: timestamp('firstValueVerifiedAt', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('outcome_engagement_idx').on(t.engagementId)],
)

export const milestone = pgTable(
  'milestone',
  {
    id: id(),
    organizationId: orgId(),
    engagementId: text('engagementId')
      .notNull()
      .references(() => engagement.id, { onDelete: 'cascade' }),
    kind: milestoneKindEnum('kind').notNull().default('custom'),
    title: text('title').notNull(),
    targetDate: date('targetDate'),
    completedAt: timestamp('completedAt', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('milestone_engagement_idx').on(t.engagementId)],
)

export type HandoffSections = Record<string, { state: 'confirmed' | 'unclear' | 'not_discussed'; notes: string }>
export type HandoffGap = {
  id: string
  title: string
  severity: 'blocking' | 'high' | 'medium' | 'low'
  ownerId: string | null
  resolvedAt: string | null
}

export const handoff = pgTable(
  'handoff',
  {
    id: id(),
    organizationId: orgId(),
    engagementId: text('engagementId')
      .notNull()
      .references(() => engagement.id, { onDelete: 'cascade' }),
    kind: handoffKindEnum('kind').notNull(),
    sections: jsonb('sections').$type<HandoffSections>().notNull().default({}),
    gaps: jsonb('gaps').$type<HandoffGap[]>().notNull().default([]),
    acceptedById: userRef('acceptedById'),
    acceptedAt: timestamp('acceptedAt', { withTimezone: true }),
    createdById: userRef('createdById'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('handoff_engagement_kind_idx').on(t.engagementId, t.kind)],
)

// ---- Threads and issues -------------------------------------------------------

export const thread = pgTable(
  'thread',
  {
    id: id(),
    organizationId: orgId(),
    engagementId: text('engagementId').references(() => engagement.id, { onDelete: 'cascade' }), // null = internal
    name: text('name').notNull(),
    description: text('description'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('thread_engagement_idx').on(t.engagementId), index('thread_org_idx').on(t.organizationId)],
)

// Per-scope monotonic counters for human identifiers. scope = `acct:<accountId>` or `org:<orgId>`.
export const counter = pgTable('counter', {
  scope: text('scope').primaryKey(),
  n: integer('n').notNull().default(0),
})

export const issue = pgTable(
  'issue',
  {
    id: id(),
    organizationId: orgId(),
    threadId: text('threadId')
      .notNull()
      .references(() => thread.id, { onDelete: 'cascade' }),
    engagementId: text('engagementId').references(() => engagement.id, { onDelete: 'cascade' }),
    accountId: text('accountId').references(() => customerAccount.id, { onDelete: 'cascade' }),
    identifier: text('identifier').notNull(), // ACME-42 or INT-7
    title: text('title').notNull(),
    description: jsonb('description'), // TipTap JSON
    status: issueStatusEnum('status').notNull().default('todo'),
    priority: priorityEnum('priority').notNull().default('none'),
    assigneeId: userRef('assigneeId'),
    parentId: text('parentId'),
    dueDate: date('dueDate'),
    createdById: userRef('createdById'),
    completedAt: timestamp('completedAt', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('issue_org_identifier_idx').on(t.organizationId, t.identifier),
    index('issue_thread_idx').on(t.threadId),
    index('issue_assignee_idx').on(t.assigneeId),
    index('issue_parent_idx').on(t.parentId),
  ],
)

export const label = pgTable(
  'label',
  {
    id: id(),
    organizationId: orgId(),
    name: text('name').notNull(),
    color: text('color').notNull().default('#8b8b8b'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('label_org_name_idx').on(t.organizationId, t.name)],
)

export const issueLabel = pgTable(
  'issue_label',
  {
    issueId: text('issueId')
      .notNull()
      .references(() => issue.id, { onDelete: 'cascade' }),
    labelId: text('labelId')
      .notNull()
      .references(() => label.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.issueId, t.labelId] })],
)

export const comment = pgTable(
  'comment',
  {
    id: id(),
    organizationId: orgId(),
    issueId: text('issueId')
      .notNull()
      .references(() => issue.id, { onDelete: 'cascade' }),
    authorId: userRef('authorId'),
    body: text('body').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('comment_issue_idx').on(t.issueId)],
)

export const activity = pgTable(
  'activity',
  {
    id: id(),
    organizationId: orgId(),
    issueId: text('issueId')
      .notNull()
      .references(() => issue.id, { onDelete: 'cascade' }),
    actorId: userRef('actorId'),
    field: text('field').notNull(),
    from: text('from'),
    to: text('to'),
    createdAt: createdAt(),
  },
  (t) => [index('activity_issue_idx').on(t.issueId)],
)

// ---- Product gaps (field -> product loop) -------------------------------------

export const productGap = pgTable(
  'product_gap',
  {
    id: id(),
    organizationId: orgId(),
    title: text('title').notNull(),
    description: text('description'),
    status: productGapStatusEnum('status').notNull().default('raised'),
    parentId: text('parentId'), // cluster parent
    linkedIssueUrl: text('linkedIssueUrl'), // pointer into the core-eng tracker
    createdById: userRef('createdById'),
    shippedAt: timestamp('shippedAt', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('product_gap_org_status_idx').on(t.organizationId, t.status), index('product_gap_parent_idx').on(t.parentId)],
)

export const engagementGap = pgTable(
  'engagement_gap',
  {
    engagementId: text('engagementId')
      .notNull()
      .references(() => engagement.id, { onDelete: 'cascade' }),
    gapId: text('gapId')
      .notNull()
      .references(() => productGap.id, { onDelete: 'cascade' }),
    impact: gapImpactEnum('impact').notNull().default('major'),
    arrInfluenced: numeric('arrInfluenced', { precision: 14, scale: 2 }),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.engagementId, t.gapId] })],
)

// ---- Relations (for db.query.*) ---------------------------------------------

export const customerAccountRelations = relations(customerAccount, ({ many }) => ({
  stakeholders: many(stakeholder),
  engagements: many(engagement),
}))

export const stakeholderRelations = relations(stakeholder, ({ one }) => ({
  account: one(customerAccount, { fields: [stakeholder.accountId], references: [customerAccount.id] }),
}))

export const engagementRelations = relations(engagement, ({ one, many }) => ({
  account: one(customerAccount, { fields: [engagement.accountId], references: [customerAccount.id] }),
  fde: one(user, { fields: [engagement.fdeId], references: [user.id], relationName: 'fde' }),
  engagementManager: one(user, { fields: [engagement.engagementManagerId], references: [user.id], relationName: 'em' }),
  ae: one(user, { fields: [engagement.aeId], references: [user.id], relationName: 'ae' }),
  csm: one(user, { fields: [engagement.csmId], references: [user.id], relationName: 'csm' }),
  outcomes: many(outcome),
  milestones: many(milestone),
  handoffs: many(handoff),
  threads: many(thread),
  gaps: many(engagementGap),
}))

export const outcomeRelations = relations(outcome, ({ one }) => ({
  engagement: one(engagement, { fields: [outcome.engagementId], references: [engagement.id] }),
}))
export const milestoneRelations = relations(milestone, ({ one }) => ({
  engagement: one(engagement, { fields: [milestone.engagementId], references: [engagement.id] }),
}))
export const handoffRelations = relations(handoff, ({ one }) => ({
  engagement: one(engagement, { fields: [handoff.engagementId], references: [engagement.id] }),
}))

export const threadRelations = relations(thread, ({ one, many }) => ({
  engagement: one(engagement, { fields: [thread.engagementId], references: [engagement.id] }),
  issues: many(issue),
}))

export const issueRelations = relations(issue, ({ one, many }) => ({
  thread: one(thread, { fields: [issue.threadId], references: [thread.id] }),
  engagement: one(engagement, { fields: [issue.engagementId], references: [engagement.id] }),
  assignee: one(user, { fields: [issue.assigneeId], references: [user.id] }),
  parent: one(issue, { fields: [issue.parentId], references: [issue.id], relationName: 'subIssues' }),
  subIssues: many(issue, { relationName: 'subIssues' }),
  labels: many(issueLabel),
  comments: many(comment),
  activities: many(activity),
}))

export const issueLabelRelations = relations(issueLabel, ({ one }) => ({
  issue: one(issue, { fields: [issueLabel.issueId], references: [issue.id] }),
  label: one(label, { fields: [issueLabel.labelId], references: [label.id] }),
}))

export const commentRelations = relations(comment, ({ one }) => ({
  issue: one(issue, { fields: [comment.issueId], references: [issue.id] }),
  author: one(user, { fields: [comment.authorId], references: [user.id] }),
}))

export const activityRelations = relations(activity, ({ one }) => ({
  issue: one(issue, { fields: [activity.issueId], references: [issue.id] }),
  actor: one(user, { fields: [activity.actorId], references: [user.id] }),
}))

export const productGapRelations = relations(productGap, ({ one, many }) => ({
  parent: one(productGap, { fields: [productGap.parentId], references: [productGap.id], relationName: 'cluster' }),
  children: many(productGap, { relationName: 'cluster' }),
  engagements: many(engagementGap),
}))

export const engagementGapRelations = relations(engagementGap, ({ one }) => ({
  engagement: one(engagement, { fields: [engagementGap.engagementId], references: [engagement.id] }),
  gap: one(productGap, { fields: [engagementGap.gapId], references: [productGap.id] }),
}))
