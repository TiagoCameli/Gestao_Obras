import L from "leaflet";
import type { Obra } from "../types/activity";

/**
 * Dado um km da rodovia e a Obra, retorna lat/lng do ponto correspondente
 * caminhando a polyline `routeGeoJson` a partir de `obra.kmInicial`. Se a obra
 * não tiver rota ou kmInicial, retorna o centro da obra como fallback.
 */
export function latLngFromKm(
  highwayKm: number,
  obra: Pick<Obra, "centerLat" | "centerLng" | "kmInicial" | "routeGeoJson">
): { lat: number; lng: number } | null {
  if (!Number.isFinite(highwayKm)) return null;
  const fallback = { lat: obra.centerLat, lng: obra.centerLng };
  const route = obra.routeGeoJson;
  if (!route || route.length < 2 || obra.kmInicial == null) return fallback;

  const offsetKm = highwayKm - obra.kmInicial;
  if (offsetKm <= 0) return { lat: route[0][0], lng: route[0][1] };
  const targetMeters = offsetKm * 1000;

  let cumulative = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const a = L.latLng(route[i][0], route[i][1]);
    const b = L.latLng(route[i + 1][0], route[i + 1][1]);
    const segLen = a.distanceTo(b);
    if (segLen === 0) continue;
    if (cumulative + segLen >= targetMeters) {
      const t = (targetMeters - cumulative) / segLen;
      return {
        lat: a.lat + t * (b.lat - a.lat),
        lng: a.lng + t * (b.lng - a.lng),
      };
    }
    cumulative += segLen;
  }

  const last = route[route.length - 1];
  return { lat: last[0], lng: last[1] };
}
