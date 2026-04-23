import { useState, useCallback, useEffect } from "react";
import type { ContractItem } from "../types/activity";
import { listContractItems, replaceContractItems } from "../utils/rodotrackerApi";

/**
 * O tracker salva os itens do contrato em lote (cancelar edit / salvar edit /
 * import Excel). Pra manter a semântica das funções sem racing contra o
 * servidor, fazemos replaceAll como fonte canônica e as outras helpers
 * atualizam o estado local + persistem via replaceAll.
 */
export function useContractItems(obraId: string) {
  const [items, setItems] = useState<ContractItem[]>([]);

  useEffect(() => {
    let alive = true;
    listContractItems(obraId).then((list) => {
      if (alive) setItems(list);
    });
    return () => {
      alive = false;
    };
  }, [obraId]);

  const persist = useCallback(
    async (next: ContractItem[]) => {
      await replaceContractItems(obraId, next);
    },
    [obraId]
  );

  const addItem = useCallback(
    async (item: ContractItem) => {
      let snapshot: ContractItem[] = [];
      setItems((prev) => {
        snapshot = [...prev, item];
        return snapshot;
      });
      await persist(snapshot);
    },
    [persist]
  );

  const addItems = useCallback(
    async (newItems: ContractItem[]) => {
      if (newItems.length === 0) return;
      let snapshot: ContractItem[] = [];
      setItems((prev) => {
        snapshot = [...prev, ...newItems];
        return snapshot;
      });
      await persist(snapshot);
    },
    [persist]
  );

  const updateItem = useCallback(
    async (updated: ContractItem) => {
      let snapshot: ContractItem[] = [];
      setItems((prev) => {
        snapshot = prev.map((i) => (i.id === updated.id ? updated : i));
        return snapshot;
      });
      await persist(snapshot);
    },
    [persist]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      let snapshot: ContractItem[] = [];
      setItems((prev) => {
        snapshot = prev.filter((i) => i.id !== id);
        return snapshot;
      });
      await persist(snapshot);
    },
    [persist]
  );

  const replaceAll = useCallback(
    async (all: ContractItem[]) => {
      setItems(all);
      await persist(all);
    },
    [persist]
  );

  return { items, addItem, addItems, updateItem, deleteItem, replaceAll };
}
