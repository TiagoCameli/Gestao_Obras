-- Renomeia "Amazonia Agroindustria" para "EMT Transportes" em fretes e
-- abastecimentos_carreta. Consolida os registros após a unificação dos
-- saldos no dashboard (card único "Saldo EMT TRANSPORTES").
--
-- O match usa trim+lower pra pegar variações com espaço/caixa diferentes.

UPDATE fretes
SET transportadora = 'EMT Transportes'
WHERE trim(lower(transportadora)) = 'amazonia agroindustria';

UPDATE abastecimentos_carreta
SET transportadora = 'EMT Transportes'
WHERE trim(lower(transportadora)) = 'amazonia agroindustria';
