# Migration files vs. the live schema

`0001_init.sql` in this directory is the **original design-time schema** — written before
a real Supabase project existed, back when the app ran on a local JSON store that mirrored
it by hand. It predates auth, RLS, documents/RAG, and several other tables and is kept only
as historical context; **do not apply it to a new project as-is.**

The live `manav-legal-solutions` Supabase project (`tqnrbgdtacflcyyisgjm`) was provisioned
and migrated directly against the database via the Supabase MCP tools in-session, as a
sequence of applied migrations rather than files committed here:

```
init_core_schema             — tenants, users, acts, provisions, case_law, legal_relationships,
                                document_types, matters, matter_parties, drafts, draft_citations,
                                review_actions, chronology_events, deadlines, chat_messages,
                                audit_logs, state_onboarding
document_intelligence_rag    — documents, document_chunks (pgvector), qa_history,
                                match_document_chunks / match_provisions RPCs
rls_policies                 — Row-Level Security policies for every table above
storage_bucket_matter_documents — private Storage bucket + path-prefix RLS
seed_kb_from_github          — acts/case_law/legal_relationships seed data
seed_provisions_from_github  — provisions seed data
auth_signup_trigger          — auto-creates a public.users row on Supabase Auth signup
harden_functions              — search_path hardening on SECURITY DEFINER functions
confirm_and_promote_first_admin — one-off: confirmed + promoted the first real account
```

All 20 `public` tables currently have RLS enabled — verify with `list_tables` (Supabase MCP)
or `select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace;`
if you don't have MCP access.

**To bring this file up to date with the live schema**, run `npx supabase db pull` against
the project (requires the Supabase CLI + a personal access token) and commit the generated
migration, or export it via the Supabase Dashboard → Database → Migrations. Until that's
done, treat the live project as the source of truth, not this directory.
