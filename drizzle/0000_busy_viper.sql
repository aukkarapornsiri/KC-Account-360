CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`record_id` text,
	`action` text NOT NULL,
	`actor_email` text NOT NULL,
	`details` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`name` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `financial_records` (
	`id` text PRIMARY KEY NOT NULL,
	`module` text NOT NULL,
	`record_type` text NOT NULL,
	`document_no` text NOT NULL,
	`source_system` text DEFAULT 'KC Account' NOT NULL,
	`counterparty` text DEFAULT '' NOT NULL,
	`description` text NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`tax_amount` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'THB' NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`due_date` text,
	`period` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_by` text NOT NULL,
	`approver` text,
	`posted_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `financial_records_document_no_unique` ON `financial_records` (`document_no`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL
);
