-- Fix 2026-07-08: localidade duplicada "Pedreira Vale do Abuña" no dropdown de origem do Frete.
-- Remove a duplicata (mlpnoorc26umw) e renomeia a que fica pra "Vale do Abunã".
-- Nenhum frete usa esse nome como origem/destino ainda (conferido antes de aplicar).

DELETE FROM localidades WHERE id = 'mlpnoorc26umw';

UPDATE localidades
SET nome = 'Vale do Abunã'
WHERE id = 'mlpnopfjuowxr';
