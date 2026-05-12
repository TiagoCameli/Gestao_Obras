-- Marco 0 / PR3 — Documentos do equipamento (CRLV, IPVA, seguro, ANTT,
-- manual, NF de aquisição, contrato de locação, certificados, vistorias).
--
-- Por quê: hoje não há onde anexar esses documentos. Sem isso, é impossível
-- alertar vencimento (CRLV, IPVA, seguro) e o mecânico em campo não tem o
-- manual à mão.
--
-- Decisões de design:
--   * tipo é text livre validado por CHECK (lista fechada de tipos comuns).
--   * vencimento é date — alertas baseiam-se nele.
--   * fornecedor_id (FK soft) só faz sentido pra seguro/ANTT (quem emitiu/seguradora).
--   * Arquivos no array arquivo_urls (mesmo padrão do app).

begin;

create table if not exists public.documentos_equipamento (
  id text primary key,
  equipamento_id text not null references public.equipamentos(id) on delete cascade,
  tipo text not null check (tipo in (
    'crlv',
    'ipva',
    'seguro',
    'antt',
    'rntrc',
    'nr11',
    'nr12',
    'manual',
    'nf_aquisicao',
    'contrato_locacao',
    'certificacao',
    'vistoria',
    'recall',
    'outro'
  )),
  numero text not null default '',
  emissao date,
  vencimento date,
  valor numeric(14,2) not null default 0,
  fornecedor_id text references public.fornecedores(id) on delete set null,
  observacoes text not null default '',
  foto_urls text[] not null default '{}',
  arquivo_urls text[] not null default '{}',
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now(),
  updated_by text,
  deleted_at timestamptz,
  deleted_by text
);

create index if not exists documentos_equipamento_equip_idx
  on public.documentos_equipamento (equipamento_id)
  where deleted_at is null;

create index if not exists documentos_equipamento_venc_idx
  on public.documentos_equipamento (vencimento)
  where deleted_at is null and vencimento is not null;

alter table public.documentos_equipamento enable row level security;

drop policy if exists "Authenticated full access" on public.documentos_equipamento;
create policy "Authenticated full access" on public.documentos_equipamento
  for all to authenticated using (true) with check (true);

comment on table public.documentos_equipamento is
  'Documentos vinculados ao equipamento (CRLV, IPVA, seguro, ANTT, manual, '
  'NF, contrato, certificações, vistorias, recall). vencimento alimenta alertas.';

-- ──────────────────────────────────────────────────────────────────────
-- View: documentos vencendo nos próximos 60 dias (pra dashboard/alertas)
-- ──────────────────────────────────────────────────────────────────────

create or replace view public.v_documentos_vencendo as
select
  d.id,
  d.equipamento_id,
  e.nome as equipamento_nome,
  e.codigo_patrimonio,
  d.tipo,
  d.numero,
  d.vencimento,
  (d.vencimento - current_date) as dias_para_vencer,
  case
    when d.vencimento < current_date then 'vencido'
    when d.vencimento <= current_date + 7 then 'critico'   -- vence em <= 7 dias
    when d.vencimento <= current_date + 30 then 'alerta'   -- vence em <= 30 dias
    else 'atencao'                                          -- vence em <= 60 dias
  end as nivel
from public.documentos_equipamento d
join public.equipamentos e on e.id = d.equipamento_id
where d.deleted_at is null
  and d.vencimento is not null
  and d.vencimento <= current_date + 60;

comment on view public.v_documentos_vencendo is
  'Documentos vencidos ou vencendo nos próximos 60 dias. Níveis: vencido | critico (≤7d) | alerta (≤30d) | atencao (≤60d).';

commit;
