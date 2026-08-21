# Manav Legal Solutions — Claude Code Project Instructions

## Project Summary
Manav Legal Solutions ("MLS") is a Pan-India AI-powered **paralegal and legal-operations platform**, not an AI lawyer. It researches, extracts, organizes, drafts and verifies; an authorized advocate retains final judgment, sign-off and filing authority. Home firm: Manav Legal Solutions, Patna, Bihar. Full architectural rationale lives in `docs/blueprint.md` and the research source docs it distills.

## Tech Stack (fixed — do not re-litigate per session)
- Next.js 16 (App Router) + React 19 + TypeScript, Tailwind v4
- Data layer: Supabase Postgres, queried via `lib/db/repo.ts` / `lib/db/documents-repo.ts` as the authenticated user (`@supabase/ssr`). Every tenant/matter-scoped table is enforced by Postgres Row-Level Security — there is no service-role key anywhere in this app, and no local/mock data mode. `pgvector` (HNSW) backs embeddings; Supabase Storage (private bucket, path-prefix RLS) backs uploaded documents.
- Auth: real Supabase Auth (email/password). `middleware.ts` → `lib/supabase/middleware.ts` gates every route except `/login`/`/signup`. Auth-gated layout is `app/(app)/layout.tsx` (the only place `getCurrentUser()` is called unconditionally) — the root `app/layout.tsx` deliberately has no auth check, to avoid redirect loops on `/login` itself.
- AI layer: pluggable dual-provider (`@anthropic-ai/sdk` + `openai`), routed through `lib/agents/model-client.ts`, auto-detected from which of `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` is set. Neither set → deterministic mock mode grounded only in the seeded KB tables; either set → live calls, same call sites. Embeddings always go through OpenAI (`lib/agents/embeddings.ts`) regardless of which provider answers questions.
- Document/RAG pipeline: `lib/documents/` (PDF via `pdf-parse` + OCR fallback via `pdfjs-dist`/`@napi-rs/canvas`/`tesseract.js`, DOCX via `mammoth`, chunking) → embed → `pgvector` similarity search (`match_document_chunks`/`match_provisions` RPCs) → `lib/agents/qa-agent.ts` assembles source-cited context for the LLM. Empty retrieval must produce an explicit "insufficient information" response, never a fabricated one.
- Fonts: Fraunces (display/headings), Public Sans (body/UI), IBM Plex Mono (citations/section numbers). Do not introduce Inter/Roboto/system fonts.
- Design tokens: CSS variables in `app/globals.css` (`--oxblood`, `--brass`, `--paper`, `--verified`/`--unverified`/`--flagged`, etc.) — "official legal gazette" aesthetic. Reuse these tokens; don't hardcode hex colors in components.

## Non-Negotiable Rules
1. **Never fabricate a legal citation.** Every Act/section/case cited in seed data, agent output, or UI copy must have a real `sourceUrl` and an honest `trustLevel`/`coverageStatus`. Content we haven't verified section-by-section is `coverageStatus: "stub"` or `"planned"` — never `"seeded"`. See `lib/legal/taxonomy.ts` and `data/seed/acts.json` for the pattern.
2. **Every draft-generation code path must run through the Verification Agent** (`lib/agents/verification-agent.ts`) before a draft reaches `in_review`/`approved` status. Do not add a drafting surface that skips this.
3. **Every new table with tenant-scoped data ships with an RLS policy** in the same migration. This is not a deploy-readiness nicety — RLS is the only thing enforcing tenant/matter isolation in this app (there is no service-role key and no application-level filtering to fall back on), so a table without a policy is a real data leak, not a future one.
4. **No feature that shares a document externally (client portal, email, filing) may skip the lawyer-review-approval gate** in the data model (`Draft.status`). A client-facing surface only ever shows `status === "approved"` drafts — see `app/portal/page.tsx`.
5. **No CAPTCHA-bypass or ToS-violating scraping.** Legal-data ingestion uses official APIs (India Code, e-Gazette, eCourts/NJDG open data) or licensed data partnerships only. Do not build headless-browser CAPTCHA solvers, even if referenced in the original research docs under `docs/research/`.
6. **Sensitive matters get `sensitivityLevel: "restricted"`** (POCSO/JJ Act/domestic-violence fact patterns) — see the detection rules in `lib/legal/taxonomy.ts` and the RLS `sensitive_matter_restriction` policy. Don't auto-share restricted-matter documents to the client portal without an explicit advocate action.

## Commands
- `npm run dev` — dev server on port 3010
- `npm run build` / `npm run start`
- `npm run lint`

## Where Things Live
- `lib/types.ts` — canonical domain types (mirrors the Supabase schema exactly)
- `lib/db/` — data layer: `repo.ts` (matters, drafts, deadlines, etc.) and `documents-repo.ts` (documents, chunks, semantic search, Q&A history) — both query Supabase directly as the authenticated user; import from these, never construct raw Supabase queries in routes/components
- `lib/supabase/` — `client.ts`/`server.ts` (SSR clients, deliberately untyped — see comment in `server.ts`), `middleware.ts` (session refresh + route gating), `config.ts` (URL/anon key)
- `lib/documents/` — PDF/DOCX parsing, OCR fallback, chunking
- `lib/legal/` — jurisdiction engine, special-act detection taxonomy, coverage-score engine, deadline calculator
- `lib/agents/` — the AI agent layer (consultation, applicable-law, drafting, verification, qa-agent) + `embeddings.ts` + `prompts.ts` (Master System Prompt, mirrored in `docs/master-system-prompt.md`)
- `supabase/migrations/` — applied migrations are the source of truth for schema; reconcile any new migration file here with what's actually live in the project
- `components/shell/` — Sidebar/TopBar/UserMenu (real signed-in user, no demo switcher)
- `components/documents/` — DocumentUpload, QaPanel
- `docs/adr/` — architecture decision records; add one whenever a recommendation in `docs/blueprint.md` is revised during implementation

## Definition of Done for a Feature
- Type-checks (`npm run build` passes)
- New Supabase table → RLS policy added in the same migration
- New AI-touching code path → runs through the Verification Agent, and mock-mode behavior is grounded in real seed content (no invented citations even in mock mode)
- New document type → variable schema + template skeleton + at least one fixture matter to generate against
- UI matches the existing design tokens (no ad hoc colors/fonts)
