-- Fase 1a — Adiciona flags de transportadora em fornecedores.
--
-- Decisão: a mesma empresa às vezes é fornecedora de material e
-- transportadora (ex: Areacre, EMT Transportes). Em vez de criar tabela
-- transportadoras paralela, marcamos via flags em fornecedores. Uma row
-- por CNPJ com as flags ativas no que ela é.
--
-- eh_transportadora      → aparece no select de transportadora dos forms.
-- taxa_litro_padrao      → taxa R$/L sugerida em saídas de combustível
--                          tipo_consumidor='carreta_transportadora'.
-- eh_dona_de_tanque      → marca empresas que têm tanque externo (Areacre).
--                          A EMT NÃO recebe essa flag — tanque EMT é "a casa"
--                          (depositos.transportadora_proprietaria_id IS NULL).

alter table public.fornecedores
  add column if not exists eh_transportadora boolean not null default false,
  add column if not exists taxa_litro_padrao numeric(10,4) not null default 0,
  add column if not exists eh_dona_de_tanque boolean not null default false;

create index if not exists fornecedores_eh_transportadora_idx
  on public.fornecedores (eh_transportadora) where eh_transportadora = true;
