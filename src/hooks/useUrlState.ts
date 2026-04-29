import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Sincroniza um valor com um query param da URL. Sobrevive a F5 e ao
 * botão voltar/avançar do navegador. Use um `key` prefixado com a rota
 * (ex: 'obras-busca') pra evitar colisão entre páginas.
 *
 * Quando `value === defaultValue`, remove o param da URL pra deixar a
 * barra de endereço mais enxuta.
 */
export function useUrlState(
  key: string,
  defaultValue = ''
): [string, (next: string) => void] {
  const [params, setParams] = useSearchParams();
  const value = params.get(key) ?? defaultValue;

  const setValue = useCallback(
    (next: string) => {
      setParams((prev) => {
        const sp = new URLSearchParams(prev);
        if (!next || next === defaultValue) sp.delete(key);
        else sp.set(key, next);
        return sp;
      }, { replace: true });
    },
    [key, defaultValue, setParams]
  );

  return [value, setValue];
}

/** Variante pra lista separada por vírgulas. */
export function useUrlStateList(
  key: string
): [string[], (next: string[]) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get(key) ?? '';
  const value = raw ? raw.split(',').filter(Boolean) : [];

  const setValue = useCallback(
    (next: string[]) => {
      setParams((prev) => {
        const sp = new URLSearchParams(prev);
        if (next.length === 0) sp.delete(key);
        else sp.set(key, next.join(','));
        return sp;
      }, { replace: true });
    },
    [key, setParams]
  );

  return [value, setValue];
}
