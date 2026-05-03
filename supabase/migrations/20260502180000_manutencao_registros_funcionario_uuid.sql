-- ============================================================================
-- Manutenção: trocar executado_por_funcionario_id de text para uuid
-- e referenciar apont_funcionarios.id (mecânicos reais).
-- ============================================================================
-- Schema original: text, sem FK (só comentário "ref funcionarios" — apontava
-- para a tabela legada `funcionarios`). Mecânicos reais ficam em
-- `apont_funcionarios` com id uuid.
--
-- USING cast: tenta interpretar valores existentes como UUID; valores que não
-- baterem no formato viram NULL (preserva o registro, perde o vínculo). Isso
-- é aceitável porque os IDs antigos não bateriam com apont_funcionarios.id de
-- qualquer forma.
-- ============================================================================

alter table public.manutencao_registros
  alter column executado_por_funcionario_id
  type uuid
  using (
    case
      when executado_por_funcionario_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then executado_por_funcionario_id::uuid
      else null
    end
  );

-- ON DELETE SET NULL: se um mecânico for deletado da tabela apont_funcionarios,
-- preserva o histórico de manutenção apenas removendo o vínculo.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'manutencao_registros_funcionario_fk'
  ) then
    alter table public.manutencao_registros
      add constraint manutencao_registros_funcionario_fk
      foreign key (executado_por_funcionario_id)
      references public.apont_funcionarios(id)
      on delete set null;
  end if;
end $$;
