CREATE TYPE "public"."engagement_outcome" AS ENUM('won', 'lost', 'deferred', 'handed_off');--> statement-breakpoint
CREATE TYPE "public"."gap_impact" AS ENUM('blocker', 'major', 'minor');--> statement-breakpoint
CREATE TYPE "public"."handoff_kind" AS ENUM('pre_to_post', 'post_to_cs');--> statement-breakpoint
CREATE TYPE "public"."issue_status" AS ENUM('backlog', 'todo', 'in_progress', 'done', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."milestone_kind" AS ENUM('kickoff', 'first_value', 'production', 'handoff', 'custom');--> statement-breakpoint
CREATE TYPE "public"."outcome_direction" AS ENUM('up', 'down');--> statement-breakpoint
CREATE TYPE "public"."phase" AS ENUM('qualify', 'discover', 'scope', 'prototype', 'technical_win', 'kickoff', 'build', 'validate', 'live', 'adopt', 'handed_off', 'closed');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('none', 'urgent', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."product_gap_status" AS ENUM('raised', 'triaged', 'accepted', 'shipped', 'declined');--> statement-breakpoint
CREATE TYPE "public"."side" AS ENUM('presales', 'postsales');--> statement-breakpoint
CREATE TYPE "public"."stakeholder_role" AS ENUM('sponsor', 'technical_owner', 'workflow_owner', 'champion', 'user', 'blocker');--> statement-breakpoint
CREATE TABLE "activity" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"issueId" text NOT NULL,
	"actorId" text,
	"field" text NOT NULL,
	"from" text,
	"to" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comment" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"issueId" text NOT NULL,
	"authorId" text,
	"body" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "counter" (
	"scope" text PRIMARY KEY NOT NULL,
	"n" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_account" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"domain" text,
	"arr" numeric(14, 2),
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engagement" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"accountId" text NOT NULL,
	"name" text NOT NULL,
	"side" "side" NOT NULL,
	"phase" "phase" NOT NULL,
	"decision" text,
	"description" text,
	"fdeId" text,
	"engagementManagerId" text,
	"aeId" text,
	"csmId" text,
	"outcome" "engagement_outcome",
	"phaseEnteredAt" timestamp with time zone DEFAULT now() NOT NULL,
	"closedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engagement_gap" (
	"engagementId" text NOT NULL,
	"gapId" text NOT NULL,
	"impact" "gap_impact" DEFAULT 'major' NOT NULL,
	"arrInfluenced" numeric(14, 2),
	"note" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "engagement_gap_engagementId_gapId_pk" PRIMARY KEY("engagementId","gapId")
);
--> statement-breakpoint
CREATE TABLE "handoff" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"engagementId" text NOT NULL,
	"kind" "handoff_kind" NOT NULL,
	"sections" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"gaps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"acceptedById" text,
	"acceptedAt" timestamp with time zone,
	"createdById" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"threadId" text NOT NULL,
	"engagementId" text,
	"accountId" text,
	"identifier" text NOT NULL,
	"title" text NOT NULL,
	"description" jsonb,
	"status" "issue_status" DEFAULT 'todo' NOT NULL,
	"priority" "priority" DEFAULT 'none' NOT NULL,
	"assigneeId" text,
	"parentId" text,
	"dueDate" date,
	"createdById" text,
	"completedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_label" (
	"issueId" text NOT NULL,
	"labelId" text NOT NULL,
	CONSTRAINT "issue_label_issueId_labelId_pk" PRIMARY KEY("issueId","labelId")
);
--> statement-breakpoint
CREATE TABLE "label" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#8b8b8b' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestone" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"engagementId" text NOT NULL,
	"kind" "milestone_kind" DEFAULT 'custom' NOT NULL,
	"title" text NOT NULL,
	"targetDate" date,
	"completedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outcome" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"engagementId" text NOT NULL,
	"metric" text NOT NULL,
	"unit" text,
	"baseline" numeric(18, 4),
	"target" numeric(18, 4),
	"current" numeric(18, 4),
	"direction" "outcome_direction" DEFAULT 'up' NOT NULL,
	"firstValueVerifiedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_gap" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "product_gap_status" DEFAULT 'raised' NOT NULL,
	"parentId" text,
	"linkedIssueUrl" text,
	"createdById" text,
	"shippedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stakeholder" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"accountId" text NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"email" text,
	"role" "stakeholder_role" NOT NULL,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thread" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"engagementId" text,
	"name" text NOT NULL,
	"description" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp,
	"refreshTokenExpiresAt" timestamp,
	"scope" text,
	"password" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"inviterId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"userId" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"createdAt" timestamp NOT NULL,
	"metadata" text,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	"activeOrganizationId" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_issueId_issue_id_fk" FOREIGN KEY ("issueId") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_actorId_user_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_issueId_issue_id_fk" FOREIGN KEY ("issueId") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_authorId_user_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_account" ADD CONSTRAINT "customer_account_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement" ADD CONSTRAINT "engagement_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement" ADD CONSTRAINT "engagement_accountId_customer_account_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."customer_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement" ADD CONSTRAINT "engagement_fdeId_user_id_fk" FOREIGN KEY ("fdeId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement" ADD CONSTRAINT "engagement_engagementManagerId_user_id_fk" FOREIGN KEY ("engagementManagerId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement" ADD CONSTRAINT "engagement_aeId_user_id_fk" FOREIGN KEY ("aeId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement" ADD CONSTRAINT "engagement_csmId_user_id_fk" FOREIGN KEY ("csmId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_gap" ADD CONSTRAINT "engagement_gap_engagementId_engagement_id_fk" FOREIGN KEY ("engagementId") REFERENCES "public"."engagement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_gap" ADD CONSTRAINT "engagement_gap_gapId_product_gap_id_fk" FOREIGN KEY ("gapId") REFERENCES "public"."product_gap"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoff" ADD CONSTRAINT "handoff_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoff" ADD CONSTRAINT "handoff_engagementId_engagement_id_fk" FOREIGN KEY ("engagementId") REFERENCES "public"."engagement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoff" ADD CONSTRAINT "handoff_acceptedById_user_id_fk" FOREIGN KEY ("acceptedById") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoff" ADD CONSTRAINT "handoff_createdById_user_id_fk" FOREIGN KEY ("createdById") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_threadId_thread_id_fk" FOREIGN KEY ("threadId") REFERENCES "public"."thread"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_engagementId_engagement_id_fk" FOREIGN KEY ("engagementId") REFERENCES "public"."engagement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_accountId_customer_account_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."customer_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_assigneeId_user_id_fk" FOREIGN KEY ("assigneeId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_createdById_user_id_fk" FOREIGN KEY ("createdById") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_label" ADD CONSTRAINT "issue_label_issueId_issue_id_fk" FOREIGN KEY ("issueId") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_label" ADD CONSTRAINT "issue_label_labelId_label_id_fk" FOREIGN KEY ("labelId") REFERENCES "public"."label"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "label" ADD CONSTRAINT "label_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone" ADD CONSTRAINT "milestone_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone" ADD CONSTRAINT "milestone_engagementId_engagement_id_fk" FOREIGN KEY ("engagementId") REFERENCES "public"."engagement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome" ADD CONSTRAINT "outcome_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome" ADD CONSTRAINT "outcome_engagementId_engagement_id_fk" FOREIGN KEY ("engagementId") REFERENCES "public"."engagement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_gap" ADD CONSTRAINT "product_gap_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_gap" ADD CONSTRAINT "product_gap_createdById_user_id_fk" FOREIGN KEY ("createdById") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stakeholder" ADD CONSTRAINT "stakeholder_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stakeholder" ADD CONSTRAINT "stakeholder_accountId_customer_account_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."customer_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread" ADD CONSTRAINT "thread_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread" ADD CONSTRAINT "thread_engagementId_engagement_id_fk" FOREIGN KEY ("engagementId") REFERENCES "public"."engagement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviterId_user_id_fk" FOREIGN KEY ("inviterId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_issue_idx" ON "activity" USING btree ("issueId");--> statement-breakpoint
CREATE INDEX "comment_issue_idx" ON "comment" USING btree ("issueId");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_account_org_key_idx" ON "customer_account" USING btree ("organizationId","key");--> statement-breakpoint
CREATE INDEX "engagement_org_side_idx" ON "engagement" USING btree ("organizationId","side");--> statement-breakpoint
CREATE INDEX "engagement_account_idx" ON "engagement" USING btree ("accountId");--> statement-breakpoint
CREATE UNIQUE INDEX "handoff_engagement_kind_idx" ON "handoff" USING btree ("engagementId","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "issue_org_identifier_idx" ON "issue" USING btree ("organizationId","identifier");--> statement-breakpoint
CREATE INDEX "issue_thread_idx" ON "issue" USING btree ("threadId");--> statement-breakpoint
CREATE INDEX "issue_assignee_idx" ON "issue" USING btree ("assigneeId");--> statement-breakpoint
CREATE INDEX "issue_parent_idx" ON "issue" USING btree ("parentId");--> statement-breakpoint
CREATE UNIQUE INDEX "label_org_name_idx" ON "label" USING btree ("organizationId","name");--> statement-breakpoint
CREATE INDEX "milestone_engagement_idx" ON "milestone" USING btree ("engagementId");--> statement-breakpoint
CREATE INDEX "outcome_engagement_idx" ON "outcome" USING btree ("engagementId");--> statement-breakpoint
CREATE INDEX "product_gap_org_status_idx" ON "product_gap" USING btree ("organizationId","status");--> statement-breakpoint
CREATE INDEX "product_gap_parent_idx" ON "product_gap" USING btree ("parentId");--> statement-breakpoint
CREATE INDEX "stakeholder_account_idx" ON "stakeholder" USING btree ("accountId");--> statement-breakpoint
CREATE INDEX "thread_engagement_idx" ON "thread" USING btree ("engagementId");--> statement-breakpoint
CREATE INDEX "thread_org_idx" ON "thread" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("userId");