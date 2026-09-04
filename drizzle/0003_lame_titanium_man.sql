CREATE TABLE `integration_connectors` (
	`key` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`base_url` text DEFAULT '' NOT NULL,
	`api_key_hash` text,
	`status` text DEFAULT 'Setup Required' NOT NULL,
	`cursor` text DEFAULT '' NOT NULL,
	`records_synced` integer DEFAULT 0 NOT NULL,
	`last_sync_at` text,
	`last_success_at` text,
	`last_error` text,
	`updated_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_integration_connectors_status` ON `integration_connectors` (`status`);--> statement-breakpoint
CREATE TABLE `integration_events` (
	`id` text PRIMARY KEY NOT NULL,
	`source_system` text NOT NULL,
	`external_event_id` text NOT NULL,
	`direction` text DEFAULT 'Inbound' NOT NULL,
	`event_type` text NOT NULL,
	`payload` text NOT NULL,
	`payload_hash` text NOT NULL,
	`status` text DEFAULT 'Received' NOT NULL,
	`financial_record_id` text,
	`error` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`received_at` text NOT NULL,
	`processed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_integration_events_source_external` ON `integration_events` (`source_system`,`external_event_id`);--> statement-breakpoint
CREATE INDEX `idx_integration_events_source_status` ON `integration_events` (`source_system`,`status`);--> statement-breakpoint
CREATE INDEX `idx_integration_events_status_received` ON `integration_events` (`status`,`received_at`);