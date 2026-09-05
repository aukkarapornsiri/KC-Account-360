CREATE TABLE "document_number_sequences" (
	"series_key" text PRIMARY KEY NOT NULL,
	"prefix" text NOT NULL,
	"period_key" text NOT NULL,
	"next_number" bigint DEFAULT 1 NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "document_number_sequences_next_positive" CHECK ("document_number_sequences"."next_number" > 0),
	CONSTRAINT "document_number_sequences_period_format" CHECK ("document_number_sequences"."period_key" ~ '^[0-9]{6}$')
);
--> statement-breakpoint
CREATE INDEX "idx_document_number_sequences_period" ON "document_number_sequences" USING btree ("period_key","prefix");