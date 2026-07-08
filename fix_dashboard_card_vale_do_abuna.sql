-- Fix 2026-07-08: adiciona o fornecedor "Vale do Abunã" (mrc6gh9nrm1tq, vai fornecer pedra)
-- aos cards de saldo do dashboard do Frete (frete_dashboard_cards_config, linha global).
-- Antes: [LMC Transportadora, Andrade Transporte, EMT TRANSPORTES, Areacre]

UPDATE frete_dashboard_cards_config
SET fornecedor_ids = array_append(fornecedor_ids, 'mrc6gh9nrm1tq'),
    updated_at = now()
WHERE id = 'global'
  AND NOT ('mrc6gh9nrm1tq' = ANY (fornecedor_ids));
