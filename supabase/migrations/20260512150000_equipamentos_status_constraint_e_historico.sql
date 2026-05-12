-- Marco 0 / PR4 — Status do equipamento como enum auditado.
--
-- Hoje equipamentos.status é text sem constraint (qualquer string entra) e
-- mudanças são silenciosas — ninguém sabe quem mudou, quando, ou por quê.
-- Esta migration:
--   1. Adiciona CHECK constraint validando os 4 valores conhecidos.
--   2. Cria historico_status_equipamento (log auditado de transições).
--
-- O app é responsável por inserir no histórico ao mudar o status (via hook
-- useChangeStatusEquipamento). Não usamos trigger porque o motivo precisa
-- vir do usuário, e Postgres triggers não têm acesso natural a contexto
-- do request HTTP.

begin;

-- 1) CHECK constraint no enum status
alter table public.equipamentos
  drop constraint if exists equipamentos_status_check;

alter table public.equipamentos
  add constraint equipamentos_status_check
  check (status in ('ativa','manutencao_preventiva','manutencao_corretiva','fora_funcionamento'));

-- 2) Tabela de histórico
create table if not exists public.historico_status_equipamento (
  id text primary key,
  equipamento_id text not null references public.equipamentos(id) on delete cascade,
  status_de text check (status_de in ('ativa','manutencao_preventiva','manutencao_corretiva','fora_funcionamento')),
  status_para text not null check (status_para in ('ativa','manutencao_preventiva','manutencao_corretiva','fora_funcionamento')),
  motivo text not null default '',
  observacoes text not null default '',
  -- ID opcional da ordem de serviço que originou a mudança (preenchido
  -- futuramente quando o módulo de OS estiver no ar — FK soft via text).
  os_id text,
  created_at timestamptz not null default now(),
  created_by text
);

create index if not exists historico_status_equipamento_equip_idx
  on public.historico_status_equipamento (equipamento_id, created_at desc);

alter table public.historico_status_equipamento enable row level security;

drop policy if exists "Authenticated full access" on public.historico_status_equipamento;
create policy "Authenticated full access" on public.historico_status_equipamento
  for all to authenticated using (true) with check (true);

comment on table public.historico_status_equipamento is
  'Log auditado de transições de status do equipamento. App grava aqui via '
  'useChangeStatusEquipamento quando o status muda. Permite responder '
  '"quem colocou esse caminhão em corretiva?" e "por quanto tempo ficou parado?".';

comment on column public.historico_status_equipamento.os_id is
  'FK soft pra futuro modulo de Ordens de Serviço. NULL = transição manual '
  '(via StatusDropdown), não originada por OS.';

commit;
