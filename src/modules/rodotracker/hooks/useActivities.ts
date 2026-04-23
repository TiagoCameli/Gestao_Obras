import { useState, useCallback, useEffect, useRef } from "react";
import type { Activity } from "../types/activity";
import { getAllPhotoIds } from "../types/activity";
import {
  listActivities,
  upsertActivity,
  deleteActivity as apiDeleteActivity,
  photoStorage,
  pdfStorage,
} from "../utils/rodotrackerApi";

export function useActivities(obraId: string) {
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    let alive = true;
    listActivities(obraId).then((list) => {
      if (alive) setActivities(list);
    });
    return () => {
      alive = false;
    };
  }, [obraId]);

  // Ref mantém a última lista pra handlers não dependerem da closure.
  const activitiesRef = useRef<Activity[]>(activities);
  activitiesRef.current = activities;

  const addActivity = useCallback(
    async (activity: Activity) => {
      await upsertActivity(activity, obraId);
      setActivities((prev) => [activity, ...prev]);
    },
    [obraId]
  );

  const updateActivity = useCallback(
    async (updated: Activity) => {
      await upsertActivity(updated, obraId);
      setActivities((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    },
    [obraId]
  );

  const deleteActivity = useCallback(async (id: string) => {
    const target = activitiesRef.current.find((a) => a.id === id);
    if (target) {
      const photoIds = getAllPhotoIds(target);
      if (photoIds.length > 0) await photoStorage.delete(photoIds);
      const pdfIds = target.pdfs?.map((p) => p.id) ?? [];
      if (pdfIds.length > 0) await pdfStorage.delete(pdfIds);
    }
    await apiDeleteActivity(id);
    setActivities((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { activities, addActivity, updateActivity, deleteActivity };
}
