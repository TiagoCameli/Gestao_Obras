-- Fix: reverter edição indevida da saída mpbusbmhuru2w (Tanque Canteiro 2).
-- Renan editou ontem (25/05 21:40) litros de 215 → 218 numa saída antiga de Diesel S500
-- registrada num tanque que hoje é Diesel S10. Isso debitou 3 L a mais do saldo S10.
-- Reverte para os valores anteriores. O trigger de saidas_combustivel recompõe nivel_atual_litros.

UPDATE public.saidas_combustivel
SET
  litros = 215.000,
  valor_total = 1331.6025,
  updated_by = 'sistema [fix saldo Canteiro 2]'
WHERE id = 'mpbusbmhuru2w'
  AND litros = 218.000;
