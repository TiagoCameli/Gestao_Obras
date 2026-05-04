-- Fase 1a (parte 3) — Adiciona FK transportadora_id em fretes,
-- pagamentos_frete e abastecimentos_carreta.
--
-- IMPORTANTE: a coluna `transportadora text` (nome bruto) é MANTIDA em
-- paralelo durante toda a transição (Fases 1→4). Drop só na Fase 5, depois
-- de QA validar que tudo lê de transportadora_id sem fallback. Isso permite
-- rollback fácil e dá tempo do código frontend migrar sem big-bang.
--
-- Comentário sobre pago_por: continua text. É um sentinel — aceita o nome
-- de uma transportadora cadastrada (caso "ETAM pagou pela Triunfo") OU a
-- string literal 'EMT Construtora' que significa "pago pela própria EMT".
-- A EMT NÃO tem row em fornecedores nem é tratada como transportadora.
-- FK em pago_por fica fora do escopo desta refatoração.

begin;

-- ── fretes ──
alter table public.fretes
  add column if not exists transportadora_id text
    references public.fornecedores(id) on delete restrict;

create index if not exists fretes_transportadora_id_idx
  on public.fretes (transportadora_id);

-- ── pagamentos_frete ──
alter table public.pagamentos_frete
  add column if not exists transportadora_id text
    references public.fornecedores(id) on delete restrict;

create index if not exists pagamentos_frete_transportadora_id_idx
  on public.pagamentos_frete (transportadora_id);

-- Comentário documentando o sentinel pago_por (estático, não-funcional).
comment on column public.pagamentos_frete.pago_por is
  'Quem pagou (text livre). Aceita: (a) nome de transportadora cadastrada em fornecedores '
  '(caso de pagamento cruzado, ex: "ETAM Construtora" pagou pela Triunfo) ou '
  '(b) o sentinel literal ''EMT Construtora'' significando "pago pela própria EMT" '
  '(a EMT é a casa, não tem row em fornecedores). Sem FK por design.';

-- ── abastecimentos_carreta ──
alter table public.abastecimentos_carreta
  add column if not exists transportadora_id text
    references public.fornecedores(id) on delete restrict;

create index if not exists abastecimentos_carreta_transportadora_id_idx
  on public.abastecimentos_carreta (transportadora_id);

commit;
