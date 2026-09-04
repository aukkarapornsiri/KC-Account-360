CREATE TABLE "integration_connector_scopes" (
	"connector_key" text NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_connector_scopes_connector_key_tenant_id_company_id_pk" PRIMARY KEY("connector_key","tenant_id","company_id")
);
--> statement-breakpoint
ALTER TABLE "integration_connector_scopes" ADD CONSTRAINT "integration_connector_scopes_connector_key_integration_connectors_key_fk" FOREIGN KEY ("connector_key") REFERENCES "public"."integration_connectors"("key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connector_scopes" ADD CONSTRAINT "integration_connector_scopes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connector_scopes" ADD CONSTRAINT "integration_connector_scopes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_integration_connector_scopes_company" ON "integration_connector_scopes" USING btree ("company_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_integration_connector_scopes_tenant" ON "integration_connector_scopes" USING btree ("tenant_id");