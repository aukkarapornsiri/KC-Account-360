CREATE TABLE "access_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"department" text NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"module_access" jsonb DEFAULT '["ALL"]'::jsonb NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "access_policies_status" CHECK ("access_policies"."status" in ('ACTIVE','INACTIVE'))
);
--> statement-breakpoint
CREATE TABLE "company_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"department" text NOT NULL,
	"employee_code" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "company_users_status" CHECK ("company_users"."status" in ('ACTIVE','SUSPENDED','INACTIVE'))
);
--> statement-breakpoint
ALTER TABLE "user_company_roles" ADD COLUMN "access_policy_id" uuid;--> statement-breakpoint
ALTER TABLE "user_company_roles" ADD COLUMN "branch_scope" jsonb DEFAULT '["ALL"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "access_policies" ADD CONSTRAINT "access_policies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_policies" ADD CONSTRAINT "access_policies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_users" ADD CONSTRAINT "company_users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_users" ADD CONSTRAINT "company_users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_access_policies_company_key" ON "access_policies" USING btree ("company_id","key");--> statement-breakpoint
CREATE INDEX "idx_access_policies_tenant_status" ON "access_policies" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_company_users_email" ON "company_users" USING btree ("company_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_company_users_employee_code" ON "company_users" USING btree ("company_id","employee_code");--> statement-breakpoint
CREATE INDEX "idx_company_users_tenant_status" ON "company_users" USING btree ("tenant_id","status");--> statement-breakpoint
ALTER TABLE "user_company_roles" ADD CONSTRAINT "user_company_roles_access_policy_id_access_policies_id_fk" FOREIGN KEY ("access_policy_id") REFERENCES "public"."access_policies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_company_roles_policy" ON "user_company_roles" USING btree ("access_policy_id");