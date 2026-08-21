-- Manav Legal Solutions — Initial Schema
-- Mirrors lib/types.ts and the local JSON store exactly (see lib/db).
-- Apply with the Supabase MCP `apply_migration` tool, or `supabase db push`.
-- Switch the app to this schema by setting MLS_DATA_MODE=supabase (see .env.example).

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ── Platform ────────────────────────────────────────────────────────────
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  branding jsonb default '{}',
  state_anchor text,
  created_at timestamptz default now()
);

create table users (
  id uuid primary key references auth.users(id),
  tenant_id uuid references tenants(id),
  full_name text,
  role text check (role in ('platform_admin','firm_admin','advocate','paralegal','client')),
  language_pref text default 'en',
  email text,
  created_at timestamptz default now()
);

-- ── Legal Knowledge Base ────────────────────────────────────────────────
create table acts (
  id uuid primary key default gen_random_uuid(),
  short_name text not null,
  full_name text not null,
  jurisdiction_level text check (jurisdiction_level in ('central','state','local')),
  state text,
  domains text[] not null default '{}',
  special_act_tags text[] default '{}',
  status text check (status in ('in_force','repealed','partially_repealed','not_yet_commenced')),
  enacted_date date,
  commencement_date date,
  repealed_date date,
  repealed_by uuid references acts(id),
  source_url text not null,
  trust_level text check (trust_level in ('A','B','C','D','E','F')),
  competent_authority text,
  special_court text,
  appeal_forum text,
  summary text,
  coverage_status text check (coverage_status in ('seeded','stub','planned')) default 'planned'
);
create index on acts using gin (domains);

create table provisions (
  id uuid primary key default gen_random_uuid(),
  act_id uuid references acts(id) on delete cascade,
  chapter text,
  provision_kind text,
  section_number text not null,
  parent_provision_id uuid references provisions(id),
  title text,
  text_content text,
  embedding vector(1536),
  valid_from date not null,
  valid_to date,             -- null = currently in force
  repealed boolean default false,
  amended_by_provision_id uuid references provisions(id),
  supersedes_old_reference text,
  source_url text not null,
  trust_level text check (trust_level in ('A','B','C','D','E','F')),
  verified_by uuid references users(id),
  verified_at timestamptz
);
create index on provisions using ivfflat (embedding vector_cosine_ops);
create index provisions_act_section_idx on provisions (act_id, section_number);
create index provisions_valid_range_idx on provisions (act_id, valid_from, valid_to);

create table case_law (
  id uuid primary key default gen_random_uuid(),
  case_title text not null,
  court text,
  citation text,
  decided_on date,
  holding_summary text,
  embedding vector(1536),
  status text check (status in ('binding','persuasive','overruled','distinguished','referred')),
  related_provision_ids uuid[] default '{}',
  source_url text not null,
  trust_level text check (trust_level in ('A','B','C','D','E','F'))
);

create table legal_relationships (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null,
  to_id uuid not null,
  relation text check (relation in
    ('amends','repeals','substitutes','references','implements','overrides',
     'follows','distinguishes','overrules','applies_to','limits','extends','related_to')),
  note text
);
create index on legal_relationships (from_id);
create index on legal_relationships (to_id);

-- ── Drafting & Documents ────────────────────────────────────────────────
create table document_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  family text,
  domains text[] default '{}',
  applicable_jurisdiction_levels text[] default '{}',
  variable_schema jsonb not null default '[]',
  template_skeleton_sections text[] not null default '{}',
  forum text,
  description text
);

create table matters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) not null,
  client_id uuid references users(id),
  title text not null,
  status text default 'intake',
  domains text[] default '{}',
  special_act_tags text[] default '{}',
  jurisdiction jsonb default '{}',
  sensitivity_level text default 'standard',
  facts text,
  relief_sought text,
  case_number text,
  cnr text,
  assigned_advocate_id uuid references users(id),
  assigned_paralegal_id uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table matter_parties (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid references matters(id) on delete cascade,
  role text,
  full_name text not null,
  person_type text,
  address text,
  contact jsonb
);

