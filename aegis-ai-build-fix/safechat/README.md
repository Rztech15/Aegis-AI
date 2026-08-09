# Aegis AI — Communicate. Protected.

Stack: **Next.js (Vercel)** + **Supabase** (auth, Postgres, realtime, storage) + **OpenRouter** (AI risk detection).

## 1. Prerequisites
- Node.js 18+
- A free [Supabase](https://supabase.com) project
- A free [OpenRouter](https://openrouter.ai) API key
- A [Vercel](https://vercel.com) account (for deployment) + [GitHub](https://github.com) repo

## 2. Setup

```bash
npm install
cp .env.example .env.local   # fill in the values below
```

**.env.local values:**
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase project Settings → API
- `SUPABASE_SERVICE_ROLE_KEY` — same page, server-only, never expose to the client
- `OPENROUTER_API_KEY` — from OpenRouter dashboard

## 3. Database

Run `supabase/schema.sql` in the Supabase SQL Editor (or via `supabase db push` if using the CLI). This creates:
- `profiles` (extends Supabase's built-in `auth.users`)
- `conversations`
- `messages`
- `evidence_reports`

Row Level Security (RLS) policies are included so users can only read/write their own conversations — **do not disable RLS**, this is the main access-control layer.

## 4. Run locally

```bash
npm run dev
```

## 5. Deploy

Push to GitHub, import the repo in Vercel, add the same env vars in Vercel's project settings. Every push to `main` auto-deploys.

## 6. Team ownership map

| Area | Files | Owner |
|---|---|---|
| Chat UI | `app/(chat)/**` | Frontend pair |
| Auth screens | `app/(auth)/**` | Frontend pair |
| AI detection logic | `lib/detectRisk.ts`, `app/api/analyze/route.ts` | AI/NLP pair |
| Database schema, RLS policies | `supabase/schema.sql` | Backend pair |
| Conversations/messages API | `app/api/conversations/**` | Backend pair |

See `/docs` from the earlier project docs (architecture spec, ML plan, labeling template) for full context behind these choices.
