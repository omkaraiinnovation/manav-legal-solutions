# Manav Legal Solutions — Claude Code Project Instructions

## Project Summary
Manav Legal Solutions ("MLS") is a Pan-India AI-powered **paralegal and legal-operations platform**, not an AI lawyer. It researches, extracts, organizes, drafts and verifies; an authorized advocate retains final judgment, sign-off and filing authority. Home firm: Manav Legal Solutions, Patna, Bihar. Full architectural rationale lives in `docs/blueprint.md` and the research source docs it distills.

## Tech Stack (fixed — do not re-litigate per session)
- Next.js 16 (App Router) + React 19 + TypeScript, Tailwind v4
- Local-first data layer: JSON file store (`lib/db/store.ts`) mirroring a Supabase Postgres schema 1:1 (`supabase/migrations/0001_init.sql`). Switch via `MLS_DATA_MODE=supabase` when a real project is provisioned — see `.env.example`.
- AI layer: `@anthropic-ai/sdk`, routed through `lib/agents/model-client.ts`. `ANTHROPIC_API_KEY` unset → deterministic mock mode grounded only in `/data/seed`; set → live Claude calls, same call sites.
- Fonts: Fraunces (display/headings), Public Sans (body/UI), IBM Plex Mono (citations/section numbers). Do not introduce Inter/Roboto/system fonts.
- Design tokens: CSS variables in `app/globals.css` (`--oxblood`, `--brass`, `--paper`, `--verified`/`--unverified`/`--flagged`, etc.) — "official legal gazette" aesthetic. Reuse these tokens; don't hardcode hex colors in components.

## Non-Negotiable Rules
1. **Never fabricate a legal citation.** Every Act/section/case cited in seed data, agent output, or UI copy must have a real `sourceUrl` and an honest `trustLevel`/`coverageStatus`. Content we haven't verified section-by-section is `coverageStatus: "stub"` or `"planned"` — never `"seeded"`. See `lib/legal/taxonomy.ts` and `data/seed/acts.json` for the pattern.
2. **Every draft-generation code path must run through the Verification Agent** (`lib/agents/verification-agent.ts`) before a draft reaches `in_review`/`approved` status. Do not add a drafting surface that skips this.
3. **Every new table with tenant-scoped data ships with an RLS policy** in the same Supabase migration (see `supabase/migrations/0001_init.sql` for the pattern) even though the local build doesn't enforce it — the migration must stay deploy-ready.
4. **No feature that shares a document externally (client portal, email, filing) may skip the lawyer-review-approval gate** in the data model (`Draft.status`). A client-facing surface only ever shows `status === "approved"` drafts — see `app/portal/page.tsx`.
5. **No CAPTCHA-bypass or ToS-violating scraping.** Legal-data ingestion uses official APIs (India Code, e-Gazette, eCourts/NJDG open data) or licensed data partnerships only. Do not build headless-browser CAPTCHA solvers, even if referenced in the original research docs under `docs/research/`.
6. **Sensitive matters get `sensitivityLevel: "restricted"`** (POCSO/JJ Act/domestic-violence fact patterns) — see the detection rules in `lib/legal/taxonomy.ts` and the RLS `sensitive_matter_restriction` policy. Don't auto-share restricted-matter documents to the client portal without an explicit advocate action.

## Commands
- `npm run dev` — dev server on port 3010
- `npm run build` / `npm run start`
- `npm run seed` — reset the local JSON store back to `/data/seed`
- `npm run lint`

## Where Things Live
- `lib/types.ts` — canonical domain types (mirrors the Supabase schema exactly)
- `lib/db/` — data layer (`store.ts` = file I/O, `repo.ts` = typed collection accessors — import from here, not `store.ts`, in routes/components)
- `lib/legal/` — jurisdiction engine, special-act detection taxonomy, coverage-score engine, deadline calculator
- `lib/agents/` — the AI agent layer (consultation, applicable-law, drafting, verification) + `prompts.ts` (Master System Prompt, mirrored in `docs/master-system-prompt.md`)
- `data/seed/` — seed content for every collection; `data/store/` is the live (gitignored) local database
- `components/shell/` — Sidebar/TopBar/RoleSwitcher (demo session switcher — see `lib/session.ts`)
- `docs/adr/` — architecture decision records; add one whenever a recommendation in `docs/blueprint.md` is revised during implementation

## Definition of Done for a Feature
- Type-checks (`npm run build` passes)
- New Supabase table → RLS policy added in the same migration
- New AI-touching code path → runs through the Verification Agent, and mock-mode behavior is grounded in real seed content (no invented citations even in mock mode)
- New document type → variable schema + template skeleton + at least one fixture matter to generate against
- UI matches the existing design tokens (no ad hoc colors/fonts)
