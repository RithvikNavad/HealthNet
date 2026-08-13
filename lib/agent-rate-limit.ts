type LimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  message?: string;
};

type LimitBucket = {
  value: string;
  limit: number;
  label: string;
};

type RedisCommandResult = {
  result?: number | string | null;
  error?: string;
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

function redisConfiguration() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

async function incrementRedis(bucketHash: string, windowStart: string) {
  const redis = redisConfiguration();
  if (!redis) {
    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
      throw new Error("The production rate-limit store is not configured.");
    }

    const key = `${bucketHash}:${windowStart}`;
    const count = (memoryBuckets.get(key) || 0) + 1;
    memoryBuckets.set(key, count);
    return count;
  }

  const key = `healthnet:rate-limit:${windowStart}:${bucketHash}`;
  const response = await fetch(`${redis.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redis.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, secondsUntilTomorrow() + 60, "NX"],
    ]),
    cache: "no-store",
  });

  const results = await response.json().catch(() => null) as RedisCommandResult[] | null;
  const first = results?.[0];
  if (!response.ok || !first || first.error) {
    throw new Error("The rate-limit store request failed.");
  }

  const count = Number(first.result);
  if (!Number.isFinite(count)) throw new Error("The rate-limit store returned an invalid count.");
  return count;
}

function networkIdentifier(request: Request) {
  return request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown-network";
}

async function enforceBuckets(buckets: LimitBucket[], messageFor: (label: string) => string): Promise<LimitResult> {
  const day = new Date().toISOString().slice(0, 10);
  let remaining = Number.POSITIVE_INFINITY;

  for (const bucket of buckets) {
    const count = await incrementRedis(await hashBucket(bucket.value), day);
    remaining = Math.min(remaining, Math.max(0, bucket.limit - count));
    if (count > bucket.limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: secondsUntilTomorrow(),
        message: messageFor(bucket.label),
      };
    }
  }

  return { allowed: true, remaining, retryAfterSeconds: secondsUntilTomorrow() };
}

export async function enforceAgentRateLimit(request: Request, visitorId: string, visitId: string): Promise<LimitResult> {
  const network = networkIdentifier(request);
  return enforceBuckets([
    { value: `visitor:${visitorId}`, limit: limits.visitor, label: "visitor" },
    { value: `network:${network}`, limit: limits.network, label: "network" },
    { value: `visit:${visitId}`, limit: limits.visit, label: "visit" },
  ], (label) => label === "visit"
    ? "This demo intake has reached its 15-message limit. Start a new fictional intake to continue."
    : "This public demo has reached its AI usage limit for today. Please try again tomorrow.");
}

export async function enforceDocumentAnalysisRateLimit(request: Request, visitorId: string, analysisId: string): Promise<LimitResult> {
  const network = networkIdentifier(request);
  return enforceBuckets([
    { value: `document-visitor:${visitorId}`, limit: limits.documentVisitor, label: "visitor" },
    { value: `document-network:${network}`, limit: limits.documentNetwork, label: "network" },
    { value: `document-analysis:${analysisId}`, limit: limits.documentAnalysis, label: "analysis" },
  ], (label) => label === "analysis"
    ? "That document analysis was already submitted. Please start it again from the document."
    : "This public demo has reached its document explanation limit for today. Please try again tomorrow.");
}
