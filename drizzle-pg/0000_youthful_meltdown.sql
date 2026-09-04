CREATE TABLE "account_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"normal_balance" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_groups_category" CHECK ("account_groups"."category" in ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE')),
	CONSTRAINT "account_groups_normal_balance" CHECK ("account_groups"."normal_balance" in ('DEBIT','CREDIT'))
);
--> statement-breakpoint
CREATE TABLE "accounting_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"source_system" text NOT NULL,
	"source_document_type" text NOT NULL,
	"source_document_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"correlation_id" text,
	"transaction_date" date NOT NULL,
	"accounting_date" date NOT NULL,
	"currency" text NOT NULL,
	"amount" numeric(20, 4) NOT NULL,
	"tax" numeric(20, 4) DEFAULT '0' NOT NULL,
	"dimensions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"payload_hash" text NOT NULL,
	"status" text DEFAULT 'RECEIVED' NOT NULL,
	"failure_code" text,
	"failure_detail" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "accounting_events_amount_nonnegative" CHECK ("accounting_events"."amount" >= 0 and "accounting_events"."tax" >= 0)
);
--> statement-breakpoint
CREATE TABLE "accounting_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"period_no" integer NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"subledger_status" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "accounting_period_number" CHECK ("accounting_periods"."period_no" between 1 and 13),
	CONSTRAINT "accounting_period_date_order" CHECK ("accounting_periods"."ends_on" >= "accounting_periods"."starts_on"),
	CONSTRAINT "accounting_period_status" CHECK ("accounting_periods"."status" in ('OPEN','SOFT_CLOSE','REVIEW','CLOSED','LOCKED'))
);
--> statement-breakpoint
CREATE TABLE "approval_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"rule_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"maker_user_id" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"current_step" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "approval_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"document_type" text NOT NULL,
	"conditions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"steps" jsonb NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"approval_instance_id" uuid NOT NULL,
	"step_no" integer NOT NULL,
	"approver_role" text NOT NULL,
	"approver_user_id" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"action_by" text,
	"action_at" timestamp with time zone,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid,
	"branch_id" uuid,
	"module" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"reason" text,
	"old_value" jsonb,
	"new_value" jsonb,
	"approval_reference" text,
	"source_system" text DEFAULT 'KC Account 360' NOT NULL,
	"request_id" text,
	"correlation_id" text,
	"ip_address" text,
	"session_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"record_id" text,
	"action" text NOT NULL,
	"actor_email" text NOT NULL,
	"details" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"tax_branch_code" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chart_of_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"account_group_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name_th" text NOT NULL,
	"name_en" text,
	"normal_balance" text NOT NULL,
	"is_control_account" boolean DEFAULT false NOT NULL,
	"allow_manual_posting" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"statement_mapping" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "chart_of_accounts_normal_balance" CHECK ("chart_of_accounts"."normal_balance" in ('DEBIT','CREDIT'))
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" text NOT NULL,
	"legal_name" text NOT NULL,
	"tax_id" text,
	"base_currency" text DEFAULT 'THB' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "currencies" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"decimal_places" integer DEFAULT 2 NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	CONSTRAINT "currencies_decimal_places" CHECK ("currencies"."decimal_places" between 0 and 6)
);
--> statement-breakpoint
CREATE TABLE "dimensions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"type" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"external_references" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "dimensions_type" CHECK ("dimensions"."type" in ('DEPARTMENT','COST_CENTER','PROFIT_CENTER','PROJECT'))
);
--> statement-breakpoint
CREATE TABLE "document_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"document_type" text NOT NULL,
	"prefix" text NOT NULL,
	"next_number" bigint DEFAULT 1 NOT NULL,
	"padding" integer DEFAULT 6 NOT NULL,
	"reset_policy" text DEFAULT 'FISCAL_YEAR' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "document_sequences_next_positive" CHECK ("document_sequences"."next_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"record_id" text NOT NULL,
	"name" text NOT NULL,
	"object_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size" bigint NOT NULL,
	"uploaded_by" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "documents_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"from_currency" text NOT NULL,
	"to_currency" text NOT NULL,
	"rate_date" date NOT NULL,
	"rate" numeric(24, 10) NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exchange_rates_positive" CHECK ("exchange_rates"."rate" > 0)
);
--> statement-breakpoint
CREATE TABLE "financial_records" (
	"id" text PRIMARY KEY NOT NULL,
	"module" text NOT NULL,
	"record_type" text NOT NULL,
	"document_no" text NOT NULL,
	"source_system" text DEFAULT 'KC Account' NOT NULL,
	"counterparty" text DEFAULT '' NOT NULL,
	"description" text NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"tax_amount" bigint DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'THB' NOT NULL,
	"status" text DEFAULT 'Draft' NOT NULL,
	"due_date" text,
	"period" text NOT NULL,
	"metadata" text DEFAULT '{}' NOT NULL,
	"created_by" text NOT NULL,
	"approver" text,
	"posted_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "financial_records_document_no_unique" UNIQUE("document_no"),
	CONSTRAINT "financial_records_amount_nonnegative" CHECK ("financial_records"."amount" >= 0),
	CONSTRAINT "financial_records_tax_nonnegative" CHECK ("financial_records"."tax_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "fiscal_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fiscal_year_date_order" CHECK ("fiscal_years"."ends_on" >= "fiscal_years"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "integration_connectors" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"base_url" text DEFAULT '' NOT NULL,
	"api_key_hash" text,
	"status" text DEFAULT 'Setup Required' NOT NULL,
	"cursor" text DEFAULT '' NOT NULL,
	"records_synced" bigint DEFAULT 0 NOT NULL,
	"last_sync_at" text,
	"last_success_at" text,
	"last_error" text,
	"updated_by" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_events" (
	"id" text PRIMARY KEY NOT NULL,
	"source_system" text NOT NULL,
	"external_event_id" text NOT NULL,
	"direction" text DEFAULT 'Inbound' NOT NULL,
	"event_type" text NOT NULL,
	"payload" text NOT NULL,
	"payload_hash" text NOT NULL,
	"status" text DEFAULT 'Received' NOT NULL,
	"financial_record_id" text,
	"error" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"received_at" text NOT NULL,
	"processed_at" text
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"period_id" uuid NOT NULL,
	"accounting_event_id" uuid,
	"journal_no" text NOT NULL,
	"journal_type" text NOT NULL,
	"accounting_date" date NOT NULL,
	"description" text NOT NULL,
	"currency" text NOT NULL,
	"exchange_rate" numeric(24, 10) DEFAULT '1' NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"reversal_of_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text NOT NULL,
	"approved_by" text,
	"posted_by" text,
	"posted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journal_entries_status" CHECK ("journal_entries"."status" in ('DRAFT','PENDING_APPROVAL','APPROVED','POSTED','REVERSED','REJECTED','VOID'))
);
--> statement-breakpoint
CREATE TABLE "journal_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"account_id" uuid NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"debit" numeric(20, 4) DEFAULT '0' NOT NULL,
	"credit" numeric(20, 4) DEFAULT '0' NOT NULL,
	"base_debit" numeric(20, 4) DEFAULT '0' NOT NULL,
	"base_credit" numeric(20, 4) DEFAULT '0' NOT NULL,
	"dimensions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journal_lines_nonnegative" CHECK ("journal_lines"."debit" >= 0 and "journal_lines"."credit" >= 0 and "journal_lines"."base_debit" >= 0 and "journal_lines"."base_credit" >= 0),
	CONSTRAINT "journal_lines_one_side" CHECK (("journal_lines"."debit" > 0 and "journal_lines"."credit" = 0) or ("journal_lines"."credit" > 0 and "journal_lines"."debit" = 0))
);
--> statement-breakpoint
CREATE TABLE "master_data" (
	"id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"metadata" text DEFAULT '{}' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "master_data_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "posting_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"name" text NOT NULL,
	"version_no" integer DEFAULT 1 NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"conditions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"line_rules" jsonb NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"created_by" text NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"tax_type" text NOT NULL,
	"rate" numeric(9, 6) DEFAULT '0' NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"payable_account_id" uuid,
	"receivable_account_id" uuid,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tax_codes_rate_nonnegative" CHECK ("tax_codes"."rate" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "tenants_code_unique" UNIQUE("code"),
	CONSTRAINT "tenants_status_check" CHECK ("tenants"."status" in ('ACTIVE','SUSPENDED','INACTIVE'))
);
--> statement-breakpoint
CREATE TABLE "user_company_roles" (
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_company_roles_tenant_id_company_id_user_id_role_pk" PRIMARY KEY("tenant_id","company_id","user_id","role")
);
--> statement-breakpoint
ALTER TABLE "account_groups" ADD CONSTRAINT "account_groups_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_groups" ADD CONSTRAINT "account_groups_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_events" ADD CONSTRAINT "accounting_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_events" ADD CONSTRAINT "accounting_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_events" ADD CONSTRAINT "accounting_events_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_events" ADD CONSTRAINT "accounting_events_currency_currencies_code_fk" FOREIGN KEY ("currency") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_instances" ADD CONSTRAINT "approval_instances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_instances" ADD CONSTRAINT "approval_instances_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_instances" ADD CONSTRAINT "approval_instances_rule_id_approval_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."approval_rules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_rules" ADD CONSTRAINT "approval_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_rules" ADD CONSTRAINT "approval_rules_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_approval_instance_id_approval_instances_id_fk" FOREIGN KEY ("approval_instance_id") REFERENCES "public"."approval_instances"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_account_group_id_account_groups_id_fk" FOREIGN KEY ("account_group_id") REFERENCES "public"."account_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dimensions" ADD CONSTRAINT "dimensions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dimensions" ADD CONSTRAINT "dimensions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_record_id_financial_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."financial_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_from_currency_currencies_code_fk" FOREIGN KEY ("from_currency") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_to_currency_currencies_code_fk" FOREIGN KEY ("to_currency") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_years" ADD CONSTRAINT "fiscal_years_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_years" ADD CONSTRAINT "fiscal_years_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_events" ADD CONSTRAINT "integration_events_financial_record_id_financial_records_id_fk" FOREIGN KEY ("financial_record_id") REFERENCES "public"."financial_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_period_id_accounting_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."accounting_periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_accounting_event_id_accounting_events_id_fk" FOREIGN KEY ("accounting_event_id") REFERENCES "public"."accounting_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_currency_currencies_code_fk" FOREIGN KEY ("currency") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posting_rules" ADD CONSTRAINT "posting_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posting_rules" ADD CONSTRAINT "posting_rules_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_codes" ADD CONSTRAINT "tax_codes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_codes" ADD CONSTRAINT "tax_codes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_codes" ADD CONSTRAINT "tax_codes_payable_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("payable_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_codes" ADD CONSTRAINT "tax_codes_receivable_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("receivable_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_company_roles" ADD CONSTRAINT "user_company_roles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_company_roles" ADD CONSTRAINT "user_company_roles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_account_groups_company_code" ON "account_groups" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "idx_account_groups_tenant" ON "account_groups" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_accounting_events_tenant_source_idempotency" ON "accounting_events" USING btree ("tenant_id","source_system","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_accounting_events_tenant_source_event" ON "accounting_events" USING btree ("tenant_id","source_system","event_id");--> statement-breakpoint
CREATE INDEX "idx_accounting_events_company_status" ON "accounting_events" USING btree ("company_id","status","created_at");--> statement-breakpoint
CREATE INDEX "idx_accounting_events_branch" ON "accounting_events" USING btree ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_accounting_periods_year_number" ON "accounting_periods" USING btree ("fiscal_year_id","period_no");--> statement-breakpoint
CREATE INDEX "idx_accounting_periods_company_status" ON "accounting_periods" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "idx_accounting_periods_tenant" ON "accounting_periods" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_approval_instances_entity" ON "approval_instances" USING btree ("tenant_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_approval_instances_company_status" ON "approval_instances" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "idx_approval_rules_company_document" ON "approval_rules" USING btree ("company_id","document_type","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_approval_steps_instance_step" ON "approval_steps" USING btree ("approval_instance_id","step_no");--> statement-breakpoint
CREATE INDEX "idx_approval_steps_approver_status" ON "approval_steps" USING btree ("approver_user_id","status");--> statement-breakpoint
CREATE INDEX "idx_audit_events_tenant_created" ON "audit_events" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_events_entity" ON "audit_events" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_events_company" ON "audit_events" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_events_branch" ON "audit_events" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_record_created" ON "audit_logs" USING btree ("record_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_branches_company_code" ON "branches" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "idx_branches_tenant" ON "branches" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_branches_company" ON "branches" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_chart_of_accounts_company_code" ON "chart_of_accounts" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "idx_chart_of_accounts_tenant" ON "chart_of_accounts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_chart_of_accounts_group" ON "chart_of_accounts" USING btree ("account_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_companies_tenant_code" ON "companies" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "idx_companies_tenant" ON "companies" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_dimensions_company_type_code" ON "dimensions" USING btree ("company_id","type","code");--> statement-breakpoint
CREATE INDEX "idx_dimensions_tenant" ON "dimensions" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_sequences_scope_type" ON "document_sequences" USING btree ("company_id","branch_id","document_type");--> statement-breakpoint
CREATE INDEX "idx_document_sequences_tenant" ON "document_sequences" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_document_sequences_branch" ON "document_sequences" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_documents_record_id" ON "documents" USING btree ("record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_exchange_rates_company_pair_date" ON "exchange_rates" USING btree ("company_id","from_currency","to_currency","rate_date");--> statement-breakpoint
CREATE INDEX "idx_exchange_rates_tenant" ON "exchange_rates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_financial_records_module_status" ON "financial_records" USING btree ("module","status");--> statement-breakpoint
CREATE INDEX "idx_financial_records_period" ON "financial_records" USING btree ("period");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_fiscal_years_company_name" ON "fiscal_years" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "idx_fiscal_years_tenant" ON "fiscal_years" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_integration_connectors_status" ON "integration_connectors" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_integration_events_source_external" ON "integration_events" USING btree ("source_system","external_event_id");--> statement-breakpoint
CREATE INDEX "idx_integration_events_source_status" ON "integration_events" USING btree ("source_system","status");--> statement-breakpoint
CREATE INDEX "idx_integration_events_status_received" ON "integration_events" USING btree ("status","received_at");--> statement-breakpoint
CREATE INDEX "idx_integration_events_financial_record" ON "integration_events" USING btree ("financial_record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_journal_entries_company_number" ON "journal_entries" USING btree ("company_id","journal_no");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_journal_entries_event" ON "journal_entries" USING btree ("accounting_event_id");--> statement-breakpoint
CREATE INDEX "idx_journal_entries_tenant" ON "journal_entries" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_journal_entries_period_status" ON "journal_entries" USING btree ("period_id","status");--> statement-breakpoint
CREATE INDEX "idx_journal_entries_branch" ON "journal_entries" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_journal_entries_reversal" ON "journal_entries" USING btree ("reversal_of_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_journal_lines_entry_line" ON "journal_lines" USING btree ("journal_entry_id","line_no");--> statement-breakpoint
CREATE INDEX "idx_journal_lines_account" ON "journal_lines" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_master_data_category_name" ON "master_data" USING btree ("category","name");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_posting_rules_company_event_version" ON "posting_rules" USING btree ("company_id","event_type","version_no");--> statement-breakpoint
CREATE INDEX "idx_posting_rules_tenant" ON "posting_rules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_posting_rules_active_lookup" ON "posting_rules" USING btree ("company_id","event_type","status","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tax_codes_company_code_effective" ON "tax_codes" USING btree ("company_id","code","effective_from");--> statement-breakpoint
CREATE INDEX "idx_tax_codes_tenant" ON "tax_codes" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_tax_codes_payable_account" ON "tax_codes" USING btree ("payable_account_id");--> statement-breakpoint
CREATE INDEX "idx_tax_codes_receivable_account" ON "tax_codes" USING btree ("receivable_account_id");--> statement-breakpoint
CREATE INDEX "idx_user_company_roles_user" ON "user_company_roles" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_user_company_roles_company" ON "user_company_roles" USING btree ("company_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION kc_assert_balanced_journal() RETURNS trigger AS $$
DECLARE
  total_debit numeric(20,4);
  total_credit numeric(20,4);
BEGIN
  IF NEW.status = 'POSTED' AND OLD.status IS DISTINCT FROM 'POSTED' THEN
    SELECT COALESCE(SUM(base_debit), 0), COALESCE(SUM(base_credit), 0)
      INTO total_debit, total_credit
      FROM journal_lines
     WHERE journal_entry_id = NEW.id;
    IF total_debit <= 0 OR total_debit <> total_credit THEN
      RAISE EXCEPTION 'JOURNAL_UNBALANCED: debit %, credit %', total_debit, total_credit
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER journal_must_balance_before_post
AFTER UPDATE OF status ON journal_entries
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION kc_assert_balanced_journal();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION kc_protect_posted_journal() RETURNS trigger AS $$
DECLARE
  protected_status text;
BEGIN
  IF TG_TABLE_NAME = 'journal_entries' THEN
    protected_status := OLD.status;
  ELSE
    SELECT status INTO protected_status FROM journal_entries WHERE id = OLD.journal_entry_id;
  END IF;
  IF protected_status IN ('POSTED', 'REVERSED') THEN
    RAISE EXCEPTION 'POSTED_JOURNAL_IMMUTABLE' USING ERRCODE = '55000';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER protect_posted_journal_entry
BEFORE UPDATE OR DELETE ON journal_entries
FOR EACH ROW WHEN (OLD.status IN ('POSTED', 'REVERSED'))
EXECUTE FUNCTION kc_protect_posted_journal();
--> statement-breakpoint
CREATE TRIGGER protect_posted_journal_lines
BEFORE UPDATE OR DELETE ON journal_lines
FOR EACH ROW EXECUTE FUNCTION kc_protect_posted_journal();
