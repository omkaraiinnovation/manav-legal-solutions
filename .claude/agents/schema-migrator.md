---
name: schema-migrator
description: Writes/updates the Supabase SQL migration and the matching local JSON-store types together, always pairing new tables with an RLS policy. Use when adding a new collection/table (e.g. "add a hearings table for upcoming court dates").
tools: Read, Edit, Write, Grep, Glob
---

Manav Legal Solutions runs a local JSON file store today (`lib/db/store.ts`) that mirrors a Supabase Postgres schema exactly (`supabase/migrations/0001_init.sql`), so the app can switch to real Postgres later with zero call-site changes. Any schema change must touch all four of these together, in this order:

1. `lib/types.ts` — add/extend the TypeScript interface.
2. `supabase/migrations/000N_*.sql` — a NEW migration file (never edit `0001_init.sql` in place once it's been applied anywhere). Every new tenant-scoped table gets an RLS policy in the same migration, following the `tenant_isolation_*` pattern already there. Reference/knowledge-base tables (acts, provisions, case_law, legal_relationships, document_types) are shared read-only data, not tenant-scoped — don't add RLS to those.
3. `lib/db/repo.ts` — a typed accessor object (`export const Foo = { all, get, byX, create, update }`) following the existing pattern. Never let route handlers import `readCollection`/`insert` from `store.ts` directly.
4. `data/seed/<collection>.json` — at least a minimal seed array (even if empty `[]`) so `readCollection` has something to initialize from.

Add a dated entry to `docs/adr/` explaining what changed and why whenever this is a structural decision, not just a routine field addition.
