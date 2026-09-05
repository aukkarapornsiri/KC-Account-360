CREATE TABLE "accounting_document_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(20, 6) DEFAULT '1' NOT NULL,
	"unit_price" numeric(20, 4) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(20, 4) DEFAULT '0' NOT NULL,
	"tax_code_id" uuid,
	"account_id" uuid,
	"dimensions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "accounting_document_lines_values" CHECK ("accounting_document_lines"."quantity" > 0 and "accounting_document_lines"."unit_price" >= 0 and "accounting_document_lines"."discount_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "accounting_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"partner_id" uuid,
	"module" text NOT NULL,
	"document_type" text NOT NULL,
	"document_no" text NOT NULL,
	"external_document_no" text,
	"document_date" date NOT NULL,
	"due_date" date,
	"currency" text NOT NULL,
	"subtotal" numeric(20, 4) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(20, 4) DEFAULT '0' NOT NULL,
	"withholding_amount" numeric(20, 4) DEFAULT '0' NOT NULL,
	"total_amount" numeric(20, 4) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"source_system" text DEFAULT 'KC Account 360' NOT NULL,
	"source_document_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text NOT NULL,
	"approved_by" text,
	"posted_journal_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "accounting_documents_module" CHECK ("accounting_documents"."module" in ('AP','AR','CASH','TAX','GL')),
	CONSTRAINT "accounting_documents_amounts" CHECK ("accounting_documents"."subtotal" >= 0 and "accounting_documents"."tax_amount" >= 0 and "accounting_documents"."withholding_amount" >= 0 and "accounting_documents"."total_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ai_recommendation_actions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"recommendation_id" uuid NOT NULL,
	"action" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"reason" text,
	"edited_action" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_recommendation_actions_action" CHECK ("ai_recommendation_actions"."action" in ('ACCEPT','REJECT','EDIT','APPLY'))
);
--> statement-breakpoint
CREATE TABLE "ai_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"recommendation_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"title" text NOT NULL,
	"rationale" text NOT NULL,
	"confidence" numeric(5, 4) NOT NULL,
	"source_evidence" jsonb NOT NULL,
	"proposed_action" jsonb NOT NULL,
	"status" text DEFAULT 'PROPOSED' NOT NULL,
	"model" text DEFAULT 'rules-v1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"review_reason" text,
	CONSTRAINT "ai_recommendations_confidence" CHECK ("ai_recommendations"."confidence" >= 0 and "ai_recommendations"."confidence" <= 1),
	CONSTRAINT "ai_recommendations_status" CHECK ("ai_recommendations"."status" in ('PROPOSED','ACCEPTED','REJECTED','EXPIRED','APPLIED'))
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"code" text NOT NULL,
	"bank_name" text NOT NULL,
	"masked_account_no" text NOT NULL,
	"currency" text NOT NULL,
	"gl_account_id" uuid NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"statement_line_id" uuid NOT NULL,
	"journal_entry_id" uuid,
	"settlement_document_id" uuid,
	"matched_amount" numeric(20, 4) NOT NULL,
	"match_method" text NOT NULL,
	"confidence" numeric(5, 4),
	"status" text DEFAULT 'PROPOSED' NOT NULL,
	"proposed_by" text NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_matches_status" CHECK ("bank_matches"."status" in ('PROPOSED','ACCEPTED','REJECTED','REVERSED')),
	CONSTRAINT "bank_matches_confidence" CHECK ("bank_matches"."confidence" is null or ("bank_matches"."confidence" >= 0 and "bank_matches"."confidence" <= 1))
);
--> statement-breakpoint
CREATE TABLE "bank_statement_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"transaction_date" date NOT NULL,
	"description" text NOT NULL,
	"reference" text,
	"debit" numeric(20, 4) DEFAULT '0' NOT NULL,
	"credit" numeric(20, 4) DEFAULT '0' NOT NULL,
	"balance" numeric(20, 4),
	"status" text DEFAULT 'UNMATCHED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_statement_lines_one_side" CHECK (("bank_statement_lines"."debit" > 0 and "bank_statement_lines"."credit" = 0) or ("bank_statement_lines"."credit" > 0 and "bank_statement_lines"."debit" = 0))
);
--> statement-breakpoint
CREATE TABLE "business_partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"partner_type" text NOT NULL,
	"legal_name" text NOT NULL,
	"tax_id" text,
	"currency" text DEFAULT 'THB' NOT NULL,
	"payment_terms_days" integer DEFAULT 0 NOT NULL,
	"control_account_id" uuid,
	"external_references" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "business_partners_type" CHECK ("business_partners"."partner_type" in ('CUSTOMER','VENDOR','BOTH')),
	CONSTRAINT "business_partners_terms" CHECK ("business_partners"."payment_terms_days" between 0 and 3650)
);
--> statement-breakpoint
CREATE TABLE "external_subledger_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"source_system" text NOT NULL,
	"subledger" text NOT NULL,
	"period_id" uuid NOT NULL,
	"external_amount" numeric(20, 4) NOT NULL,
	"gl_amount" numeric(20, 4) NOT NULL,
	"difference" numeric(20, 4) NOT NULL,
	"status" text DEFAULT 'UNRECONCILED' NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reconciled_by" text,
	"reconciled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_subledger_status" CHECK ("external_subledger_balances"."status" in ('UNRECONCILED','RECONCILED','EXCEPTION'))
);
--> statement-breakpoint
CREATE TABLE "open_item_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"open_item_id" uuid NOT NULL,
	"settlement_document_id" uuid NOT NULL,
	"amount" numeric(20, 4) NOT NULL,
	"allocated_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reversed_at" timestamp with time zone,
	"reversal_reason" text,
	CONSTRAINT "open_item_allocations_positive" CHECK ("open_item_allocations"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "open_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"item_type" text NOT NULL,
	"due_date" date,
	"original_amount" numeric(20, 4) NOT NULL,
	"outstanding_amount" numeric(20, 4) NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "open_items_type" CHECK ("open_items"."item_type" in ('RECEIVABLE','PAYABLE')),
	CONSTRAINT "open_items_amounts" CHECK ("open_items"."original_amount" >= 0 and "open_items"."outstanding_amount" >= 0 and "open_items"."outstanding_amount" <= "open_items"."original_amount")
);
--> statement-breakpoint
CREATE TABLE "period_close_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"status" text DEFAULT 'IN_PROGRESS' NOT NULL,
	"started_by" text NOT NULL,
	"approved_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"locked_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "period_close_runs_status" CHECK ("period_close_runs"."status" in ('IN_PROGRESS','READY_FOR_APPROVAL','APPROVED','LOCKED','REOPENED','CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE "period_close_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"close_run_id" uuid NOT NULL,
	"task_key" text NOT NULL,
	"title" text NOT NULL,
	"sequence" integer NOT NULL,
	"blocking" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"completed_by" text,
	"completed_at" timestamp with time zone,
	CONSTRAINT "period_close_tasks_status" CHECK ("period_close_tasks"."status" in ('PENDING','IN_PROGRESS','COMPLETED','BLOCKED','WAIVED'))
);
--> statement-breakpoint
ALTER TABLE "accounting_document_lines" ADD CONSTRAINT "accounting_document_lines_document_id_accounting_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."accounting_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_document_lines" ADD CONSTRAINT "accounting_document_lines_tax_code_id_tax_codes_id_fk" FOREIGN KEY ("tax_code_id") REFERENCES "public"."tax_codes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_document_lines" ADD CONSTRAINT "accounting_document_lines_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_documents" ADD CONSTRAINT "accounting_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_documents" ADD CONSTRAINT "accounting_documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_documents" ADD CONSTRAINT "accounting_documents_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_documents" ADD CONSTRAINT "accounting_documents_partner_id_business_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."business_partners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_documents" ADD CONSTRAINT "accounting_documents_currency_currencies_code_fk" FOREIGN KEY ("currency") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_documents" ADD CONSTRAINT "accounting_documents_posted_journal_id_journal_entries_id_fk" FOREIGN KEY ("posted_journal_id") REFERENCES "public"."journal_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_recommendation_actions" ADD CONSTRAINT "ai_recommendation_actions_recommendation_id_ai_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."ai_recommendations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_currency_currencies_code_fk" FOREIGN KEY ("currency") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_gl_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("gl_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_matches" ADD CONSTRAINT "bank_matches_statement_line_id_bank_statement_lines_id_fk" FOREIGN KEY ("statement_line_id") REFERENCES "public"."bank_statement_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_matches" ADD CONSTRAINT "bank_matches_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_matches" ADD CONSTRAINT "bank_matches_settlement_document_id_accounting_documents_id_fk" FOREIGN KEY ("settlement_document_id") REFERENCES "public"."accounting_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_partners" ADD CONSTRAINT "business_partners_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_partners" ADD CONSTRAINT "business_partners_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_partners" ADD CONSTRAINT "business_partners_currency_currencies_code_fk" FOREIGN KEY ("currency") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_partners" ADD CONSTRAINT "business_partners_control_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("control_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_subledger_balances" ADD CONSTRAINT "external_subledger_balances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_subledger_balances" ADD CONSTRAINT "external_subledger_balances_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_subledger_balances" ADD CONSTRAINT "external_subledger_balances_period_id_accounting_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."accounting_periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_item_allocations" ADD CONSTRAINT "open_item_allocations_open_item_id_open_items_id_fk" FOREIGN KEY ("open_item_id") REFERENCES "public"."open_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_item_allocations" ADD CONSTRAINT "open_item_allocations_settlement_document_id_accounting_documents_id_fk" FOREIGN KEY ("settlement_document_id") REFERENCES "public"."accounting_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_items" ADD CONSTRAINT "open_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_items" ADD CONSTRAINT "open_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_items" ADD CONSTRAINT "open_items_partner_id_business_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."business_partners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_items" ADD CONSTRAINT "open_items_document_id_accounting_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."accounting_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_items" ADD CONSTRAINT "open_items_currency_currencies_code_fk" FOREIGN KEY ("currency") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_close_runs" ADD CONSTRAINT "period_close_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_close_runs" ADD CONSTRAINT "period_close_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_close_runs" ADD CONSTRAINT "period_close_runs_period_id_accounting_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."accounting_periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_close_tasks" ADD CONSTRAINT "period_close_tasks_close_run_id_period_close_runs_id_fk" FOREIGN KEY ("close_run_id") REFERENCES "public"."period_close_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_accounting_document_lines_number" ON "accounting_document_lines" USING btree ("document_id","line_no");--> statement-breakpoint
CREATE INDEX "idx_accounting_document_lines_account" ON "accounting_document_lines" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_accounting_document_lines_tax" ON "accounting_document_lines" USING btree ("tax_code_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_accounting_documents_company_number" ON "accounting_documents" USING btree ("company_id","document_no");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_accounting_documents_partner_external" ON "accounting_documents" USING btree ("company_id","partner_id","document_type","external_document_no");--> statement-breakpoint
CREATE INDEX "idx_accounting_documents_tenant_module_status" ON "accounting_documents" USING btree ("tenant_id","module","status");--> statement-breakpoint
CREATE INDEX "idx_accounting_documents_partner_due" ON "accounting_documents" USING btree ("partner_id","due_date");--> statement-breakpoint
CREATE INDEX "idx_accounting_documents_branch" ON "accounting_documents" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_accounting_documents_posted_journal" ON "accounting_documents" USING btree ("posted_journal_id");--> statement-breakpoint
CREATE INDEX "idx_ai_recommendation_actions_recommendation" ON "ai_recommendation_actions" USING btree ("recommendation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ai_recommendations_company_dedupe" ON "ai_recommendations" USING btree ("company_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "idx_ai_recommendations_company_status" ON "ai_recommendations" USING btree ("company_id","status","created_at");--> statement-breakpoint
CREATE INDEX "idx_ai_recommendations_entity" ON "ai_recommendations" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_ai_recommendations_branch" ON "ai_recommendations" USING btree ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_bank_accounts_company_code" ON "bank_accounts" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "idx_bank_accounts_tenant_status" ON "bank_accounts" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_bank_accounts_branch" ON "bank_accounts" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_bank_accounts_gl" ON "bank_accounts" USING btree ("gl_account_id");--> statement-breakpoint
CREATE INDEX "idx_bank_matches_statement_status" ON "bank_matches" USING btree ("statement_line_id","status");--> statement-breakpoint
CREATE INDEX "idx_bank_matches_journal" ON "bank_matches" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "idx_bank_matches_settlement" ON "bank_matches" USING btree ("settlement_document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_bank_statement_lines_external" ON "bank_statement_lines" USING btree ("bank_account_id","external_id");--> statement-breakpoint
CREATE INDEX "idx_bank_statement_lines_status_date" ON "bank_statement_lines" USING btree ("bank_account_id","status","transaction_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_business_partners_company_code" ON "business_partners" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "idx_business_partners_tenant_type" ON "business_partners" USING btree ("tenant_id","partner_type","status");--> statement-breakpoint
CREATE INDEX "idx_business_partners_control_account" ON "business_partners" USING btree ("control_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_external_subledger_balance_scope" ON "external_subledger_balances" USING btree ("company_id","source_system","subledger","period_id");--> statement-breakpoint
CREATE INDEX "idx_external_subledger_tenant_status" ON "external_subledger_balances" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_external_subledger_period" ON "external_subledger_balances" USING btree ("period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_open_item_allocations_pair" ON "open_item_allocations" USING btree ("open_item_id","settlement_document_id");--> statement-breakpoint
CREATE INDEX "idx_open_item_allocations_settlement" ON "open_item_allocations" USING btree ("settlement_document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_open_items_document" ON "open_items" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_open_items_tenant_type_status" ON "open_items" USING btree ("tenant_id","item_type","status");--> statement-breakpoint
CREATE INDEX "idx_open_items_partner_due" ON "open_items" USING btree ("partner_id","due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_period_close_runs_active" ON "period_close_runs" USING btree ("period_id") WHERE "period_close_runs"."status" in ('IN_PROGRESS','READY_FOR_APPROVAL','APPROVED');--> statement-breakpoint
CREATE INDEX "idx_period_close_runs_company_status" ON "period_close_runs" USING btree ("company_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_period_close_tasks_key" ON "period_close_tasks" USING btree ("close_run_id","task_key");--> statement-breakpoint
CREATE INDEX "idx_period_close_tasks_status" ON "period_close_tasks" USING btree ("close_run_id","status","sequence");