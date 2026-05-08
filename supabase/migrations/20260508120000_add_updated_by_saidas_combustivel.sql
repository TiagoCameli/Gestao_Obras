-- F5.A.0 (executado adiantado, pré-req de F2.B.2 atribuição retroativa).
-- Adiciona coluna updated_by pra rastrear quem alterou cada saída.
-- NULL em saídas legadas e em INSERTs (insert tem created_by; updated_by
-- só faz sentido em UPDATE).

ALTER TABLE public.saidas_combustivel
  ADD COLUMN IF NOT EXISTS updated_by text;

COMMENT ON COLUMN public.saidas_combustivel.updated_by IS
  'Nome do usuário que executou o último UPDATE. NULL em saídas legadas e em INSERTs.';
