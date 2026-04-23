import { useState, useCallback, useEffect } from "react";
import type { Obra } from "../types/activity";
import {
  listObras,
  upsertObra,
  deleteObra as apiDeleteObra,
} from "../utils/rodotrackerApi";

export function useObras() {
  const [obras, setObras] = useState<Obra[]>([]);

  useEffect(() => {
    let alive = true;
    listObras().then((list) => {
      if (alive) setObras(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  const addObra = useCallback(async (obra: Obra) => {
    await upsertObra(obra);
    setObras((prev) => [obra, ...prev]);
  }, []);

  const updateObra = useCallback(async (updated: Obra) => {
    await upsertObra(updated);
    setObras((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  }, []);

  const deleteObra = useCallback(async (id: string) => {
    // A FK com on-delete cascade derruba activities/plan_items/contract_items
    // automaticamente; só precisamos apagar a obra.
    await apiDeleteObra(id);
    setObras((prev) => prev.filter((o) => o.id !== id));
  }, []);

  return { obras, addObra, updateObra, deleteObra };
}
