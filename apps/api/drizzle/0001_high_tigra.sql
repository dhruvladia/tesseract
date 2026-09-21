CREATE TYPE "public"."handoff_event_kind" AS ENUM('created', 'section_marked', 'gap_added', 'gap_resolved', 'gap_reopened', 'accepted', 'reopened', 'draft_generated', 'draft_applied');--> statement-breakpoint
CREATE TABLE "handoff_event" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"handoffId" text NOT NULL,
	"engagementId" text NOT NULL,
	"kind" "handoff_kind" NOT NULL,
	"event" "handoff_event_kind" NOT NULL,
	"actorId" text,
	"meta" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phase_event" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"engagementId" text NOT NULL,
	"from" "phase" NOT NULL,
	"to" "phase" NOT NULL,
	"actorId" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "handoff_event" ADD CONSTRAINT "handoff_event_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoff_event" ADD CONSTRAINT "handoff_event_handoffId_handoff_id_fk" FOREIGN KEY ("handoffId") REFERENCES "public"."handoff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoff_event" ADD CONSTRAINT "handoff_event_engagementId_engagement_id_fk" FOREIGN KEY ("engagementId") REFERENCES "public"."engagement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoff_event" ADD CONSTRAINT "handoff_event_actorId_user_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phase_event" ADD CONSTRAINT "phase_event_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phase_event" ADD CONSTRAINT "phase_event_engagementId_engagement_id_fk" FOREIGN KEY ("engagementId") REFERENCES "public"."engagement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phase_event" ADD CONSTRAINT "phase_event_actorId_user_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "handoff_event_handoff_idx" ON "handoff_event" USING btree ("handoffId");--> statement-breakpoint
CREATE INDEX "handoff_event_engagement_idx" ON "handoff_event" USING btree ("engagementId");--> statement-breakpoint
CREATE INDEX "phase_event_engagement_idx" ON "phase_event" USING btree ("engagementId");