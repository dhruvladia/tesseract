CREATE TYPE "public"."draft_status" AS ENUM('pending', 'applied', 'dismissed');--> statement-breakpoint
CREATE TABLE "handoff_draft" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"engagementId" text NOT NULL,
	"kind" "handoff_kind" NOT NULL,
	"sourceId" text,
	"proposal" jsonb NOT NULL,
	"model" text NOT NULL,
	"status" "draft_status" DEFAULT 'pending' NOT NULL,
	"appliedById" text,
	"appliedAt" timestamp with time zone,
	"createdById" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "handoff_source" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"engagementId" text NOT NULL,
	"kind" "handoff_kind" NOT NULL,
	"label" text NOT NULL,
	"text" text NOT NULL,
	"createdById" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "handoff_draft" ADD CONSTRAINT "handoff_draft_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoff_draft" ADD CONSTRAINT "handoff_draft_engagementId_engagement_id_fk" FOREIGN KEY ("engagementId") REFERENCES "public"."engagement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoff_draft" ADD CONSTRAINT "handoff_draft_sourceId_handoff_source_id_fk" FOREIGN KEY ("sourceId") REFERENCES "public"."handoff_source"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoff_draft" ADD CONSTRAINT "handoff_draft_appliedById_user_id_fk" FOREIGN KEY ("appliedById") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoff_draft" ADD CONSTRAINT "handoff_draft_createdById_user_id_fk" FOREIGN KEY ("createdById") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoff_source" ADD CONSTRAINT "handoff_source_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoff_source" ADD CONSTRAINT "handoff_source_engagementId_engagement_id_fk" FOREIGN KEY ("engagementId") REFERENCES "public"."engagement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoff_source" ADD CONSTRAINT "handoff_source_createdById_user_id_fk" FOREIGN KEY ("createdById") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "handoff_draft_engagement_idx" ON "handoff_draft" USING btree ("engagementId","kind");--> statement-breakpoint
CREATE INDEX "handoff_source_engagement_idx" ON "handoff_source" USING btree ("engagementId");