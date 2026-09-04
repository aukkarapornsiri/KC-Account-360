CREATE TABLE "company_experience_settings" (
	"company_id" uuid PRIMARY KEY NOT NULL,
	"application_name" text DEFAULT 'KC Account 360' NOT NULL,
	"theme_tokens" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"branding" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"navigation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"document_branding" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_dashboard_layouts" (
	"user_id" text NOT NULL,
	"dashboard_key" text NOT NULL,
	"layout" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "user_dashboard_layouts_user_id_dashboard_key_pk" PRIMARY KEY("user_id","dashboard_key")
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"language" text DEFAULT 'th' NOT NULL,
	"theme" text DEFAULT 'light' NOT NULL,
	"table_density" text DEFAULT 'comfortable' NOT NULL,
	"sidebar_mode" text DEFAULT 'expanded' NOT NULL,
	"page_width" text DEFAULT 'full' NOT NULL,
	"date_format" text DEFAULT 'DD/MM/YYYY' NOT NULL,
	"negative_number_format" text DEFAULT 'parentheses' NOT NULL,
	"default_company_id" uuid,
	"default_branch_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "user_preferences_language" CHECK ("user_preferences"."language" in ('th','en','ja','zh')),
	CONSTRAINT "user_preferences_theme" CHECK ("user_preferences"."theme" in ('light','dark','system')),
	CONSTRAINT "user_preferences_density" CHECK ("user_preferences"."table_density" in ('comfortable','compact')),
	CONSTRAINT "user_preferences_sidebar" CHECK ("user_preferences"."sidebar_mode" in ('expanded','collapsed','auto')),
	CONSTRAINT "user_preferences_page_width" CHECK ("user_preferences"."page_width" in ('full','contained'))
);
--> statement-breakpoint
CREATE TABLE "user_saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"company_id" uuid,
	"module" text NOT NULL,
	"name" text NOT NULL,
	"visibility" text DEFAULT 'PRIVATE' NOT NULL,
	"role_default_for" text,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_saved_views_visibility" CHECK ("user_saved_views"."visibility" in ('PRIVATE','SHARED','ROLE_DEFAULT'))
);
--> statement-breakpoint
ALTER TABLE "company_experience_settings" ADD CONSTRAINT "company_experience_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_default_company_id_companies_id_fk" FOREIGN KEY ("default_company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_default_branch_id_branches_id_fk" FOREIGN KEY ("default_branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_saved_views" ADD CONSTRAINT "user_saved_views_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_preferences_company" ON "user_preferences" USING btree ("default_company_id");--> statement-breakpoint
CREATE INDEX "idx_user_preferences_branch" ON "user_preferences" USING btree ("default_branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_saved_views_name" ON "user_saved_views" USING btree ("user_id","module","name");--> statement-breakpoint
CREATE INDEX "idx_user_saved_views_company_module" ON "user_saved_views" USING btree ("company_id","module");