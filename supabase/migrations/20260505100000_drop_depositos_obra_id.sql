-- Fase 6 — Tanques globais.
--
-- Remove depositos.obra_id. Tanques deixam de ter conceito de "obra
-- proprietária" no schema. Motivo: na operação real, os 4 tanques
-- circulam entre frentes; amarrar um tanque a uma obra única não
-- reflete o que acontece no campo e atrapalha forms (filtro fantasma
-- escondia tanques de obras vizinhas).
--
-- Pré-check: rodado grep amplo em src/ via Claude Code antes deste
-- commit. 4 sites em insumos usam DepositoMaterial.obraId (tipo TS
-- diferente, tabela depositos_material — não afetado). 3 sites em
-- exports de transferência de combustível filtravam transferências
-- por "obra do tanque" — patch removido no commit 2 (filtro perdeu
-- semântica com tanques globais).
--
-- Backfill: dados não migram (semântica mudou — tanque não tem dono
-- de obra). Os 4 tanques existentes ficam com obra_id implícito
-- removido. Sem perda de dado em transações (saidas_combustivel,
-- entradas_combustivel, transferencias_combustivel preservam
-- obra_id próprio quando aplicável — só o tanque deixa de ter).

begin;

alter table public.depositos drop column if exists obra_id;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'depositos' and column_name = 'obra_id'
  ) then
    raise exception 'depositos.obra_id ainda existe pós-DROP';
  end if;
  raise notice 'depositos.obra_id dropado com sucesso. Tanques agora são globais.';
end $$;

commit;
