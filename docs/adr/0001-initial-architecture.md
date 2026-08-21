# ADR 0001 — Initial Architecture: Local-First Data, Pluggable AI, Honest Coverage Labeling

**Date:** 2026-08-21
**Status:** Accepted

## Context
The redesign mandate asked for a "fully comprehensive, world-class, Pan-India" paralegal ecosystem covering the entire Indian legal landscape at section/sub-clause granularity, historical/temporal intelligence, and a hallucination-proof verification layer — while explicitly warning against ever claiming false completeness. The prior system (`legal-bot/`) was a single-page chat widget scoped to BNS/BNSS/BSA IPC-mapping only, which the source research docs flag by name as the pattern to move away from.

Building the full "ultimate" vision as literally described (bitemporal graph database, InLegalBERT-class Indian legal NLP, live eCourts ingestion) is not something a single build session can responsibly deliver — it requires licensed data feeds, a trained domain model, and an ongoing advocate-review pipeline.

## Decision
1. **Data layer**: local JSON file store (`lib/db/store.ts`) mirroring a full Supabase Postgres schema (`supabase/migrations/0001_init.sql`) field-for-field, so the app runs with zero cloud setup now and swaps to real Postgres later via a single env var with no call-site changes.
2. **AI layer**: pluggable (`lib/agents/model-client.ts`) — deterministic, KB-grounded mock mode by default; real Claude calls the moment `ANTHROPIC_API_KEY` is set. Mock mode is not a stub UI — it runs the real Special-Act Detection Engine, jurisdiction resolver, and citation verifier against real seeded content.
3. **Coverage honesty**: every Act carries `coverageStatus: "seeded" | "stub" | "planned"` and every provision/case carries a `trustLevel A–F`. BNS/BNSS/BSA (+ IPC/CrPC/Evidence Act predecessors) are seeded at section level from published concordance tables (192 provisions); the Bihar State Pack is live; ~50 other Acts across all ~29 taxonomy domains are present as honestly-labeled `"stub"` entries (Act identity known, section text not yet ingested); nothing is fabricated.
4. **Scope boundary**: no CAPTCHA-bypass or ToS-violating court-portal scraping, per the operating rules and per the Blueprint research doc's own risk register.

## Consequences
- The platform is genuinely usable end-to-end today (intake → applicable-law sweep → drafting → citation verification → lawyer review → case management) for the Bihar + BNS/BNSS/BSA/NI-Act-scoped scenarios it's seeded for.
- Expanding to a second state, a new domain's granular provisions, or a licensed case-law corpus is additive work against an already-correct schema and UI — not a rebuild.
- The KB Admin / Legal Knowledge Base curation surface (Blueprint 3.13) is intentionally minimal in this pass — seed-file editing is the current curation workflow; a dedicated UI is a Phase 3+ item.
