CREATE TABLE `medical_records` (
	`id` text PRIMARY KEY NOT NULL,
	`visitor_id` text NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`mime_type` text NOT NULL,
	`uploaded_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `medical_records_object_key_unique` ON `medical_records` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_medical_records_visitor_uploaded` ON `medical_records` (`visitor_id`,`uploaded_at`);