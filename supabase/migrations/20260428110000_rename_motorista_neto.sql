-- Atualiza fretes onde o motorista era apenas "NETO" (variações de
-- caixa/espaço) pra o nome completo "FRANCISCO FREIRE MAGALHAES NETO".
--
-- Match estrito por "neto" exato (após trim+lower) pra não pegar nomes
-- compostos que terminem em Neto.

UPDATE fretes
SET motorista = 'FRANCISCO FREIRE MAGALHAES NETO'
WHERE trim(lower(motorista)) = 'neto';
