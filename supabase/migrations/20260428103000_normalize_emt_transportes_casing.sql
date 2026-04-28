-- Padroniza todas as variações de "emt transportes" (caixa/espaços
-- diferentes) para a forma canônica "EMT TRANSPORTES" — alinhando com
-- o nome exibido no card de saldo do dashboard.

UPDATE fretes
SET transportadora = 'EMT TRANSPORTES'
WHERE trim(lower(transportadora)) = 'emt transportes'
  AND transportadora <> 'EMT TRANSPORTES';

UPDATE abastecimentos_carreta
SET transportadora = 'EMT TRANSPORTES'
WHERE trim(lower(transportadora)) = 'emt transportes'
  AND transportadora <> 'EMT TRANSPORTES';

UPDATE pagamentos_frete
SET transportadora = 'EMT TRANSPORTES'
WHERE trim(lower(transportadora)) = 'emt transportes'
  AND transportadora <> 'EMT TRANSPORTES';

UPDATE pagamentos_frete
SET pago_por = 'EMT TRANSPORTES'
WHERE trim(lower(pago_por)) = 'emt transportes'
  AND pago_por <> 'EMT TRANSPORTES';
