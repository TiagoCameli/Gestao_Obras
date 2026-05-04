-- ============================================================
-- 1) Relaxa constraints do apont_funcionarios pra refletir o novo
--    formulário (só nome obrigatório).
-- 2) Insere os 27 funcionários do quadro atual.
--
-- Idempotente em (1) (drop constraint if exists). Em (2) usa ON CONFLICT
-- pra evitar dup quando rodado mais de uma vez.
-- ============================================================

BEGIN;

-- (1) Tornar campos opcionais
ALTER TABLE public.apont_funcionarios
  DROP CONSTRAINT IF EXISTS apont_func_remuneracao_check;
ALTER TABLE public.apont_funcionarios
  ALTER COLUMN cpf DROP NOT NULL,
  ALTER COLUMN data_nascimento DROP NOT NULL,
  ALTER COLUMN data_admissao DROP NOT NULL;

-- (2) Inserir funcionários — só nome+função+vínculo+admissão+status.
--     Usa ON CONFLICT (nome) pra evitar duplicar; como nome não tem
--     unique constraint, criamos um índice parcial só para esta seed.
CREATE UNIQUE INDEX IF NOT EXISTS _seed_funcionarios_nome_idx
  ON public.apont_funcionarios (nome);

INSERT INTO public.apont_funcionarios
  (nome, funcao, tipo_vinculo, data_admissao, status, fotos_referencia_facial)
VALUES
  ('RACENILTON DE MENEZES CAMELI',           'Contra Mestre',          'CLT',          '2010-06-30', 'ativo', '{}'),
  ('FRANCISCO FREIRE MAGALHÃES NETO',        'Motorista Carreta',      'CLT',          '2024-12-10', 'ativo', '{}'),
  ('JOSE PESSOA DA SILVA',                    'Op. Escavadeira',        'CLT',          '2025-05-10', 'ativo', '{}'),
  ('SABINO BATISTA DA SILVA',                 'Motorista de Caminhão',  'CLT',          '2025-06-09', 'ativo', '{}'),
  ('JAIME SOARES DE AZEVEDO NETO',            'Apontador',              'CLT',          '2025-10-28', 'ativo', '{}'),
  ('JOÃO SANTIAGO DE OLIVEIRA',               'Op. de Escavadeira',     'CLT',          '2019-06-10', 'ativo', '{}'),
  ('RIAN HARISSON SOARES CAVALCANTE',         'Aux. de Escritório',     'CLT',          '2025-11-17', 'ativo', '{}'),
  ('EDMILSON CASTRO CAVALCANTE',              'Laboratorista',          'CLT',          '2026-02-10', 'ativo', '{}'),
  ('FRANCISCA VANGELINA DE SOUZA R. CAZUZA',  'Cozinheira',             'CLT',          '2025-11-17', 'ativo', '{}'),
  ('FRANCISCO ELISSON SILVA DO CARMO',        'Servente de Obras',      'CLT',          '2025-11-04', 'ativo', '{}'),
  ('JEFERSON MELO DOS SANTOS',                'Servente de Obras',      'CLT',          '2025-11-06', 'ativo', '{}'),
  ('EULER BATISTA DA SILVA',                  'Pare e Siga',            'diarista',     '2026-02-01', 'ativo', '{}'),
  ('CARLOS ARAUJO DA ROCHA',                  'RASTELEIRO',             'diarista',     '2026-03-01', 'ativo', '{}'),
  ('FRANCISCO SILVA DE SOUZA LOPES (LOZADA)', 'OP. ESPAGEDOR',          'diarista',     '2026-03-01', 'ativo', '{}'),
  ('EMANUEL ELIAS FERREIRA DA COSTA',         'MOTORISTA',              'diarista',     '2026-02-27', 'ativo', '{}'),
  ('Jarlisson da Silva Costa',                'RASTELEIRO',             'diarista',     '2026-04-06', 'ativo', '{}'),
  ('ROSILDO DE SOUZA MENESZES',               'Motorista Carreta',      'diarista',     '2026-03-26', 'ativo', '{}'),
  ('EDERSON GUIMARÃES DE OLIVEIRA',           'Motorista Carreta',      'diarista',     '2026-03-30', 'ativo', '{}'),
  ('FRANCISCO RICARDO DA COSTA OLIVEIRA NETO','OP. DE PÁ ESCAVADEIRA',  'diarista',     '2026-04-06', 'ativo', '{}'),
  ('ISMAEL SILVA MELO',                        'RASTELEIRO',             'diarista',     '2026-04-06', 'ativo', '{}'),
  ('VANESSA SILVA DA CONCEIÇÃO',              'AUXILIAR DE COZINHA',    'diarista',     '2026-04-06', 'ativo', '{}'),
  ('DONIZETE RODRIGUES ARMES',                'ENCARREGADO',            'diarista',     '2026-04-06', 'ativo', '{}'),
  ('RENAN DE OLIVEIRA LIMA',                  'ADM. DE CARTEIRA OBRAS', 'diarista',     '2026-04-07', 'ativo', '{}'),
  ('EMERSON SOUZA CORREIA',                   'RASTELEIRO',             'diarista',     '2026-04-08', 'ativo', '{}'),
  ('ADSON HENRIQUE OLIVEIRA GONÇALVES',       'MOTORISTA',              'diarista',     '2026-04-09', 'ativo', '{}'),
  ('Wilmerson Silva do Amaral',               'MOTORISTA',              'diarista',     '2026-04-24', 'ativo', '{}'),
  ('JORGEAN VARELA DA SILVA',                 'Alugou Caminhões',       'terceirizado', NULL,         'ativo', '{}')
ON CONFLICT (nome) DO NOTHING;

-- Índice de seed pode ser removido depois (não é necessário para o app).
-- Deixe se quiser proteger contra dup futura por nome.

COMMIT;

-- Verificação:
-- SELECT count(*) FROM public.apont_funcionarios;  -- deve aumentar em 27
-- SELECT nome, funcao, tipo_vinculo, data_admissao FROM public.apont_funcionarios ORDER BY created_at DESC LIMIT 30;
