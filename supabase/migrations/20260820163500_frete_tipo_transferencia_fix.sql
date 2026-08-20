-- Frete de transferência de material
--
-- Contexto: hoje toda linha de `fretes` é uma viagem que TIRA material de uma
-- pedreira. O front deriva o "Saldo na Pedreira" como Σ(qtd dos pedidos) −
-- Σ(qtd dos fretes), casando `fretes.origem` com `fornecedores.nome`.
--
-- A transferência é uma viagem que move material que a EMT JÁ tem, de um ponto
-- a outro. Ela não pode descontar saldo de pedreira nenhuma, mas gera crédito
-- normal para a transportadora — o que já acontece de graça, porque o trigger
-- `fn_fretes_movimentos` lê apenas `valor_total`.
--
-- Por isso: discriminador na própria tabela, nenhuma alteração de trigger.

alter table public.fretes
  add column if not exists tipo text not null default 'material';

alter table public.fretes
  drop constraint if exists fretes_tipo_check;

alter table public.fretes
  add constraint fretes_tipo_check check (tipo in ('material', 'transferencia'));

comment on column public.fretes.tipo is
  'material = viagem que tira material de uma pedreira (desconta o Saldo na Pedreira). '
  'transferencia = viagem que move material que a EMT já tem entre dois pontos: '
  'não mexe em saldo de pedreira, mas credita a transportadora igual.';

-- Índice parcial: transferência é minoria, e a listagem/dashboard filtra por tipo.
create index if not exists idx_fretes_tipo_transferencia
  on public.fretes (tipo)
  where tipo = 'transferencia';
