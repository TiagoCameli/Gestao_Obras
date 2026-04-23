-- ═══════════════════════════════════════════════════════════════════════════
-- RodoTracker — schema isolado (não se integra com a tabela `obras` atual).
-- Todas as tabelas são por-usuário (RLS em auth.uid()). IDs preservam o
-- formato string do tracker pra migração 1:1 do localStorage.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Obras do tracker ─────────────────────────────────────────────────────
create table if not exists public.rodotracker_obras (
  id              text        primary key,
  user_id         uuid        not null references auth.users(id) on delete cascade,
  name            text        not null,
  tipo_obra       text,
  rodovia         text,
  lote            text,
  trecho          text,
  contrato        text,
  km_inicial      double precision,
  km_final        double precision,
  center_lat      double precision not null,
  center_lng      double precision not null,
  zoom            integer     not null default 15,
  start_lat       double precision,
  start_lng       double precision,
  end_lat         double precision,
  end_lng         double precision,
  route_geojson   jsonb,
  extension_km    double precision,
  created_at      bigint      not null,
  updated_at      bigint      not null
);
create index if not exists rodotracker_obras_user_idx on public.rodotracker_obras(user_id);

-- ─── Atividades ───────────────────────────────────────────────────────────
create table if not exists public.rodotracker_activities (
  id              text        primary key,
  obra_id         text        not null references public.rodotracker_obras(id) on delete cascade,
  user_id         uuid        not null references auth.users(id) on delete cascade,
  lat             double precision not null,
  lng             double precision not null,
  lat_end         double precision,
  lng_end         double precision,
  service         text        not null,
  service_name    text,
  troca_solo      jsonb,
  cbuq            jsonb,
  "date"          text        not null,
  date_end        text,
  medicao         integer,
  km              text,
  km_end          text,
  lado            text,
  area_rect       jsonb,
  description     text,
  quantities      jsonb,
  photo_ids       text[],
  photo_folders   jsonb,
  pdfs            jsonb,
  created_at      bigint      not null,
  updated_at      bigint      not null
);
create index if not exists rodotracker_activities_obra_idx on public.rodotracker_activities(obra_id);
create index if not exists rodotracker_activities_user_idx on public.rodotracker_activities(user_id);

-- ─── Plan items (gantt) ───────────────────────────────────────────────────
create table if not exists public.rodotracker_plan_items (
  id              text        primary key,
  obra_id         text        not null references public.rodotracker_obras(id) on delete cascade,
  user_id         uuid        not null references auth.users(id) on delete cascade,
  name            text        not null,
  service         text,
  start_date      text        not null,
  end_date        text        not null,
  progress        double precision not null default 0,
  status          text        not null,
  notes           text,
  color           text,
  created_at      bigint      not null,
  updated_at      bigint      not null
);
create index if not exists rodotracker_plan_items_obra_idx on public.rodotracker_plan_items(obra_id);

-- ─── Itens do contrato (BOQ) ──────────────────────────────────────────────
create table if not exists public.rodotracker_contract_items (
  id              text        primary key,
  obra_id         text        not null references public.rodotracker_obras(id) on delete cascade,
  user_id         uuid        not null references auth.users(id) on delete cascade,
  code            text,
  name            text        not null,
  unit            text,
  contracted_qty  double precision not null default 0,
  unit_price      double precision not null default 0,
  current_qty     double precision,
  measured_qty    double precision,
  type            text,
  notes           text,
  created_at      bigint      not null,
  updated_at      bigint      not null
);
create index if not exists rodotracker_contract_items_obra_idx on public.rodotracker_contract_items(obra_id);

-- ─── Medição vigente por obra ─────────────────────────────────────────────
create table if not exists public.rodotracker_medicao (
  obra_id         text        primary key references public.rodotracker_obras(id) on delete cascade,
  user_id         uuid        not null references auth.users(id) on delete cascade,
  current         integer     not null default 1,
  updated_at      bigint      not null
);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS — cada usuário só vê as próprias linhas.
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.rodotracker_obras           enable row level security;
alter table public.rodotracker_activities      enable row level security;
alter table public.rodotracker_plan_items      enable row level security;
alter table public.rodotracker_contract_items  enable row level security;
alter table public.rodotracker_medicao         enable row level security;

create policy "rt_obras_own" on public.rodotracker_obras
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "rt_activities_own" on public.rodotracker_activities
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "rt_plan_items_own" on public.rodotracker_plan_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "rt_contract_items_own" on public.rodotracker_contract_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "rt_medicao_own" on public.rodotracker_medicao
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
-- Buckets de Storage — privados, caminhos no formato `<user_id>/<obra_id>/<id>.<ext>`
-- ═══════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('rodotracker-photos', 'rodotracker-photos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('rodotracker-pdfs', 'rodotracker-pdfs', false)
on conflict (id) do nothing;

-- Policies: usuário só pode ler/escrever/deletar objetos abaixo de `<user_id>/…`
create policy "rt_photos_read_own"
  on storage.objects for select
  using (
    bucket_id = 'rodotracker-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "rt_photos_write_own"
  on storage.objects for insert
  with check (
    bucket_id = 'rodotracker-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "rt_photos_update_own"
  on storage.objects for update
  using (
    bucket_id = 'rodotracker-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "rt_photos_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'rodotracker-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "rt_pdfs_read_own"
  on storage.objects for select
  using (
    bucket_id = 'rodotracker-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "rt_pdfs_write_own"
  on storage.objects for insert
  with check (
    bucket_id = 'rodotracker-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "rt_pdfs_update_own"
  on storage.objects for update
  using (
    bucket_id = 'rodotracker-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "rt_pdfs_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'rodotracker-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
