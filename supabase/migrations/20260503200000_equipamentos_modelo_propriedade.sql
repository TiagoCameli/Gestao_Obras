-- Adiciona colunas pro novo módulo Frota:
--  • modelo: string livre (ex. "320C", "PC200"). Futuramente pode virar FK
--    pra catálogo de modelos quando o sistema de manutenção for refeito.
--  • propriedade: 'propria' (default) ou 'alugada' (Colorado).

alter table public.equipamentos
  add column if not exists modelo text,
  add column if not exists propriedade text not null default 'propria';

create index if not exists equipamentos_modelo_idx on public.equipamentos(modelo) where ativo;
create index if not exists equipamentos_propriedade_idx on public.equipamentos(propriedade) where ativo;
