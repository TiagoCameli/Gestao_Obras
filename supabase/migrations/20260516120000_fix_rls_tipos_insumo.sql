-- A RLS de tipos_insumo era a única que exigia auth.jwt() ->> 'role' = 'admin',
-- mas o app usa a tabela funcionarios + ACOES_PLATAFORMA pra controle de
-- permissão — JWT role NUNCA é setado como 'admin'. Resultado: ninguém
-- conseguia criar/editar/excluir tipo de insumo via UI.
--
-- Alinhamento com o padrão das outras tabelas de cadastro
-- (fornecedores, insumos, localidades, obras, tipos_equipamento): qualquer
-- authenticated user passa pela RLS, e o controle de quem pode acessar fica
-- nas chaves criar_tipos_insumo / editar_tipos_insumo / excluir_tipos_insumo
-- (UI gating via temAcao).

begin;

drop policy if exists "Admins can manage tipos_insumo" on public.tipos_insumo;
drop policy if exists "Authenticated users can read tipos_insumo" on public.tipos_insumo;

create policy "Authenticated full access"
  on public.tipos_insumo
  for all
  to authenticated
  using (true)
  with check (true);

commit;
