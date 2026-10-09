-- 幂等：重复执行（或 schema 已由运维预建）时不报错。
CREATE SCHEMA IF NOT EXISTS "platform";
--> statement-breakpoint
CREATE TABLE "platform"."agent_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"name" text NOT NULL,
	"content" text NOT NULL,
	"size" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."agent_mcp_servers" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"name" text NOT NULL,
	"spec" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."agent_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"rule_id" text NOT NULL,
	"kind" text DEFAULT 'on-demand' NOT NULL,
	"description" text,
	"content" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."agents" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"user_id" text DEFAULT 'default' NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"source_item_id" text,
	"config" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."installations" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"version_id" text NOT NULL,
	"config_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"installed_by" text DEFAULT 'default' NOT NULL,
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"user_id" text DEFAULT 'default' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."marketplace_items" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"summary" text,
	"description_md" text,
	"author_workspace_id" text DEFAULT 'default' NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"icon_url" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"latest_version_id" text,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"user_id" text DEFAULT 'default' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."marketplace_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"version" text NOT NULL,
	"manifest" jsonb NOT NULL,
	"readme_md" text,
	"changelog" text,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_agent_documents_unique" ON "platform"."agent_documents" USING btree ("agent_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_agent_mcp_unique" ON "platform"."agent_mcp_servers" USING btree ("agent_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_agent_rules_unique" ON "platform"."agent_rules" USING btree ("agent_id","rule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_agents_slug" ON "platform"."agents" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "idx_agents_scope" ON "platform"."agents" USING btree ("workspace_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_installations_scope" ON "platform"."installations" USING btree ("workspace_id","item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_marketplace_items_slug" ON "platform"."marketplace_items" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_marketplace_items_scope" ON "platform"."marketplace_items" USING btree ("type","status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_marketplace_versions_unique" ON "platform"."marketplace_versions" USING btree ("item_id","version");