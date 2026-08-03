import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const agentRateLimits = sqliteTable(
  "agent_rate_limits",
  {
    bucketHash: text("bucket_hash").notNull(),
    windowStart: text("window_start").notNull(),
    requestCount: integer("request_count").notNull().default(0),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.bucketHash, table.windowStart] }),
    index("idx_agent_rate_limits_updated_at").on(table.updatedAt),
  ],
);
