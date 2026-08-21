# Manav Legal Solutions — Pan-India AI Paralegal & Legal Operations Platform

An AI-powered **paralegal and legal-operations platform**, not an AI lawyer. It researches, extracts, organizes, drafts and verifies; an authorized advocate retains final judgment and filing authority. Home firm: Manav Legal Solutions, Patna, Bihar.

See [`docs/blueprint.md`](docs/blueprint.md) for the full architecture, [`docs/master-system-prompt.md`](docs/master-system-prompt.md) for the AI persona/rules, and [`CLAUDE.md`](CLAUDE.md) for the engineering conventions.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3010. No environment variables are required to run — the app starts in **local-first, mock-AI mode**:
- Data persists to `/data/store` (JSON files, auto-seeded from `/data/seed` on first read).
- AI agents (Consultation, Drafting, Verification, Applicable-Law) run in a deterministic mode grounded entirely in the seeded knowledge base — no external calls, no fabricated citations.

A role switcher in the top bar lets you try every persona (Platform Admin, Firm Admin, Advocate, Paralegal, Client) without setting up auth.

## Going Live

**AI**: set `ANTHROPIC_API_KEY` (see `.env.example`) — every agent switches to real Claude calls with no code changes.

**Database**: provision a Supabase project and apply `supabase/migrations/0001_init.sql`, then set `MLS_DATA_MODE=supabase` plus the Supabase env vars. The local JSON schema mirrors this migration exactly.

## What's Seeded vs. What's a Placeholder

Every Act in the Knowledge Base (`/knowledge-base` in the app) carries an honest coverage label:
- **Seeded & Verified** — section-level text ingested from a real source (BNS/BNSS/BSA + their IPC/CrPC/Evidence Act predecessors, 192 provisions, generated from published concordance tables).
- **Act Known · Provisions Pending** — the Act's real name/year/domain is correct, but granular section text hasn't been ingested yet (~50 Acts spanning all ~29 legal domains, plus the Bihar State Pack).
- **Planned** — taxonomy slot only, for states/domains queued for future ingestion.

Nothing is ever presented as complete or infallible — see the "No False Completeness" rule in `docs/master-system-prompt.md`.

## Scripts
- `npm run dev` — dev server (port 3010)
- `npm run build` / `npm run start`
- `npm run seed` — reset local data back to the seed files
- `npm run lint`
