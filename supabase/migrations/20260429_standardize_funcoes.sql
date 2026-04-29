-- ============================================================
-- Padroniza os valores de `funcao` em apont_funcionarios:
-- - Tudo MAIÚSCULO
-- - Sem abreviações (Op. → OPERADOR, Aux. → AUXILIAR, ADM. → ADMINISTRADOR…)
-- - Mesmas variações redundantes consolidadas (Op. Escavadeira / Op. de Escavadeira → OPERADOR DE ESCAVADEIRA)
--
-- Idempotente: cada UPDATE só toca rows com o valor antigo exato.
-- ============================================================

BEGIN;

UPDATE public.apont_funcionarios SET funcao = 'CONTRAMESTRE'                      WHERE funcao = 'Contra Mestre';
UPDATE public.apont_funcionarios SET funcao = 'MOTORISTA DE CARRETA'              WHERE funcao = 'Motorista Carreta';
UPDATE public.apont_funcionarios SET funcao = 'OPERADOR DE ESCAVADEIRA'           WHERE funcao IN ('Op. Escavadeira', 'Op. de Escavadeira');
UPDATE public.apont_funcionarios SET funcao = 'MOTORISTA DE CAMINHÃO'             WHERE funcao = 'Motorista de Caminhão';
UPDATE public.apont_funcionarios SET funcao = 'APONTADOR'                          WHERE funcao = 'Apontador';
UPDATE public.apont_funcionarios SET funcao = 'AUXILIAR DE ESCRITÓRIO'            WHERE funcao = 'Aux. de Escritório';
UPDATE public.apont_funcionarios SET funcao = 'LABORATORISTA'                      WHERE funcao = 'Laboratorista';
UPDATE public.apont_funcionarios SET funcao = 'COZINHEIRA'                         WHERE funcao = 'Cozinheira';
UPDATE public.apont_funcionarios SET funcao = 'SERVENTE DE OBRAS'                 WHERE funcao = 'Servente de Obras';
UPDATE public.apont_funcionarios SET funcao = 'PARE E SIGA'                        WHERE funcao = 'Pare e Siga';
UPDATE public.apont_funcionarios SET funcao = 'OPERADOR DE ESPARGIDOR'            WHERE funcao = 'OP. ESPAGEDOR';
UPDATE public.apont_funcionarios SET funcao = 'OPERADOR DE PÁ ESCAVADEIRA'        WHERE funcao = 'OP. DE PÁ ESCAVADEIRA';
UPDATE public.apont_funcionarios SET funcao = 'ADMINISTRADOR DE CARTEIRA DE OBRAS' WHERE funcao = 'ADM. DE CARTEIRA OBRAS';
UPDATE public.apont_funcionarios SET funcao = 'LOCAÇÃO DE CAMINHÕES'              WHERE funcao = 'Alugou Caminhões';

-- Já-maiúsculas (RASTELEIRO, MOTORISTA, AUXILIAR DE COZINHA, ENCARREGADO) ficam.

-- Antigos valores em minúsculo (caso existam de seeds anteriores)
UPDATE public.apont_funcionarios SET funcao = 'ENCARREGADO'        WHERE funcao = 'encarregado';
UPDATE public.apont_funcionarios SET funcao = 'OPERADOR'           WHERE funcao = 'operador';
UPDATE public.apont_funcionarios SET funcao = 'MOTORISTA'          WHERE funcao = 'motorista';
UPDATE public.apont_funcionarios SET funcao = 'PEDREIRO'           WHERE funcao = 'pedreiro';
UPDATE public.apont_funcionarios SET funcao = 'SERVENTE DE OBRAS'  WHERE funcao = 'servente';
UPDATE public.apont_funcionarios SET funcao = 'TOPÓGRAFO'          WHERE funcao = 'topografo';
UPDATE public.apont_funcionarios SET funcao = 'ENGENHEIRO'         WHERE funcao = 'engenheiro';
UPDATE public.apont_funcionarios SET funcao = 'MESTRE DE OBRAS'    WHERE funcao = 'mestre-de-obras';
UPDATE public.apont_funcionarios SET funcao = 'APONTADOR'          WHERE funcao = 'apontador';
UPDATE public.apont_funcionarios SET funcao = 'OUTROS'             WHERE funcao = 'outros';

COMMIT;

-- Verificação:
-- SELECT funcao, count(*) FROM public.apont_funcionarios GROUP BY funcao ORDER BY funcao;
