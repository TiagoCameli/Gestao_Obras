import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToFuncionario, funcionarioToDb, dbToPerfilPermissao, perfilPermissaoToDb } from '../lib/mappers';
import type { Funcionario, PerfilPermissao } from '../types';

export function useFuncionarios() {
  return useQuery({
    queryKey: ['funcionarios'],
    queryFn: async () => {
      const { data, error } = await supabase.from('funcionarios').select('*');
      if (error) throw error;
      return (data ?? []).map(dbToFuncionario);
    },
  });
}

export function useAdicionarFuncionario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ funcionario, senha }: { funcionario: Funcionario; senha: string }) => {
      // 1. Create Supabase Auth user via Edge Function
      const { data: authData, error: authError } = await supabase.functions.invoke('create-user', {
        body: { email: funcionario.email, password: senha },
      });
      if (authError) throw authError;

      // 2. Insert into funcionarios table with auth_user_id
      const dbRow = funcionarioToDb({ ...funcionario, authUserId: authData.userId });
      const { error } = await supabase.from('funcionarios').insert(dbRow);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['funcionarios'] }),
  });
}

export function useAtualizarFuncionario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (funcionario: Funcionario) => {
      // `.select()` devolve as linhas afetadas. Se o RLS bloqueia o UPDATE,
      // o Supabase responde sucesso com 0 linhas (sem erro). Tratamos isso
      // como falha explícita pra nunca mais ter "salvar não faz nada".
      const { data, error } = await supabase
        .from('funcionarios')
        .update(funcionarioToDb(funcionario))
        .eq('id', funcionario.id)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(
          'Não foi possível salvar: você não tem permissão para editar este usuário (nenhuma linha foi alterada).'
        );
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['funcionarios'] }),
  });
}

export function useExcluirFuncionario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Usa Edge Function delete-user para garantir que auth.users também é
      // deletado (revoga sessões em outros devices). Se a Edge falhar por
      // não estar deployada, faz fallback ao DELETE direto (mantém compat).
      const { error: fnErr } = await supabase.functions.invoke('delete-user', {
        body: { funcionarioId: id },
      });
      if (fnErr) {
        const { error } = await supabase.from('funcionarios').delete().eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['funcionarios'] });
      qc.invalidateQueries({ queryKey: ['perfis_permissao'] });
    },
  });
}

// ── Permissoes ──

export function usePerfisPermissao() {
  return useQuery({
    queryKey: ['perfis_permissao'],
    queryFn: async () => {
      const { data, error } = await supabase.from('perfis_permissao').select('*');
      if (error) throw error;
      return (data ?? []).map(dbToPerfilPermissao);
    },
  });
}

export function useSalvarPerfilPermissao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (perfil: PerfilPermissao) => {
      const { error } = await supabase
        .from('perfis_permissao')
        .upsert(perfilPermissaoToDb(perfil), { onConflict: 'id' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['perfis_permissao'] }),
  });
}
