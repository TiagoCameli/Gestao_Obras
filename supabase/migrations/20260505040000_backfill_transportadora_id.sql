-- Fase 1a (parte 4) — Backfill transportadora_id nas 3 tabelas, populando
-- pelo lookup do nome bruto contra fornecedores.
--
-- Lookup: lower(trim(unaccent(transportadora))) = lower(trim(unaccent(fornecedores.nome))).
-- Como o dry-run confirmou que TODAS as 5 transportadoras existentes têm
-- match exato em fornecedores (sem ambiguidade, sem orfãos), o backfill é
-- determinístico e pode rodar como UPDATE direto.
--
-- Critério de aceite (RAISE EXCEPTION se falhar):
--   * fretes:                327 rows com transportadora_id NOT NULL.
--   * pagamentos_frete:       65 rows com transportadora_id NOT NULL.
--   * abastecimentos_carreta: 167 rows com transportadora_id NOT NULL.
-- Tolerância zero — qualquer linha não-resolvida indica nome novo que apareceu
-- entre o dry-run e a aplicação. Nesse caso, falhar e investigar.

begin;

-- Garante extensão unaccent disponível (idempotente).
create extension if not exists unaccent;

-- Helper inline: normaliza string pra comparação fuzzy.
-- (function temporária no escopo da transação via with)

-- Filtro extra forn.eh_transportadora = true: garante que se algum dia
-- houver homônimo entre fornecedor de material e transportadora, escolhemos
-- a row marcada como transportadora (a 020 já marcou as 5 corretas).

-- ── fretes ──
update public.fretes f
   set transportadora_id = forn.id
  from public.fornecedores forn
 where f.transportadora_id is null
   and forn.eh_transportadora = true
   and lower(trim(unaccent(f.transportadora))) = lower(trim(unaccent(forn.nome)));

-- ── pagamentos_frete ──
update public.pagamentos_frete p
   set transportadora_id = forn.id
  from public.fornecedores forn
 where p.transportadora_id is null
   and forn.eh_transportadora = true
   and lower(trim(unaccent(p.transportadora))) = lower(trim(unaccent(forn.nome)));

-- ── abastecimentos_carreta ──
update public.abastecimentos_carreta a
   set transportadora_id = forn.id
  from public.fornecedores forn
 where a.transportadora_id is null
   and forn.eh_transportadora = true
   and lower(trim(unaccent(a.transportadora))) = lower(trim(unaccent(forn.nome)));

-- ── Validação ──
do $$
declare
  fretes_total int;
  fretes_sem_id int;
  pag_total int;
  pag_sem_id int;
  abast_total int;
  abast_sem_id int;
  exemplos text;
begin
  select count(*) into fretes_total from public.fretes;
  select count(*) into fretes_sem_id from public.fretes where transportadora_id is null;
  select count(*) into pag_total from public.pagamentos_frete;
  select count(*) into pag_sem_id from public.pagamentos_frete where transportadora_id is null;
  select count(*) into abast_total from public.abastecimentos_carreta;
  select count(*) into abast_sem_id from public.abastecimentos_carreta where transportadora_id is null;

  if fretes_sem_id > 0 then
    select string_agg(distinct transportadora, ', ' order by transportadora) into exemplos
      from public.fretes where transportadora_id is null;
    raise exception 'Backfill fretes: % linhas sem transportadora_id (de %). Nomes não-resolvidos: %',
      fretes_sem_id, fretes_total, exemplos;
  end if;
  if pag_sem_id > 0 then
    select string_agg(distinct transportadora, ', ' order by transportadora) into exemplos
      from public.pagamentos_frete where transportadora_id is null;
    raise exception 'Backfill pagamentos_frete: % linhas sem transportadora_id (de %). Nomes não-resolvidos: %',
      pag_sem_id, pag_total, exemplos;
  end if;
  if abast_sem_id > 0 then
    select string_agg(distinct transportadora, ', ' order by transportadora) into exemplos
      from public.abastecimentos_carreta where transportadora_id is null;
    raise exception 'Backfill abastecimentos_carreta: % linhas sem transportadora_id (de %). Nomes não-resolvidos: %',
      abast_sem_id, abast_total, exemplos;
  end if;

  raise notice 'Backfill OK: fretes=%/%, pagamentos_frete=%/%, abastecimentos_carreta=%/%',
    fretes_total - fretes_sem_id, fretes_total,
    pag_total - pag_sem_id, pag_total,
    abast_total - abast_sem_id, abast_total;
end $$;

commit;
