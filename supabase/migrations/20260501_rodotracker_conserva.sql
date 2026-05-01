-- Atividade Conserva: serviço contínuo (mês inteiro, beira da pista,
-- sem localização exata). Sempre lança quantitativo no item 01.01 do
-- contrato. Estrutura:
--   { medicaoNumber: number, quantidade: number, contributions: { "01.01": number } }

ALTER TABLE public.rodotracker_activities
  ADD COLUMN IF NOT EXISTS conserva jsonb;
