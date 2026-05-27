import { describe, it, expect } from "vitest";
import { latLngFromKm } from "./latLngFromKm";

const obraBase = {
  centerLat: -10.0,
  centerLng: -55.0,
  kmInicial: 600,
  routeGeoJson: [
    [-10.0, -55.0],
    [-10.0, -54.991], // ~1 km a leste em latitude ~-10
  ] as [number, number][],
};

describe("latLngFromKm", () => {
  it("km exatamente no início da obra retorna primeiro ponto da rota", () => {
    const r = latLngFromKm(600, obraBase as any);
    expect(r).not.toBeNull();
    expect(r!.lat).toBeCloseTo(-10.0, 4);
    expect(r!.lng).toBeCloseTo(-55.0, 4);
  });

  it("km além do fim da obra retorna último ponto", () => {
    const r = latLngFromKm(999, obraBase as any);
    expect(r).not.toBeNull();
    expect(r!.lat).toBeCloseTo(-10.0, 4);
    expect(r!.lng).toBeCloseTo(-54.991, 4);
  });

  it("km no meio interpola lat/lng", () => {
    const r = latLngFromKm(600.5, obraBase as any);
    expect(r).not.toBeNull();
    expect(r!.lng).toBeCloseTo(-54.9955, 3);
  });

  it("sem routeGeoJson cai pro centro da obra", () => {
    const r = latLngFromKm(700, { ...obraBase, routeGeoJson: null } as any);
    expect(r).not.toBeNull();
    expect(r!.lat).toBe(-10.0);
    expect(r!.lng).toBe(-55.0);
  });

  it("sem kmInicial cai pro centro da obra", () => {
    const r = latLngFromKm(700, { ...obraBase, kmInicial: null } as any);
    expect(r!.lat).toBe(-10.0);
    expect(r!.lng).toBe(-55.0);
  });

  it("km menor que kmInicial cai pro início da rota", () => {
    const r = latLngFromKm(550, obraBase as any);
    expect(r!.lat).toBeCloseTo(-10.0, 4);
    expect(r!.lng).toBeCloseTo(-55.0, 4);
  });
});
