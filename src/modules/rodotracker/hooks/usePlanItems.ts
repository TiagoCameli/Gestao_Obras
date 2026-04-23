import { useState, useCallback, useEffect } from "react";
import type { PlanItem } from "../types/activity";
import { listPlanItems, replacePlanItems } from "../utils/rodotrackerApi";

export function usePlanItems(obraId: string) {
  const [items, setItems] = useState<PlanItem[]>([]);

  useEffect(() => {
    let alive = true;
    listPlanItems(obraId).then((list) => {
      if (alive) setItems(list);
    });
    return () => {
      alive = false;
    };
  }, [obraId]);

  const persist = useCallback(
    async (next: PlanItem[]) => {
      await replacePlanItems(obraId, next);
    },
    [obraId]
  );

  const addItem = useCallback(
    async (item: PlanItem) => {
      let snapshot: PlanItem[] = [];
      setItems((prev) => {
        snapshot = [...prev, item];
        return snapshot;
      });
      await persist(snapshot);
    },
    [persist]
  );

  const updateItem = useCallback(
    async (updated: PlanItem) => {
      let snapshot: PlanItem[] = [];
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
      let snapshot: PlanItem[] = [];
      setItems((prev) => {
        snapshot = prev.filter((i) => i.id !== id);
        return snapshot;
      });
      await persist(snapshot);
    },
    [persist]
  );

  return { items, addItem, updateItem, deleteItem };
}
