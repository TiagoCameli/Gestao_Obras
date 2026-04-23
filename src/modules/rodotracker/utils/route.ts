import L from "leaflet";

/**
 * Given a point and a route polyline, find the nearest point on the route
 * and return the cumulative distance (in km) from the route start to that point.
 */
export function calcKmAlongRoute(
  lat: number,
  lng: number,
  route: [number, number][]
): { km: number; nearestLat: number; nearestLng: number } | null {
  if (!route || route.length < 2) return null;

  const point = L.latLng(lat, lng);
  let bestDist = Infinity;
  let bestSegIndex = 0;
  let bestProjection: L.LatLng | null = null;

  // Find nearest segment
  for (let i = 0; i < route.length - 1; i++) {
    const a = L.latLng(route[i][0], route[i][1]);
    const b = L.latLng(route[i + 1][0], route[i + 1][1]);
    const proj = projectOnSegment(point, a, b);
    const dist = point.distanceTo(proj);
    if (dist < bestDist) {
      bestDist = dist;
      bestSegIndex = i;
      bestProjection = proj;
    }
  }

  if (!bestProjection) return null;

  // Sum distance from route start to the beginning of the best segment
  let cumulativeMeters = 0;
  for (let i = 0; i < bestSegIndex; i++) {
    const a = L.latLng(route[i][0], route[i][1]);
    const b = L.latLng(route[i + 1][0], route[i + 1][1]);
    cumulativeMeters += a.distanceTo(b);
  }

  // Add partial segment distance
  const segStart = L.latLng(route[bestSegIndex][0], route[bestSegIndex][1]);
  cumulativeMeters += segStart.distanceTo(bestProjection);

  return {
    km: Math.round(cumulativeMeters / 10) / 100, // round to 2 decimals
    nearestLat: bestProjection.lat,
    nearestLng: bestProjection.lng,
  };
}

/**
 * Walk a polyline and return a point every `stepKm` kilometers, starting at 0.
 * Includes the final endpoint with its total distance so the last marker lands
 * exactly at the end of the route.
 */
export function kmMarkersAlongRoute(
  route: [number, number][],
  stepKm = 1
): { km: number; lat: number; lng: number }[] {
  if (!route || route.length < 2) return [];

  const stepM = stepKm * 1000;
  const markers: { km: number; lat: number; lng: number }[] = [];
  markers.push({ km: 0, lat: route[0][0], lng: route[0][1] });

  let cumulative = 0;
  let nextTarget = stepM;

  for (let i = 0; i < route.length - 1; i++) {
    const a = L.latLng(route[i][0], route[i][1]);
    const b = L.latLng(route[i + 1][0], route[i + 1][1]);
    const segLen = a.distanceTo(b);
    if (segLen === 0) continue;

    while (cumulative + segLen >= nextTarget) {
      const t = (nextTarget - cumulative) / segLen;
      const lat = a.lat + t * (b.lat - a.lat);
      const lng = a.lng + t * (b.lng - a.lng);
      markers.push({ km: nextTarget / 1000, lat, lng });
      nextTarget += stepM;
    }
    cumulative += segLen;
  }

  const totalKm = cumulative / 1000;
  const last = markers[markers.length - 1];
  if (Math.abs(last.km - totalKm) > 0.01) {
    const end = route[route.length - 1];
    markers.push({ km: totalKm, lat: end[0], lng: end[1] });
  }

  return markers;
}

/**
 * Dado dois pontos (start/end) e a polyline da rodovia, retorna a fatia da
 * polyline que conecta start→end seguindo o traçado. O primeiro e último
 * ponto são as projeções de start/end no respectivo segmento mais próximo,
 * e entre eles todos os vértices originais são preservados na ordem correta
 * (revertidos se o end estiver antes do start na polyline).
 */
export function sliceRouteBetween(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  route: [number, number][]
): [number, number][] {
  if (!route || route.length < 2) return [];

  const nearest = (pt: L.LatLng) => {
    let bestDist = Infinity;
    let segIdx = 0;
    let proj: L.LatLng = L.latLng(route[0][0], route[0][1]);
    for (let i = 0; i < route.length - 1; i++) {
      const a = L.latLng(route[i][0], route[i][1]);
      const b = L.latLng(route[i + 1][0], route[i + 1][1]);
      const p = projectOnSegment(pt, a, b);
      const d = pt.distanceTo(p);
      if (d < bestDist) {
        bestDist = d;
        segIdx = i;
        proj = p;
      }
    }
    return { segIdx, proj };
  };

  const s = nearest(L.latLng(start.lat, start.lng));
  const e = nearest(L.latLng(end.lat, end.lng));

  // Se a projeção do end vier ANTES do start (ou no mesmo segmento mas mais
  // próximo de A), precisamos inverter e depois reverter o resultado.
  const reversed =
    e.segIdx < s.segIdx ||
    (e.segIdx === s.segIdx &&
      L.latLng(route[s.segIdx][0], route[s.segIdx][1]).distanceTo(e.proj) <
        L.latLng(route[s.segIdx][0], route[s.segIdx][1]).distanceTo(s.proj));

  const a = reversed ? e : s;
  const b = reversed ? s : e;

  const out: [number, number][] = [];
  out.push([a.proj.lat, a.proj.lng]);
  for (let i = a.segIdx + 1; i <= b.segIdx; i++) {
    out.push([route[i][0], route[i][1]]);
  }
  out.push([b.proj.lat, b.proj.lng]);

  if (reversed) out.reverse();
  return out;
}

/**
 * Retorna o ponto no meio (pelo comprimento de arco) de uma polyline. Útil
 * para posicionar um marcador central num trecho CBUQ. Se a polyline tiver
 * menos de 2 vértices, retorna null.
 */
export function midpointOfPath(
  path: [number, number][]
): { lat: number; lng: number } | null {
  if (!path || path.length < 2) return null;
  const pts = path.map(([lat, lng]) => L.latLng(lat, lng));
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    total += pts[i].distanceTo(pts[i + 1]);
  }
  if (total === 0) return { lat: pts[0].lat, lng: pts[0].lng };
  const target = total / 2;
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = pts[i].distanceTo(pts[i + 1]);
    if (acc + seg >= target) {
      const t = (target - acc) / seg;
      return {
        lat: pts[i].lat + t * (pts[i + 1].lat - pts[i].lat),
        lng: pts[i].lng + t * (pts[i + 1].lng - pts[i].lng),
      };
    }
    acc += seg;
  }
  const last = pts[pts.length - 1];
  return { lat: last.lat, lng: last.lng };
}

/**
 * Project point P onto segment AB, returning the closest point on the segment.
 */
export function projectOnSegment(p: L.LatLng, a: L.LatLng, b: L.LatLng): L.LatLng {
  const ax = a.lng, ay = a.lat;
  const bx = b.lng, by = b.lat;
  const px = p.lng, py = p.lat;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return a;

  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  return L.latLng(ay + t * dy, ax + t * dx);
}
