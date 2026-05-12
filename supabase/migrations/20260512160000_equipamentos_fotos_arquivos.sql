-- Marco 1 / PR5 — Permitir anexar fotos e arquivos ao próprio equipamento.
--
-- Diferente de fotos de manutenção (na OS) ou scans de documentos (em
-- documentos_equipamento.foto_urls), estas são as fotos "do equipamento":
-- front, lateral, painel, plaqueta de identificação, número de série,
-- chassi, hodômetro inicial. Servem pra identificação visual e prova de
-- estado na entrega.
--
-- arquivo_urls: PDFs de manual técnico, ficha do fabricante, etc.

begin;

alter table public.equipamentos
  add column if not exists foto_urls text[] not null default '{}',
  add column if not exists arquivo_urls text[] not null default '{}';

comment on column public.equipamentos.foto_urls is
  'Fotos do equipamento (front, lateral, painel, plaqueta, chassi). '
  'Usadas pra identificação visual no detalhe.';

comment on column public.equipamentos.arquivo_urls is
  'Arquivos vinculados (manual técnico, ficha do fabricante). '
  'Documentos com vencimento ficam em documentos_equipamento.';

commit;
