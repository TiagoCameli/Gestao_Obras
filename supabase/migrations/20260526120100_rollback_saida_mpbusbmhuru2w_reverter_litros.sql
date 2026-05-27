-- Rollback: reaplica a edição do Renan (litros 215 → 218) caso o fix precise ser revertido.

UPDATE public.saidas_combustivel
SET
  litros = 218.000,
  valor_total = 1350.1830,
  updated_by = 'Renan Oliveira Silva'
WHERE id = 'mpbusbmhuru2w'
  AND litros = 215.000;
