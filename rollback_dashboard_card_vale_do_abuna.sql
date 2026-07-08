-- Rollback do fix_dashboard_card_vale_do_abuna.sql (2026-07-08).
-- Tira o Vale do Abunã dos cards e restaura updated_at/updated_por originais.

UPDATE frete_dashboard_cards_config
SET fornecedor_ids = array_remove(fornecedor_ids, 'mrc6gh9nrm1tq'),
    updated_at = '2026-06-08 22:53:18.928+00',
    updated_por = 'mlpfw6yysr635'
WHERE id = 'global';
