// Persiste visões nomeadas (combinação de filtros) em localStorage.
// Chave única do módulo — escopo prefixado pra não conflitar com outras
// features que adicionarem visões.

import type { CombustivelFilterState, SavedView } from './types';

const STORAGE_KEY = 'combustivel.savedViews.v1';

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function loadSavedViews(): SavedView[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SavedView[];
  } catch {
    return [];
  }
}

export function persistSavedViews(views: SavedView[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
  } catch {
    // localStorage cheio / disabled — ignora silenciosamente
  }
}

export function addSavedView(nome: string, filtros: CombustivelFilterState): SavedView[] {
  const novo: SavedView = {
    id: gerarId(),
    nome: nome.trim() || 'Sem nome',
    filtros,
    createdAt: new Date().toISOString(),
  };
  const atual = loadSavedViews();
  const novas = [novo, ...atual].slice(0, 20); // teto de 20
  persistSavedViews(novas);
  return novas;
}

export function removeSavedView(id: string): SavedView[] {
  const atual = loadSavedViews();
  const novas = atual.filter((v) => v.id !== id);
  persistSavedViews(novas);
  return novas;
}
