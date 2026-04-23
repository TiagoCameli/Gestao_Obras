import { useState, useMemo, useCallback } from "react";
import type { Activity, Filters } from "../types/activity";
import { parseKmNumber } from "../utils/format";

const emptyFilters: Filters = {
  dateStart: "",
  dateEnd: "",
  service: "",
  medicao: null,
  kmStart: "",
  kmEnd: "",
};

export function useFilters(activities: Activity[]) {
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters });
  const [applied, setApplied] = useState<Filters>({ ...emptyFilters });

  const isActive = useMemo(() => {
    return (
      applied.dateStart !== "" ||
      applied.dateEnd !== "" ||
      applied.service !== "" ||
      applied.medicao !== null ||
      applied.kmStart !== "" ||
      applied.kmEnd !== ""
    );
  }, [applied]);

  const filtered = useMemo(() => {
    if (!isActive) return activities;

    return activities.filter((a) => {
      if (applied.dateStart && a.date < applied.dateStart) return false;
      if (applied.dateEnd && a.date > applied.dateEnd) return false;
      if (applied.service && a.service !== applied.service) return false;
      if (applied.medicao !== null && a.medicao !== applied.medicao) return false;

      const kmNum = parseKmNumber(a.km);
      if (applied.kmStart && kmNum !== null) {
        if (kmNum < parseInt(applied.kmStart, 10)) return false;
      }
      if (applied.kmEnd && kmNum !== null) {
        if (kmNum > parseInt(applied.kmEnd, 10)) return false;
      }
      return true;
    });
  }, [activities, applied, isActive]);

  const applyFilters = useCallback(() => {
    setApplied({ ...filters });
  }, [filters]);

  const clearFilters = useCallback(() => {
    setFilters({ ...emptyFilters });
    setApplied({ ...emptyFilters });
  }, []);

  const availableMedicoes = useMemo(() => {
    const set = new Set<number>();
    for (const a of activities) {
      if (a.medicao !== null) set.add(a.medicao);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [activities]);

  return {
    filters,
    setFilters,
    filtered,
    isActive,
    applyFilters,
    clearFilters,
    availableMedicoes,
  };
}
