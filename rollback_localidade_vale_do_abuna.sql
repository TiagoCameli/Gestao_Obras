-- Rollback do fix_localidade_vale_do_abuna.sql (2026-07-08).
-- Restaura o nome original e recria a linha duplicada exatamente como estava.

UPDATE localidades
SET nome = 'Pedreira Vale do Abuña'
WHERE id = 'mlpnopfjuowxr';

INSERT INTO localidades (id, nome, ativo, endereco, criado_por)
VALUES ('mlpnoorc26umw', 'Pedreira Vale do Abuña', true, 'https://maps.app.goo.gl/UKW7jZH5R3JGcWH27', '');
