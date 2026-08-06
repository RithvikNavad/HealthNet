CREATE TABLE `agent_rate_limits` (
	`bucket_hash` text NOT NULL,
	`window_start` text NOT NULL,
	`request_count` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`bucket_hash`, `window_start`)
);
--> statement-breakpoint
CREATE INDEX `idx_agent_rate_limits_updated_at` ON `agent_rate_limits` (`updated_at`);