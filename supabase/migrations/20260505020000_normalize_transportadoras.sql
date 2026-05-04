-- Fase 1a (parte 2) — Normaliza transportadoras em fornecedores.
--
-- O dry-run (scripts/dryrunNormalizeTransportadoras.mjs) confirmou que os 5
-- nomes distintos em fretes/pagamentos_frete/abastecimentos_carreta já têm
-- correspondente exato em fornecedores. Esta migration apenas marca as flags
-- corretas. Nenhum INSERT de fornecedor novo é necessário — tudo já existe.
--
-- Convenção de grafia: a EMT é "EMT TRANSPORTES" (CAPS), defendida pelas
-- migrations 20260428103000 e 20260428104500. NÃO renomeamos.
--
-- Critério de aceite: ao final, exatamente 5 fornecedores com
-- eh_transportadora=true e exatamente 1 com eh_dona_de_tanque=true (Areacre).

begin;

-- 1) Areacre: transportadora E dona de tanque (Transterra fica na Areacre).
update public.fornecedores
   set eh_transportadora = true,
       eh_dona_de_tanque = true
 where id = 'mlppmxan37tev'  -- Areacre
   and (eh_transportadora is distinct from true or eh_dona_de_tanque is distinct from true);

-- 2) Transportadoras puras (sem tanque próprio).
update public.fornecedores
   set eh_transportadora = true
 where id in (
   'mnx9g4currw6p',  -- EMT TRANSPORTES (consolidação Amazonia + EMT Transportes)
   'mn921nnyuvp1t',  -- Andrade Transporte
   'mlqm8sux861qf',  -- Transportadora Triunfo
   'mltn8gcw20fy8'   -- ETAM Construtora
 ) and eh_transportadora is distinct from true;

-- 3) Validação inline. RAISE EXCEPTION se contagem não bater com o esperado.
do $$
declare
  total_transp int;
  total_donas int;
begin
  select count(*) into total_transp from public.fornecedores where eh_transportadora = true;
  select count(*) into total_donas  from public.fornecedores where eh_dona_de_tanque = true;

  if total_transp <> 5 then
    raise exception 'Esperado 5 fornecedores com eh_transportadora=true; encontrado %', total_transp;
  end if;
  if total_donas <> 1 then
    raise exception 'Esperado 1 fornecedor com eh_dona_de_tanque=true (Areacre); encontrado %', total_donas;
  end if;
end $$;

commit;
