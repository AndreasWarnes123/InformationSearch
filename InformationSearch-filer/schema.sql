-- =========================================================
-- Kunnskapsverktøy for intern bedriftsdata
-- Kjøres i Supabase SQL Editor (Database > SQL Editor)
-- =========================================================

-- 1. Aktiver pgvector (gjøres én gang per prosjekt)
create extension if not exists vector;

-- =========================================================
-- 2. DOKUMENTER
-- Selve filen som ble lastet opp (metadata + full rå-tekst)
-- =========================================================
create table documents (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  doc_type text,                 -- 'kontrakt', 'e-post', 'møtereferat', osv.
  raw_text text,                 -- hele den utpakkede teksten
  uploaded_at timestamptz not null default now(),
  metadata jsonb default '{}'::jsonb  -- fritt felt: avsender, dato i dokumentet, avdeling osv.
);

-- =========================================================
-- 3. CHUNKS
-- Dokumentet delt opp i mindre biter, hver med sin embedding
-- =========================================================
create table chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  chunk_index int not null,       -- rekkefølge i dokumentet (0, 1, 2 ...)
  content text not null,
  embedding vector(1536),         -- matcher OpenAI text-embedding-3-small
  created_at timestamptz not null default now()
);

-- Vektor-indeks for raskt similarity-søk (RAG)
create index on chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- =========================================================
-- 4. ENTITETER
-- Personer, kunder, prosjekter, steder osv. hentet ut av LLM
-- =========================================================
create table entities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,             -- 'person', 'kunde', 'prosjekt', 'sted', 'sak' osv.
  created_at timestamptz not null default now(),
  unique (name, type)             -- unngår duplikate entiteter med samme navn+type
);

-- =========================================================
-- 5. ENTITY_MENTIONS
-- Kobler en entitet til det spesifikke stedet den ble nevnt
-- =========================================================
create table entity_mentions (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references entities(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  chunk_id uuid references chunks(id) on delete cascade,
  context_snippet text,           -- kort utdrag rundt nevnelsen
  created_at timestamptz not null default now()
);

-- =========================================================
-- 6. RELATIONS
-- Relasjoner mellom to entiteter (grunnlaget for tankekartet)
-- =========================================================
create table relations (
  id uuid primary key default gen_random_uuid(),
  entity_a_id uuid not null references entities(id) on delete cascade,
  entity_b_id uuid not null references entities(id) on delete cascade,
  relation_type text not null,    -- 'signerte_kontrakt_med', 'jobber_på', 'møtte' osv.
  source_document_id uuid references documents(id) on delete set null,
  created_at timestamptz not null default now()
);

-- =========================================================
-- 7. NYTTIGE INDEKSER
-- =========================================================
create index idx_chunks_document_id on chunks(document_id);
create index idx_entity_mentions_entity_id on entity_mentions(entity_id);
create index idx_entity_mentions_document_id on entity_mentions(document_id);
create index idx_relations_entity_a on relations(entity_a_id);
create index idx_relations_entity_b on relations(entity_b_id);

-- =========================================================
-- 8. FUNKSJON FOR RAG-SØK
-- Finn de N mest relevante chunkene for et gitt spørsmål-embedding
-- =========================================================
create or replace function match_chunks(
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  chunk_id uuid,
  document_id uuid,
  content text,
  similarity float
)
language sql stable
as $$
  select
    chunks.id as chunk_id,
    chunks.document_id,
    chunks.content,
    1 - (chunks.embedding <=> query_embedding) as similarity
  from chunks
  order by chunks.embedding <=> query_embedding
  limit match_count;
$$;

-- =========================================================
-- 9. FUNKSJON FOR GRAF-UTFORSKING
-- Hent alle relasjoner og naboer for én entitet (til tankekartet)
-- =========================================================
create or replace function get_entity_graph(target_entity_id uuid)
returns table (
  relation_id uuid,
  entity_a_id uuid,
  entity_a_name text,
  entity_b_id uuid,
  entity_b_name text,
  relation_type text,
  source_document_id uuid
)
language sql stable
as $$
  select
    r.id as relation_id,
    ea.id as entity_a_id,
    ea.name as entity_a_name,
    eb.id as entity_b_id,
    eb.name as entity_b_name,
    r.relation_type,
    r.source_document_id
  from relations r
  join entities ea on ea.id = r.entity_a_id
  join entities eb on eb.id = r.entity_b_id
  where r.entity_a_id = target_entity_id or r.entity_b_id = target_entity_id;
$$;
