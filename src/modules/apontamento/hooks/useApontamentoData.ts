import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listFuncionarios,
  createFuncionario,
  updateFuncionario,
  deleteFuncionario,
  listObras,
  listEquipes,
  createEquipe,
  updateEquipe,
  deleteEquipe,
  alocarFuncionarios,
} from "../utils/apontamentoApi";
import type { Equipe, Funcionario } from "../types/funcionario";

const KEY = {
  funcionarios: ["apont", "funcionarios"] as const,
  obras: ["apont", "obras"] as const,
  equipes: (obraId?: string) => ["apont", "equipes", obraId ?? "all"] as const,
};

export function useFuncionarios() {
  return useQuery({ queryKey: KEY.funcionarios, queryFn: listFuncionarios });
}

export function useObrasApont() {
  return useQuery({ queryKey: KEY.obras, queryFn: listObras });
}

export function useEquipesApont(obraId?: string) {
  return useQuery({
    queryKey: KEY.equipes(obraId),
    queryFn: () => listEquipes(obraId),
  });
}

export function useCreateFuncionario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      f: Omit<Funcionario, "id" | "createdAt" | "updatedAt"> & { id?: string }
    ) => createFuncionario(f),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY.funcionarios }),
  });
}

export function useUpdateFuncionario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (f: Funcionario) => updateFuncionario(f),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY.funcionarios }),
  });
}

export function useDeleteFuncionario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteFuncionario(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY.funcionarios }),
  });
}

export function useCreateEquipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (e: Omit<Equipe, "id" | "ativo"> & { ativo?: boolean }) =>
      createEquipe(e),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["apont", "equipes"] }),
  });
}

export function useUpdateEquipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (e: Equipe) => updateEquipe(e),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["apont", "equipes"] }),
  });
}

export function useDeleteEquipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEquipe(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["apont", "equipes"] });
      qc.invalidateQueries({ queryKey: KEY.funcionarios });
    },
  });
}

export function useAlocarFuncionarios() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      funcionarioIds: string[];
      equipeId: string | null;
      obraId: string | null;
      encarregadoId?: string | null;
    }) =>
      alocarFuncionarios(
        args.funcionarioIds,
        args.equipeId,
        args.obraId,
        args.encarregadoId ?? null
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY.funcionarios }),
  });
}
