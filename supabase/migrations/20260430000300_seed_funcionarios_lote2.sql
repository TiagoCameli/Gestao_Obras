-- ============================================================
-- Lote 2 de funcionários da EMT (administrativo + Colorado).
-- Idempotente: usa NOT EXISTS sobre o nome NORMALIZADO (lowercase, sem
-- pontuação/acentos/parênteses) pra evitar duplicar registros que já
-- estão no banco com pequena variação de grafia. Também usa ON CONFLICT
-- (nome) DO NOTHING como segunda barreira.
-- ============================================================

BEGIN;

INSERT INTO public.apont_funcionarios
  (nome, funcao, tipo_vinculo, status, fotos_referencia_facial, documentos)
SELECT
  n.nome,
  n.funcao,
  n.tipo_vinculo,
  'ativo',
  '{}'::text[],
  '[]'::jsonb
FROM (VALUES
  ('MARIA DAS DORES L. DA SILVA',                              'GERENTE FINANCEIRO',              'CLT'),
  ('BRENDA CIACCI PEREIRA',                                    'GERENTE DE RECURSOS HUMANOS',     'prestador_servico'),
  ('GESSON ANASTÁCIO',                                         'VIGIA DA BALSA',                  'prestador_servico'),
  ('MARCIA FURTUNATO',                                         'AUXILIAR DE LIMPEZA',             'prestador_servico'),
  ('LEANDRO COSTA DE LIMA',                                    'ENGENHEIRO',                      'prestador_servico'),
  ('TIAGO DE MELO CAMELI',                                     'ENGENHEIRO',                      'prestador_servico'),
  ('J. DA SILVA FERREIRA JUNIOR',                              'CONTADOR',                        'prestador_servico'),
  ('ANDREIA ALENCAR DA SILVA',                                 'GERENTE DE COMPRAS',              'CLT'),
  ('DVANIR DE LIMA NICÁCIO',                                   'AUXILIAR DE SERVIÇOS GERAIS',     'CLT'),
  ('FRANCISCO NILTON CORREIA DA SILVA',                        'ELETRICISTA',                     'CLT'),
  ('MARIA JUSCILEIDE N. DE SOUZA',                             'COZINHEIRA',                      'CLT'),
  ('MARVIN DA SILVA ALMEIDA',                                  'AUXILIAR DE COMPRAS',             'CLT'),
  ('ANTONIO X. DA SILVA (Perdido)',                            'SERVENTE DE OBRAS',               'CLT'),
  ('JACSSON LIMA FAGUNDES',                                    'MOTORISTA DE CARRETA',            'CLT'),
  ('FRANCISCO ALDENI DA SILVA',                                'AUXILIAR DE MECÂNICO',            'CLT'),
  ('TONY JOSÉ LIRA',                                           'MECÂNICO',                        'prestador_servico'),
  ('LUIZ MIGUEL MENEZES MARTINS',                              'AUXILIAR DE MECÂNICO',            'prestador_servico'),
  ('ROGERIO LOPES FERREIRA COLORADO',                          'MECÂNICO',                        'prestador_servico'),
  ('ANTONIO DA SILVA SOUZA (Santim) COLORADO',                 'OPERADOR DE USINA',               'prestador_servico'),
  ('ANTONIO TELES MESSIAS (Dibelo) COLORADO',                  'CALDEIRISTA',                     'prestador_servico'),
  ('CLAUDEILSON FIGUEIREDO ALVES (Moco) COLORADO',             'AUXILIAR DE OPERADOR DE USINA',   'prestador_servico'),
  ('JOSE RODRIGUES DE LIMA (Boré) COLORADO',                   'AUXILIAR DE OPERADOR DE USINA',   'prestador_servico'),
  ('ALTAIR DA SILVA CORREIA (Pintinho) COLORADO',              'OPERADOR DE ROLO',                'prestador_servico'),
  ('ANTONIO FRANCISCO DA SILVA GAMA (Toin) COLORADO',          'MOTORISTA',                       'prestador_servico'),
  ('JOSE BENILDO FERNANDES DA SILVA COLORADO',                 'MOTORISTA',                       'prestador_servico'),
  ('JOSE FRANCISCO BEZERRA LUSTOZA (ZEZINHO) COLORADO',        'MOTORISTA',                       'prestador_servico'),
  ('FERNANDO DE OLIVEIRA CADAXO COLORADO',                     'ANALISTA DE LICITAÇÃO',           'prestador_servico')
) AS n(nome, funcao, tipo_vinculo)
WHERE NOT EXISTS (
  SELECT 1
    FROM public.apont_funcionarios a
   WHERE lower(regexp_replace(a.nome, '[^a-zA-Z0-9]', '', 'g'))
       = lower(regexp_replace(n.nome, '[^a-zA-Z0-9]', '', 'g'))
)
ON CONFLICT (nome) DO NOTHING;

COMMIT;

-- Verificação:
-- SELECT count(*) FROM public.apont_funcionarios;
-- SELECT nome, funcao, tipo_vinculo FROM public.apont_funcionarios ORDER BY created_at DESC LIMIT 30;
