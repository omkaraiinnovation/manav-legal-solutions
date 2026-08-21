# Manav Legal Solutions — Living Architecture Blueprint

This is the as-built architecture document. It distills four source research documents (Perplexity/ChatGPT/Gemini strategy docs, not reproduced here) into what was actually implemented, and records the deliberate gap between the "ultimate" theoretical vision and what a first shippable platform can responsibly claim.

## Positioning
MLS is an AI-powered **paralegal and legal-operations platform** — it researches, extracts, organizes, drafts and verifies. A human advocate retains final judgment, sign-off and filing authority on every matter. This is a legal-risk control, not just messaging: see the `Draft.status` approval gate and the client-portal restriction to `status === "approved"` drafts.

## What "Ultimate / Pan-India" Means Here
The research docs describe an aspirational end-state: a bitemporal legal knowledge graph, InLegalBERT-class Indian legal NLP, automated Shepardization, and live eCourts ingestion via headless-browser CAPTCHA-solving. Two of those are explicitly **out of scope by policy**, not just by current effort:

- **CAPTCHA-bypass / ToS-violating scraping of eCourts, NJDG, or any court portal is never built.** Ingestion uses official APIs and licensed data partnerships only (India Code, e-Gazette, eCourts/NJDG open-data services).
- **A literally complete Pan-India statute corpus cannot be hand-authored by an AI session.** Every Act in `data/seed/acts.json` carries an honest `coverageStatus`: `"seeded"` (section-level content ingested, from a real published source), `"stub"` (Act identity/metadata is real and well-known, granular provisions not yet ingested), or `"planned"` (taxonomy slot only). Nothing is ever marked `"seeded"` or `trustLevel: "A"` without an actual verification pass — see the No False Completeness rule below.

What *is* built now: the full application surface, workflow, and data model for the "ultimate" vision, populated with real, honestly-labeled content at the depth the research docs specify for a credible MVP (Blueprint Phase 0–2): the complete ~29-domain taxonomy is navigable, BNS/BNSS/BSA + their IPC/CrPC/Evidence-Act predecessors are seeded at section level (192 provisions, generated from published concordance tables), the Bihar State Legal Pack is live, and every other domain/state is present as a correctly-labeled extension point.

## Stack
```
CLIENT (Browser)         Next.js 16 (App Router) + React 19 + TS + Tailwind v4
APPLICATION LAYER        Next.js Route Handlers (app/api/*), demo cookie session (lib/session.ts)
AI ORCHESTRATION LAYER   lib/agents/* — pluggable: ANTHROPIC_API_KEY unset → deterministic mock
                         mode grounded in /data/seed; set → live Claude calls, same call sites
DATA LAYER               Local-first: lib/db/store.ts (JSON files under /data/store, auto-seeded
                         from /data/seed). Schema mirrors supabase/migrations/0001_init.sql 1:1 —
                         switching MLS_DATA_MODE=supabase is a data-layer swap only.
LEGAL KNOWLEDGE BASE     data/seed/{acts,provisions,case_law,legal_relationships}.json
```

## AI Agent Layer
Composable agents, not one giant prompt (`lib/agents/`):
- **Applicable-Law Agent** (`applicable-law-agent.ts`) — the "What Laws May Apply?" sweep. Deterministic in both modes: candidates always come from the Special-Act Detection Engine (`lib/legal/taxonomy.ts`) run against the seeded KB; live mode only adds LLM-phrased reasoning on top, never new candidates.
- **Consultation Agent** (`consultation-agent.ts`) — Mode A, 7-part advisory structure.
- **Drafting Agent** (`drafting-agent.ts`) — Mode B, generates from facts + jurisdiction + template skeleton + law sweep.
- **Verification Agent** (`verification-agent.ts`) — the Legal Claim Firewall. Runs on every draft before it can leave `ai_generated` status; checks every citation against `provisions`/`case_law`, flags repealed provisions and overruled precedent, never silently drops or silently trusts a citation.

## Legal Domain Logic (`lib/legal/`)
- `taxonomy.ts` — Special-Act Detection Engine: keyword/pattern rules proposing candidate domains + special Acts from a fact narrative (a fact pattern about a minor always surfaces POCSO/JJ Act candidates alongside general criminal law). Explicitly a placeholder for a trained legal-NLP classifier (InLegalBERT-class) at Phase 4+.
- `jurisdiction.ts` — resolves candidate Central + State Acts for a matter's jurisdiction; flags when both are engaged so the advocate resolves precedence under Article 254 (Doctrine of Repugnancy) rather than the system guessing.
- `coverage.ts` — the Legal Coverage Score / "Miss Nothing" checklist. Computed from what was actually checked, never asserted.
- `deadlines.ts` — a narrow set of high-confidence statutory deadline calculators (NI Act s.142, Limitation Act Art. 137 residual). Every result is tagged `ai_estimated`, distinct from `lawyer_verified`.

## Roadmap Alignment
What's built corresponds to Blueprint Phase 0 (Foundations) + Phase 1 (MVP: Consultation + Bihar/BNS-BNSS-BSA drafting) + the core of Phase 2 (Case Operations: chronology, deadlines, evidence, coverage audit, three-pane review console). Phase 3+ (true multi-tenant self-serve onboarding, PWA/offline, 75–100 document types, a second live State Pack, licensed case-law corpus with automated Shepardization, a dedicated graph database) is intentionally not built yet — see `docs/adr/` for when a phase is started or a recommendation here is revised.