create table drafts (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid references matters(id) on delete cascade,
  document_type_id uuid references document_types(id),
  title text,
  content text,
  variables jsonb default '{}',
  status text default 'ai_generated',
  generated_by text default 'drafting_agent',
  coverage_score int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table draft_citations (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid references drafts(id) on delete cascade,
  provision_id uuid references provisions(id),
  case_law_id uuid references case_law(id),
  cited_text text,
  verification_status text default 'unverified' check (verification_status in ('verified','unverified','flagged')),
  flag_reason text
);

create table review_actions (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid references drafts(id) on delete cascade,
  reviewer_id uuid references users(id),
  action text check (action in ('approve','edit','reject','request_revision')),
  notes text,
  created_at timestamptz default now()
);

-- ── Case Operations ─────────────────────────────────────────────────────
create table chronology_events (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid references matters(id) on delete cascade,
  event_date date,
  description text,
  person text,
  related_document_id uuid,
  related_provision_id uuid references provisions(id),
  evidence_ref text,
  court_action text,
  next_action text,
  source text default 'manual'
);

create table deadlines (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid references matters(id) on delete cascade,
  label text,
  due_date date,
  basis text,
  source text default 'ai_estimated',
  status text default 'pending'
);

create table evidence_items (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid references matters(id) on delete cascade,
  file_name text,
  file_type text,
  storage_path text,
  uploaded_at timestamptz default now(),
  extracted_parties text[],
  extracted_dates text[],
  extracted_sections text[],
  ocr_text text,
  chain_of_custody_note text,
  authenticity text default 'unverified'
);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid references matters(id) on delete cascade,
  role text check (role in ('user','assistant','system')),
  content text,
  cited_provision_ids uuid[] default '{}',
  created_at timestamptz default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  actor_id uuid references users(id),
  action text,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz default now()
);

-- ── Row-Level Security ──────────────────────────────────────────────────
-- Apply this pattern to every tenant-scoped table. Knowledge-base tables
-- (acts/provisions/case_law/legal_relationships/document_types) are shared
-- read-only reference data across tenants, not tenant-scoped.
alter table matters enable row level security;
alter table matter_parties enable row level security;
alter table drafts enable row level security;
alter table draft_citations enable row level security;
alter table review_actions enable row level security;
alter table chronology_events enable row level security;
alter table deadlines enable row level security;
alter table evidence_items enable row level security;
alter table chat_messages enable row level security;
alter table audit_logs enable row level security;
alter table users enable row level security;

create policy tenant_isolation_matters on matters
  using (tenant_id = (select tenant_id from users where id = auth.uid()));
create policy tenant_isolation_users on users
  using (tenant_id = (select tenant_id from users where id = auth.uid()) or id = auth.uid());
create policy tenant_isolation_matter_parties on matter_parties
  using (matter_id in (select id from matters where tenant_id = (select tenant_id from users where id = auth.uid())));
create policy tenant_isolation_drafts on drafts
  using (matter_id in (select id from matters where tenant_id = (select tenant_id from users where id = auth.uid())));
create policy tenant_isolation_draft_citations on draft_citations
  using (draft_id in (select id from drafts where matter_id in (select id from matters where tenant_id = (select tenant_id from users where id = auth.uid()))));
create policy tenant_isolation_review_actions on review_actions
  using (draft_id in (select id from drafts where matter_id in (select id from matters where tenant_id = (select tenant_id from users where id = auth.uid()))));
create policy tenant_isolation_chronology on chronology_events
  using (matter_id in (select id from matters where tenant_id = (select tenant_id from users where id = auth.uid())));
create policy tenant_isolation_deadlines on deadlines
  using (matter_id in (select id from matters where tenant_id = (select tenant_id from users where id = auth.uid())));
create policy tenant_isolation_evidence on evidence_items
  using (matter_id in (select id from matters where tenant_id = (select tenant_id from users where id = auth.uid())));
create policy tenant_isolation_chat on chat_messages
  using (matter_id in (select id from matters where tenant_id = (select tenant_id from users where id = auth.uid())));
create policy tenant_isolation_audit on audit_logs
  using (tenant_id = (select tenant_id from users where id = auth.uid()));

-- Sensitive matters (POCSO/JJ/DV) get an additional restriction — only the
-- assigned advocate/paralegal or a firm_admin can read, regardless of tenant.
create policy sensitive_matter_restriction on matters
  for select using (
    sensitivity_level = 'standard'
    or assigned_advocate_id = auth.uid()
    or assigned_paralegal_id = auth.uid()
    or (select role from users where id = auth.uid()) in ('firm_admin','platform_admin')
  );
