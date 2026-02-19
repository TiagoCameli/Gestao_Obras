CREATE TABLE IF NOT EXISTS categorias_material (
  id text PRIMARY KEY,
  nome text NOT NULL,
  valor text NOT NULL UNIQUE,
  ativo boolean DEFAULT true,
  criado_por text
);

-- Seed com as 10 categorias atuais
INSERT INTO categorias_material (id, nome, valor, ativo) VALUES
  (gen_random_uuid()::text, 'Concreto e Argamassa', 'concreto_argamassa', true),
  (gen_random_uuid()::text, 'Aço e Ferragens', 'aco_ferragens', true),
  (gen_random_uuid()::text, 'Madeiras', 'madeiras', true),
  (gen_random_uuid()::text, 'Elétrica', 'eletrica', true),
  (gen_random_uuid()::text, 'Hidráulica', 'hidraulica', true),
  (gen_random_uuid()::text, 'Pintura', 'pintura', true),
  (gen_random_uuid()::text, 'Acabamento', 'acabamento', true),
  (gen_random_uuid()::text, 'EPI', 'epi', true),
  (gen_random_uuid()::text, 'Ferramentas', 'ferramentas', true),
  (gen_random_uuid()::text, 'Outros', 'outros', true);
