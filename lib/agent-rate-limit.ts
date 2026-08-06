import { env } from "cloudflare:workers";

type LimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  message?: string;
};

type D1Like = {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
    run(): Promise<unknown>;
  };
};

const memoryBuckets = new Map<string, number>();

const limits = {
  visitor: 20,
  network: 120,
  visit: 15,
  documentVisitor: 3,
  documentNetwork: 30,
  documentAnalysis: 1,
};

function secondsUntilTomorrow() {
  const now = new Date();
  const tomorrow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(60, Math.ceil((tomorrow - now.getTime()) / 1000));
}

async function hashBucket(value: string) {
  const bytes = new TextEncoder().encode(`healthnet-public-demo:${value}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function database(): D1Like | null {
  try {
    return (env.DB as D1Like | undefined) || null;
  } catch {
    return null;
  }
}

async function initialize(db: D1Like) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS agent_rate_limits (
    bucket_hash TEXT NOT NULL,
    window_start TEXT NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (bucket_hash, window_start)
  )`).run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_agent_rate_limits_updated_at ON agent_rate_limits(updated_at)").run();
}

async function increment(db: D1Like | null, bucketHash: string, windowStart: string) {
  if (!db) {
    const key = `${bucketHash}:${windowStart}`;
    const count = (memoryBuckets.get(key) || 0) + 1;
    memoryBuckets.set(key, count);
    return count;
  }

  const row = await db.prepare(`INSERT INTO agent_rate_limits (bucket_hash, window_start, request_count, updated_at)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(bucket_hash, window_start) DO UPDATE SET
      request_count = request_count + 1,
      updated_at = excluded.updated_at
    RETURNING request_count`)
    .bind(bucketHash, windowStart, new Date().toISOString())
    .first<{ request_count: number }>();
  return row?.request_count || 1;
}

export async function enforceAgentRateLimit(request: Request, visitorId: string, visitId: string): Promise<LimitResult> {
  const db = database();
  if (db) await initialize(db);

  const forwardedFor = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown-network";
  const day = new Date().toISOString().slice(0, 10);
  const buckets = [
    { value: `visitor:${visitorId}`, limit: limits.visitor, label: "visitor" },
    { value: `network:${forwardedFor}`, limit: limits.network, label: "network" },
    { value: `visit:${visitId}`, limit: limits.visit, label: "visit" },
  ] as const;

  let remaining = Number.POSITIVE_INFINITY;
  for (const bucket of buckets) {
    const count = await increment(db, await hashBucket(bucket.value), day);
    remaining = Math.min(remaining, Math.max(0, bucket.limit - count));
    if (count > bucket.limit) {
      const message = bucket.label === "visit"
        ? "This demo intake has reached its 15-message limit. Start a new fictional intake to continue."
        : "This public demo has reached its AI usage limit for today. Please try again tomorrow.";
      return { allowed: false, remaining: 0, retryAfterSeconds: secondsUntilTomorrow(), message };
    }
  }

  return { allowed: true, remaining, retryAfterSeconds: secondsUntilTomorrow() };
}

export async function enforceDocumentAnalysisRateLimit(request: Request, visitorId: string, analysisId: string): Promise<LimitResult> {
  const db = database();
  if (db) await initialize(db);

  const forwardedFor = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown-network";
  const day = new Date().toISOString().slice(0, 10);
  const buckets = [
    { value: `document-visitor:${visitorId}`, limit: limits.documentVisitor, label: "visitor" },
    { value: `document-network:${forwardedFor}`, limit: limits.documentNetwork, label: "network" },
    { value: `document-analysis:${analysisId}`, limit: limits.documentAnalysis, label: "analysis" },
  ] as const;

  let remaining = Number.POSITIVE_INFINITY;
  for (const bucket of buckets) {
    const count = await increment(db, await hashBucket(bucket.value), day);
    remaining = Math.min(remaining, Math.max(0, bucket.limit - count));
    if (count > bucket.limit) {
      const message = bucket.label === "analysis"
        ? "That document analysis was already submitted. Please start it again from the document."
        : "This public demo has reached its document explanation limit for today. Please try again tomorrow.";
      return { allowed: false, remaining: 0, retryAfterSeconds: secondsUntilTomorrow(), message };
    }
  }

  return { allowed: true, remaining, retryAfterSeconds: secondsUntilTomorrow() };
}
