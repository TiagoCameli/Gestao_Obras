// Hook de preferências do Dashboard.
//
// Persiste em localStorage, por usuário, a visibilidade de cada bloco/painel
// do Dashboard principal. Cada usuário escolhe quais painéis quer ver via
// toggles no topo da página.
//
// Chaves são independentes da permissão (`temAcao`):
//   - Sem permissão  → bloco NUNCA aparece (gate de segurança)
//   - Com permissão  → o usuário decide se quer visualizar via toggle
//
// Padrão "ligado" pra todos os painéis. Para resetar é só limpar a chave
// no localStorage ou usar o botão "Restaurar padrão" no painel de toggles.

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

/** Chaves de cada bloco/painel do Dashboard. */
export type DashboardPanelKey =
  | 'kpis_obras'
  | 'grafico_gastos'
  | 'resumo_combustivel'
  | 'resumo_insumos'
  | 'resumo_manutencao'
  | 'resumo_obras';

export const DASHBOARD_PANELS: Array<{
  key: DashboardPanelKey;
  label: string;
  /** Permissão (chave de `ACOES_PLATAFORMA`) que gateia o painel. */
  acao: string;
}> = [
  { key: 'kpis_obras',          label: 'KPIs de Obras',                 acao: 'ver_dashboard' },
  { key: 'grafico_gastos',      label: 'Gastos por Tipo',               acao: 'ver_dashboard' },
  { key: 'resumo_obras',        label: 'Resumo de Obras',               acao: 'ver_dashboard_obras' },
  { key: 'resumo_combustivel',  label: 'Resumo de Combustível',         acao: 'ver_dashboard_combustivel' },
  { key: 'resumo_insumos',      label: 'Resumo de Insumos',             acao: 'ver_dashboard_insumos' },
  { key: 'resumo_manutencao',   label: 'Resumo de Manutenção',          acao: 'ver_dashboard_manutencao' },
];

const DEFAULTS: Record<DashboardPanelKey, boolean> = {
  kpis_obras: true,
  grafico_gastos: true,
  resumo_combustivel: true,
  resumo_insumos: true,
  resumo_manutencao: true,
  resumo_obras: true,
};

function storageKey(userId: string | undefined): string {
  return `emt-dashboard-prefs:${userId ?? 'anon'}`;
}

function loadPrefs(userId: string | undefined): Record<DashboardPanelKey, boolean> {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

function savePrefs(userId: string | undefined, prefs: Record<DashboardPanelKey, boolean>): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(prefs));
  } catch {
    // localStorage cheio / desabilitado — silenciar
  }
}

/**
 * Hook principal: retorna estado de visibilidade dos painéis + ações.
 *
 * - `visible(key)`  → true se o usuário escolheu mostrar E tem permissão
 * - `canSee(key)`   → true só se tem permissão (independente da escolha)
 * - `setShow(key)`  → liga/desliga toggle
 * - `resetAll()`    → volta tudo para o padrão "ligado"
 */
export function useDashboardPrefs() {
  const { usuario, temAcao } = useAuth();
  const userId = usuario?.funcionarioId;
  const [prefs, setPrefs] = useState<Record<DashboardPanelKey, boolean>>(() =>
    loadPrefs(userId)
  );

  // Quando o usuário muda (login/logout), recarrega.
  useEffect(() => {
    setPrefs(loadPrefs(userId));
  }, [userId]);

  const canSee = useCallback(
    (key: DashboardPanelKey) => {
      const panel = DASHBOARD_PANELS.find((p) => p.key === key);
      if (!panel) return false;
      return temAcao(panel.acao);
    },
    [temAcao]
  );

  const visible = useCallback(
    (key: DashboardPanelKey) => canSee(key) && prefs[key] !== false,
    [canSee, prefs]
  );

  const setShow = useCallback(
    (key: DashboardPanelKey, value: boolean) => {
      setPrefs((prev) => {
        const next = { ...prev, [key]: value };
        savePrefs(userId, next);
        return next;
      });
    },
    [userId]
  );

  const toggle = useCallback(
    (key: DashboardPanelKey) => setShow(key, !prefs[key]),
    [setShow, prefs]
  );

  const resetAll = useCallback(() => {
    const reset = { ...DEFAULTS };
    setPrefs(reset);
    savePrefs(userId, reset);
  }, [userId]);

  return { prefs, visible, canSee, setShow, toggle, resetAll };
}
