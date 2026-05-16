/**
 * Helpers de filtros do módulo Compras (sem JSX).
 */

export function dentroDoPeriodo(dataIso: string, de: string, ate: string): boolean {
  if (!de && !ate) return true;
  if (!dataIso) return false;
  const d = dataIso.slice(0, 10);
  if (de && d < de) return false;
  if (ate && d > ate) return false;
  return true;
}
