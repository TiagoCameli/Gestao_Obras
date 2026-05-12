-- Marco 1 / PR6 — Especificações técnicas do equipamento.
--
-- Servem ao mecânico em campo: capacidade do cárter, tipo do óleo a usar,
-- código OEM dos filtros, medida do pneu, especificação da bateria, consumo
-- esperado pra detectar anomalia, e data/medição fim da garantia do
-- fabricante (pra acionar garantia em vez de pagar pela peça).
--
-- 1 linha por equipamento (equipamento_id é PK).
-- Filtros e óleos podem variar muito por modelo, então não normalizamos —
-- usamos colunas diretas pros mais comuns + jsonb 'filtros' para os códigos
-- OEM (oleo, ar, combustivel, hidraulico, cabine, separador, etc.).

begin;

create table if not exists public.especificacoes_equipamento (
  equipamento_id text primary key references public.equipamentos(id) on delete cascade,

  -- Capacidades (litros)
  capacidade_tanque_l numeric,
  capacidade_oleo_motor_l numeric,
  tipo_oleo_motor text,
  capacidade_oleo_hidraulico_l numeric,
  tipo_oleo_hidraulico text,
  capacidade_oleo_transmissao_l numeric,
  tipo_oleo_transmissao text,
  capacidade_oleo_diferencial_l numeric,
  capacidade_arrefecedor_l numeric,

  -- Pneus
  pneu_medida text,
  pneu_qtd int,

  -- Bateria
  bateria_especificacao text,
  bateria_qtd int,

  -- Códigos OEM dos filtros (jsonb: {"oleo":"P550425","ar":"P822686","combustivel":"...","hidraulico":"...","cabine":"...","separador":"..."})
  filtros jsonb not null default '{}'::jsonb,

  -- Consumo esperado (para detecção de anomalia)
  consumo_esperado_l_h numeric,
  consumo_esperado_km_l numeric,

  -- Garantia do fabricante
  garantia_fim_data date,
  garantia_fim_medicao numeric,

  -- Notas técnicas livres (torque de aperto especial, peculiaridades)
  observacoes_tecnicas text not null default '',

  -- Auditoria
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.especificacoes_equipamento enable row level security;

drop policy if exists "Authenticated full access" on public.especificacoes_equipamento;
create policy "Authenticated full access" on public.especificacoes_equipamento
  for all to authenticated using (true) with check (true);

comment on table public.especificacoes_equipamento is
  'Especificações técnicas do equipamento (capacidades, óleos, filtros, pneus, '
  'bateria, consumo esperado, garantia). 1 linha por equipamento. Usadas pelo '
  'mecânico em campo e pela detecção de anomalia de consumo.';

comment on column public.especificacoes_equipamento.filtros is
  'Códigos OEM dos filtros como JSON: {"oleo":"P550425","ar":"P822686",...}. '
  'Chaves convencionadas: oleo, ar, combustivel, hidraulico, cabine, separador.';

commit;
