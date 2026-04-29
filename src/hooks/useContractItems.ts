import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listContractItems,
  insertContractItem,
  updateContractItem,
  deleteContractItem,
} from '../modules/rodotracker/utils/rodotrackerApi';
import type { ContractItem } from '../modules/rodotracker/types/activity';

const KEY = (obraId: string) => ['rodotracker_contract_items', obraId];

export function useContractItemsByObra(obraId: string) {
  return useQuery({
    queryKey: KEY(obraId),
    queryFn: () => listContractItems(obraId),
    enabled: !!obraId,
  });
}

export function useAdicionarContractItem(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: ContractItem) => insertContractItem(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(obraId) }),
  });
}

export function useAtualizarContractItem(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: ContractItem) => updateContractItem(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(obraId) }),
  });
}

export function useExcluirContractItem(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteContractItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(obraId) }),
  });
}
