import L from "leaflet";

export function edgeDistance(a: [number, number], b: [number, number]): number {
  return L.latLng(a[0], a[1]).distanceTo(L.latLng(b[0], b[1]));
}

export function calcPolygonArea(corners: [number, number][]): number {
  if (corners.length < 3) return 0;
  let total = 0;
  const p0 = L.latLng(corners[0][0], corners[0][1]);
  for (let i = 1; i < corners.length - 1; i++) {
    const p1 = L.latLng(corners[i][0], corners[i][1]);
    const p2 = L.latLng(corners[i + 1][0], corners[i + 1][1]);
    const a = p0.distanceTo(p1);
    const b = p1.distanceTo(p2);
    const c = p2.distanceTo(p0);
    const s = (a + b + c) / 2;
    total += Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)));
  }
  return total;
}

export function formatMeters(m: number): string {
  if (m < 1) return `${(m * 100).toFixed(0)} cm`;
  if (m < 100) return `${m.toFixed(1)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

export function formatArea(m2: number): string {
  if (m2 >= 10000) return `${(m2 / 10000).toFixed(2)} ha`;
  if (m2 >= 1000) return `${(m2 / 1000).toFixed(1)} mil m²`;
  return `${m2.toFixed(1)} m²`;
}

/**
 * For a rectangular activity area (4 corners), returns the two average side
 * lengths — width being the average of corners 0-1 and 2-3, and length the
 * average of 1-2 and 3-0.
 */
export function rectangleDimensions(
  corners: [number, number][]
): { width: number; length: number; area: number } | null {
  if (corners.length !== 4) return null;
  const w1 = edgeDistance(corners[0], corners[1]);
  const w2 = edgeDistance(corners[2], corners[3]);
  const l1 = edgeDistance(corners[1], corners[2]);
  const l2 = edgeDistance(corners[3], corners[0]);
  const width = (w1 + w2) / 2;
  const length = (l1 + l2) / 2;
  return { width, length, area: calcPolygonArea(corners) };
}
