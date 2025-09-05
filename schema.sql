
-- Tabelas
create extension if not exists pgcrypto;
create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  token text not null unique,
  client_name text not null,
  client_cpf text not null,
  title text not null,
  created_at timestamptz default now()
);

do $$ begin
  create type case_status as enum (
    'RECEBIDO','PROTOCOLO','AGUARDANDO_ANALISE','DILIGENCIA','AUDIENCIA_MARCADA','SENTENCA','RECURSO','TRANSITO_EM_JULGADO','CUMPRIMENTO_SENTENCA','ARQUIVADO'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete cascade,
  status case_status not null,
  description text,
  created_at timestamptz default now()
);

create table if not exists public.case_files (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete cascade,
  file_name text not null,
  content_type text not null,
  size_bytes bigint not null,
  s3_key text not null,
  uploaded_by text not null check (uploaded_by in ('CLIENT','OPERATOR')),
  created_at timestamptz default now()
);

-- RLS
alter table public.cases enable row level security;
alter table public.case_events enable row level security;
alter table public.case_files enable row level security;

-- function to check token
create or replace function public.case_allowed(token_in text)
returns uuid language sql stable as $$
  select id from public.cases where token = token_in
$$;

-- operator policies: any authenticated user
drop policy if exists operator_all_on_cases on public.cases;
create policy operator_all_on_cases on public.cases
  for all using (auth.role() = 'authenticated') with check (true);

drop policy if exists operator_all_on_events on public.case_events;
create policy operator_all_on_events on public.case_events
  for all using (auth.role() = 'authenticated') with check (true);

drop policy if exists operator_all_on_files on public.case_files;
create policy operator_all_on_files on public.case_files
  for all using (auth.role() = 'authenticated') with check (true);

-- anon (client) read-only by token header
drop policy if exists anon_read_case_by_token on public.cases;
create policy anon_read_case_by_token on public.cases
  for select using (
    coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role','') = 'anon'
    and (case_allowed(coalesce(current_setting('request.headers', true)::jsonb->>'x-case-token','')) = id)
  );

drop policy if exists anon_read_events_by_token on public.case_events;
create policy anon_read_events_by_token on public.case_events
  for select using (
    coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role','') = 'anon'
    and exists (
      select 1 from public.cases c
      where c.id = case_events.case_id
        and c.id = case_allowed(coalesce(current_setting('request.headers', true)::jsonb->>'x-case-token',''))
    )
  );

drop policy if exists anon_read_files_by_token on public.case_files;
create policy anon_read_files_by_token on public.case_files
  for select using (
    coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role','') = 'anon'
    and exists (
      select 1 from public.cases c
      where c.id = case_files.case_id
        and c.id = case_allowed(coalesce(current_setting('request.headers', true)::jsonb->>'x-case-token',''))
    )
  );
