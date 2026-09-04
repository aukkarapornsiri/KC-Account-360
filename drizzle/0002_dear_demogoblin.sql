CREATE INDEX `idx_financial_records_module_status` ON `financial_records` (`module`,`status`);--> statement-breakpoint
CREATE INDEX `idx_financial_records_period` ON `financial_records` (`period`);--> statement-breakpoint
CREATE INDEX `idx_master_data_category_name` ON `master_data` (`category`,`name`);