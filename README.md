# HealthNet

HealthNet is a patient-facing health organization and visit-preparation prototype built with Next.js, React, TypeScript, and the OpenAI Agents SDK.

## Requirements

- Node.js 22
- An OpenAI API key
- Upstash Redis REST credentials for durable production rate limiting

## Local development

Copy `.env.example` to `.env.local` and configure the required values:

```bash
OPENAI_API_KEY=your-key
UPSTASH_REDIS_REST_URL=your-upstash-rest-url
UPSTASH_REDIS_REST_TOKEN=your-upstash-rest-token
```

Redis is optional during local development. When it is absent, rate-limit counters use process memory and reset when the development server restarts. Production deployments fail closed if durable Redis credentials are missing.

Install and run:

```bash
npm ci
npm run dev
```

## Verification

```bash
npm run build
npm run lint
npm test
```

## Vercel deployment

The repository is configured for Vercel's native Next.js build pipeline through `vercel.json`.

Use these project settings:

- Framework Preset: `Next.js`
- Root Directory: repository root (`./`)
- Node.js Version: `22.x`
- Install Command: `npm ci`
- Build Command: `npm run build`
- Output Directory: leave blank; Vercel manages the Next.js `.next` output

Configure these environment variables for Production and any Preview environments that should run AI requests:

- `OPENAI_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

The AI routes use the Node.js runtime and a 60-second maximum duration. Saved patient workspace data remains browser-local; Redis stores only hashed daily rate-limit counters.

## API routes

- `POST /api/intake` - guarded, structured conversational intake
- `POST /api/documents/analyze` - evidence-linked medical PDF explanation
- `GET /api/medications/search` - NLM RxTerms medication search proxy

## Product boundary

HealthNet is a school portfolio prototype intended for fictional patient information. It does not diagnose, prescribe, calculate doses, book care, or replace a qualified clinician.
