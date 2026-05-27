import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { dbToEngenhariaPasta, type EngenhariaPasta, type EngenhariaPastaTipo } from '../types/pasta';

const QK_RAIZES = ['engenharia', 'pastas', 'raizes'] as const;
const QK_FILHAS = (parentId: string) => ['engenharia', 'pastas', 'filhas', parentId] as const;
const QK_PASTA = (id: string) => ['engenharia', 'pastas', 'item', id] as const;

/**
 * Lista pastas raiz (parent_id IS NULL) — usadas na home /engenharia.
 * Filtra deleted_at via RLS (policy engenharia_pastas_select).
 */
export function useEngenhariaPastasRaizes() {
  return useQuery({
    queryKey: QK_RAIZES,
    queryFn: async (): Promise<EngenhariaPasta[]> => {
      const { data, error } = await supabase
        .from('engenharia_pastas')
        .select('*')
        .is('parent_id', null)
        .order('tipo', { ascending: true })  // obra antes de avulsa
        .order('nome', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(dbToEngenhariaPasta);
    },
  });
}

/** Lista filhas de uma pasta (ou raízes se parentId === null). */
export function useEngenhariaPastasFilhas(parentId: string | null) {
  return useQuery({
    queryKey: parentId
      ? QK_FILHAS(parentId)
      : (['engenharia', 'pastas', 'filhas', 'null'] as const),
    queryFn: async (): Promise<EngenhariaPasta[]> => {
      let q = supabase.from('engenharia_pastas').select('*').order('nome', { ascending: true });
      if (parentId === null) q = q.is('parent_id', null);
      else q = q.eq('parent_id', parentId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(dbToEngenhariaPasta);
    },
    enabled: parentId !== undefined,
  });
}

/** Busca uma pasta específica (para breadcrumb / PastaPage). */
export function useEngenhariaPasta(id: string) {
  return useQuery({
    queryKey: QK_PASTA(id),
    queryFn: async (): Promise<EngenhariaPasta | null> => {
      const { data, error } = await supabase
        .from('engenharia_pastas')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data ? dbToEngenhariaPasta(data) : null;
    },
    enabled: !!id,
  });
}

/** Cria pasta (subpasta dentro de parent OU avulsa raiz). */
export function useCriarPasta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      nome: string;
      parentId: string | null;
      tipo: Exclude<EngenhariaPastaTipo, 'obra'>;  // 'obra' só via trigger
    }) => {
      const caminho = input.parentId
        ? await calcularCaminho(input.parentId, input.nome)
        : '/' + slugify(input.nome);
      const { data, error } = await supabase
        .from('engenharia_pastas')
        .insert({
          parent_id: input.parentId,
          obra_id: null,
          nome: input.nome,
          tipo: input.tipo,
          caminho,
        })
        .select('*')
        .single();
      if (error) throw error;
      return dbToEngenhariaPasta(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['engenharia', 'pastas'] });
    },
  });
}

export function useRenomearPasta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; nome: string }) => {
      const { error } = await supabase
        .from('engenharia_pastas')
        .update({ nome: input.nome, atualizado_em: new Date().toISOString() })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['engenharia', 'pastas'] }),
  });
}

export function useMoverPasta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; novoParentId: string | null }) => {
      const novoTipo: EngenhariaPastaTipo = input.novoParentId ? 'subpasta' : 'avulsa';
      const { error } = await supabase
        .from('engenharia_pastas')
        .update({
          parent_id: input.novoParentId,
          tipo: novoTipo,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['engenharia', 'pastas'] }),
  });
}

export function useSoftDeletePasta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('engenharia_pastas')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['engenharia', 'pastas'] }),
  });
}

// ===== helpers locais =====
function slugify(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'pasta'
  );
}

async function calcularCaminho(parentId: string, nome: string): Promise<string> {
  const { data, error } = await supabase
    .from('engenharia_pastas')
    .select('caminho')
    .eq('id', parentId)
    .single();
  if (error || !data) throw error ?? new Error('parent not found');
  return data.caminho + '/' + slugify(nome);
}
