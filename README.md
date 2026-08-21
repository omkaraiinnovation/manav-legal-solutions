# Manav Legal Solutions — Pan-India AI Paralegal & Legal Operations Platform

An AI-powered **paralegal and legal-operations platform**, not an AI lawyer. It researches, extracts, organizes, drafts and verifies; an authorized advocate retains final judgment and filing authority. Home firm: Manav Legal Solutions, Patna, Bihar.

See [`docs/blueprint.md`](docs/blueprint.md) for the full architecture, [`docs/master-system-prompt.md`](docs/master-system-prompt.md) for the AI persona/rules, and [`CLAUDE.md`](CLAUDE.md) for the engineering conventions.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3010. This is a real, backend-backed application — it requires a provisioned Supabase project (Postgres + pgvector + Storage + Auth). Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`, apply the migrations under `supabase/migrations`, then sign up at `/login`. The first confirmed user is auto-promoted to `firm_admin`; every account after that starts as `client` until an admin changes its role.

- Auth is real Supabase Auth (email/password), enforced by `middleware.ts` — there is no demo role switcher and no unauthenticated access to any route except `/login`.
- Every table is tenant/matter-scoped via Postgres Row-Level Security — the app never uses a service-role key, so isolation is enforced by the database itself, not application code.
- Document upload → parse (PDF/DOCX, with OCR fallback for scanned PDFs) → chunk → embed → store runs as a real pipeline (`lib/documents/`, `lib/agents/embeddings.ts`, `app/api/documents/*`), and matter Q&A (`lib/agents/qa-agent.ts`) retrieves real chunks by vector similarity before generating an answer — if retrieval comes back empty, it says so instead of fabricating.

## AI Providers (pluggable, dual)

Set `ANTHROPIC_API_KEY` and/or `OPENAI_API_KEY` (see `.env.example`). The provider is auto-detected — Anthropic is preferred when both are present. **With neither key set, every agent runs in deterministic mock mode** grounded only in the seeded knowledge base, and Q&A explicitly reports "insufficient information" rather than inventing an answer — the "No False Completeness" rule holds in both modes. Embeddings (for RAG chunking/retrieval) currently require `OPENAI_API_KEY` regardless of which provider answers questions, since that's the only embeddings API wired up (`lib/agents/embeddings.ts`).

Credentials are read server-side only (`process.env`, Route Handlers / Server Components) and are never sent to the browser.

## What's Seeded vs. What's a Placeholder

Every Act in the Knowledge Base (`/knowledge-base` in the app) carries an honest coverage label:
- **Seeded & Verified** — section-level text ingested from a real source (BNS/BNSS/BSA + their IPC/CrPC/Evidence Act predecessors, 192 provisions, generated from published concordance tables).
- **Act Known · Provisions Pending** — the Act's real name/year/domain is correct, but granular section text hasn't been ingested yet (~50 Acts spanning all ~29 legal domains, plus the Bihar State Pack).
- **Planned** — taxonomy slot only, for states/domains queued for future ingestion.

Nothing is ever presented as complete or infallible — see the "No False Completeness" rule in `docs/master-system-prompt.md`.

## Scripts
- `npm run dev` — dev server (port 3010)
- `npm run build` / `npm run start`
- `npm run lint`
