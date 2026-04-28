-- Renomeia "Amazonia Agroindustria" para "EMT Transportes" em fretes,
-- abastecimentos_carreta e pagamentos_frete (transportadora + pago_por).
-- Consolida os registros após a unificação dos saldos no dashboard
-- (card único "Saldo EMT TRANSPORTES").
--
-- O match usa trim+lower pra pegar variações com espaço/caixa diferentes.

UPDATE fretes
SET transportadora = 'EMT Transportes'
WHERE trim(lower(transportadora)) = 'amazonia agroindustria';

UPDATE abastecimentos_carreta
SET transportadora = 'EMT Transportes'
WHERE trim(lower(transportadora)) = 'amazonia agroindustria';

UPDATE pagamentos_frete
SET transportadora = 'EMT Transportes'
WHERE trim(lower(transportadora)) = 'amazonia agroindustria';

UPDATE pagamentos_frete
SET pago_por = 'EMT Transportes'
WHERE trim(lower(pago_por)) = 'amazonia agroindustria';
