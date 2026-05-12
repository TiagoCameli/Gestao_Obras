-- Função calcular_estoque_combustivel_na_data() ainda fazia SUM em
-- abastecimentos (tabela dropada em 20260505090000_backup_drop_legacy_tables).
-- Resultado: a RPC erra "relation \"abastecimentos\" does not exist", o
-- TransferenciaForm fica com estoqueOrigemNaData=0 (default), e qualquer
-- transferência > 0 dispara o aviso "saldo insuficiente".
--
-- Tipos mistos por tabela (descobertos via information_schema em prod):
--   entradas_combustivel.data_hora       = text
--   saidas_combustivel.data              = timestamptz
--   transferencias_combustivel.data_hora = text
-- A função recebe p_data_hora text (ISO 8601). Compara como text com
-- entradas/transferências (lex eq pra ISO) e casta pra timestamptz na
-- comparação contra saidas_combustivel.

begin;

create or replace function public.calcular_estoque_combustivel_na_data(
  p_deposito_id text,
  p_data_hora text,
  p_excluir_id text default null
)
returns numeric
language plpgsql
security definer
as $$
declare
  v_entradas numeric;
  v_saidas numeric;
  v_transf_in numeric;
  v_transf_out numeric;
  v_data_ts timestamptz := p_data_hora::timestamptz;
begin
  select coalesce(sum(quantidade_litros), 0)
    into v_entradas
    from public.entradas_combustivel
   where deposito_id = p_deposito_id
     and data_hora <= p_data_hora;

  select coalesce(sum(litros), 0)
    into v_saidas
    from public.saidas_combustivel
   where origem = 'tanque'
     and tanque_id = p_deposito_id
     and data <= v_data_ts
     and (p_excluir_id is null or id <> p_excluir_id);

  select coalesce(sum(quantidade_litros), 0)
    into v_transf_in
    from public.transferencias_combustivel
   where deposito_destino_id = p_deposito_id
     and data_hora <= p_data_hora;

  select coalesce(sum(quantidade_litros), 0)
    into v_transf_out
    from public.transferencias_combustivel
   where deposito_origem_id = p_deposito_id
     and data_hora <= p_data_hora
     and (p_excluir_id is null or id <> p_excluir_id);

  return v_entradas + v_transf_in - v_saidas - v_transf_out;
end;
$$;

commit;
