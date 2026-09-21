// Plain `as const` tuples (no TS enums) so they erase cleanly and feed zod + drizzle pgEnum.

export const SIDES = ['presales', 'postsales'] as const
export type Side = (typeof SIDES)[number]

export const PRESALES_PHASES = ['qualify', 'discover', 'scope', 'prototype', 'technical_win'] as const
export const POSTSALES_PHASES = ['kickoff', 'build', 'validate', 'live', 'adopt', 'handed_off'] as const
export const PHASES = [...PRESALES_PHASES, ...POSTSALES_PHASES, 'closed'] as const
export type Phase = (typeof PHASES)[number]

export const ENGAGEMENT_OUTCOMES = ['won', 'lost', 'deferred', 'handed_off'] as const
export type EngagementOutcome = (typeof ENGAGEMENT_OUTCOMES)[number]

export const ISSUE_STATUSES = ['backlog', 'todo', 'in_progress', 'done', 'canceled'] as const
export type IssueStatus = (typeof ISSUE_STATUSES)[number]

export const PRIORITIES = ['none', 'urgent', 'high', 'medium', 'low'] as const
export type Priority = (typeof PRIORITIES)[number]

export const MILESTONE_KINDS = ['kickoff', 'first_value', 'production', 'handoff', 'custom'] as const
export type MilestoneKind = (typeof MILESTONE_KINDS)[number]

export const OUTCOME_DIRECTIONS = ['up', 'down'] as const
export type OutcomeDirection = (typeof OUTCOME_DIRECTIONS)[number]

export const HANDOFF_KINDS = ['pre_to_post', 'post_to_cs'] as const
export type HandoffKind = (typeof HANDOFF_KINDS)[number]

export const HANDOFF_SECTION_STATES = ['confirmed', 'unclear', 'not_discussed'] as const
export type HandoffSectionState = (typeof HANDOFF_SECTION_STATES)[number]

export const HANDOFF_SECTION_KEYS = [
  'customer_overview',
  'goals_success_criteria',
  'use_cases_scope',
  'configuration_requirements',
  'integrations_constraints',
  'stakeholders_roles',
  'timeline_milestones',
  'risks_open_questions',
] as const
export type HandoffSectionKey = (typeof HANDOFF_SECTION_KEYS)[number]

// Shown under each section in the UI and given to the model verbatim, so both agree on what belongs where.
export const HANDOFF_SECTION_PROMPTS: Record<HandoffSectionKey, string> = {
  customer_overview: 'Who they are, what triggered the evaluation, why they bought (or will).',
  goals_success_criteria: 'The outcome they expect and how they will measure it. Link the outcome contract.',
  use_cases_scope: 'What is in scope for the first wedge, and explicitly what was left out.',
  configuration_requirements: 'Features, models, environments, access the next team needs before planning.',
  integrations_constraints: 'Systems to connect, data sources, security/compliance constraints raised so far.',
  stakeholders_roles: 'Sponsor, technical owner, workflow owner, champion; who attends kickoff; who owns day to day.',
  timeline_milestones: 'Expected go-live, fixed business deadlines, rollout phasing agreed.',
  risks_open_questions: 'Unresolved concerns, unclear requirements, decisions still pending.',
}

export const HANDOFF_SECTION_LABELS: Record<HandoffSectionKey, string> = {
  customer_overview: 'Customer overview',
  goals_success_criteria: 'Goals and success criteria',
  use_cases_scope: 'Use cases and scope',
  configuration_requirements: 'Configuration and requirements',
  integrations_constraints: 'Integrations and technical constraints',
  stakeholders_roles: 'Stakeholders and roles',
  timeline_milestones: 'Timeline and key milestones',
  risks_open_questions: 'Risks, gaps and open questions',
}

// Lifecycle events on a handoff record; the metrics page is computed from these.
export const HANDOFF_EVENTS = [
  'created',
  'section_marked',
  'gap_added',
  'gap_resolved',
  'gap_reopened',
  'accepted',
  'reopened',
  'draft_generated',
  'draft_applied',
] as const
export type HandoffEvent = (typeof HANDOFF_EVENTS)[number]

export const GAP_SEVERITIES = ['blocking', 'high', 'medium', 'low'] as const
export type GapSeverity = (typeof GAP_SEVERITIES)[number]

export const STAKEHOLDER_ROLES = ['sponsor', 'technical_owner', 'workflow_owner', 'champion', 'user', 'blocker'] as const
export type StakeholderRole = (typeof STAKEHOLDER_ROLES)[number]

export const PRODUCT_GAP_STATUSES = ['raised', 'triaged', 'accepted', 'shipped', 'declined'] as const
export type ProductGapStatus = (typeof PRODUCT_GAP_STATUSES)[number]

export const GAP_IMPACTS = ['blocker', 'major', 'minor'] as const
export type GapImpact = (typeof GAP_IMPACTS)[number]

// `owner` is assigned by Better Auth to the org creator; the rest are functional roles.
export const MEMBER_ROLES = ['owner', 'admin', 'fde', 'engagement_manager', 'account_exec', 'csm', 'product'] as const
export type MemberRole = (typeof MEMBER_ROLES)[number]

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  fde: 'FDE',
  engagement_manager: 'Engagement Manager',
  account_exec: 'Account Executive',
  csm: 'Customer Success',
  product: 'Product',
}

export const PHASE_LABELS: Record<Phase, string> = {
  qualify: 'Qualify',
  discover: 'Discover',
  scope: 'Scope',
  prototype: 'Prototype',
  technical_win: 'Technical Win',
  kickoff: 'Kickoff',
  build: 'Build',
  validate: 'Validate',
  live: 'Live',
  adopt: 'Adopt',
  handed_off: 'Handed Off',
  closed: 'Closed',
}
