-- Marco 0 / PR4 (bônus) — Batch-fix do tipo_medicao em veículos rodoviários.
--
-- Achado durante o smoke test do PR2: dos 77 equipamentos, só 7 estão como
-- 'odometro' (4 semirreboques, 2 carros, 1 espargidor). Carros (Hilux),
-- caminhões basculantes, betoneira, pintura, transporte, espargidor, munck,
-- pipa e semirreboques estão como 'horimetro' por erro de cadastro
-- (default do form).
--
-- Veículos que rodam em estrada têm odômetro/km (não horímetro de motor).
-- Essa migration normaliza todos eles para 'odometro'.
--
-- Equipamentos que rodam em obra/canteiro (escavadeira, motoniveladora,
-- pá carregadeira, retroescavadeira, trator esteira, minicarregadeira,
-- rolos, vibroacabadora, usina, telescópio, implementos, meloza, laboratório)
-- ficam como 'horimetro' (correto).
--
-- Antes do UPDATE: snapshot da contagem para auditoria.

begin;

-- Snapshot pré-update (apenas DEBUG visível em logs do migration)
do $$
declare
  v_before record;
begin
  for v_before in
    select tipo, tipo_medicao, count(*) as qtd
    from public.equipamentos
    where ativo = true
    group by tipo, tipo_medicao
    order by tipo, tipo_medicao
  loop
    raise notice 'ANTES: tipo=% tipo_medicao=% qtd=%',
      v_before.tipo, v_before.tipo_medicao, v_before.qtd;
  end loop;
end$$;

-- Batch-fix: veículos rodoviários → odometro
update public.equipamentos
   set tipo_medicao = 'odometro'
 where tipo_medicao <> 'odometro'
   and tipo in (
     'Carro',
     'Caminhão Basculante',
     'Caminhão Betoneira',
     'Caminhão de Pintura',
     'Caminhão de Transporte',
     'Caminhão Espargidor',
     'Caminhão Munck',
     'Caminhão Pipa',
     'Semirreboque'
   );

-- Snapshot pós-update
do $$
declare
  v_after record;
begin
  for v_after in
    select tipo, tipo_medicao, count(*) as qtd
    from public.equipamentos
    where ativo = true
    group by tipo, tipo_medicao
    order by tipo, tipo_medicao
  loop
    raise notice 'DEPOIS: tipo=% tipo_medicao=% qtd=%',
      v_after.tipo, v_after.tipo_medicao, v_after.qtd;
  end loop;
end$$;

commit;
