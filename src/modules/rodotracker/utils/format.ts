export function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export function formatCoord(value: number): string {
  return value.toFixed(6);
}

export function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export function parseKmNumber(km: string): number | null {
  const match = km.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}
