// Multi-select de meses para o extrato da Conta Corrente.
//
// Seleção vazia = "Todos". Permite marcar vários meses ao mesmo tempo
// (cada um filtra por igualdade exata do mesReferencia, mesma semântica
// do filtro de mês único anterior). Botão + popover com checkboxes,
// fecha ao clicar fora.

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Props {
  /** Meses disponíveis (valor raw, ex "2026-06-01"), já ordenados DESC. */
  meses: string[];
  /** Subconjunto de `meses` selecionado. Vazio = todos. */
  selecionados: string[];
  onChange: (next: string[]) => void;
  /** Formata o valor raw num rótulo legível (ex "Junho/2026"). */
  formatLabel: (m: string) => string;
}

export default function MesesFilterSelect({ meses, selecionados, onChange, formatLabel }: Props) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  const resumo =
    selecionados.length === 0
      ? 'Todos'
      : selecionados.length === 1
        ? formatLabel(selecionados[0])
        : `${selecionados.length} meses`;

  function toggle(m: string) {
    onChange(
      selecionados.includes(m)
        ? selecionados.filter((x) => x !== m)
        : [...selecionados, m],
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="h-9 px-2.5 text-sm rounded-lg bg-white border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] flex items-center justify-between gap-2 min-w-[140px] text-left"
        title="Filtrar por mês (pode escolher vários)"
      >
        <span className={selecionados.length ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)]'}>
          {resumo}
        </span>
        <ChevronDown className="w-4 h-4 shrink-0 text-[var(--color-fg-muted)]" />
      </button>

      {aberto && (
        <div className="absolute right-0 z-50 mt-1 w-56 max-h-72 overflow-auto bg-white border border-[var(--color-border)] rounded-lg shadow-[var(--shadow-lg)] py-1">
          <button
            type="button"
            onClick={() => onChange([])}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--color-surface-2)] ${
              selecionados.length === 0 ? 'font-medium text-[var(--color-accent)]' : 'text-[var(--color-fg)]'
            }`}
          >
            <span className="w-4 h-4 flex items-center justify-center">
              {selecionados.length === 0 && <Check className="w-4 h-4" />}
            </span>
            Todos
          </button>

          <div className="my-1 border-t border-[var(--color-border)]" />

          {meses.length === 0 ? (
            <div className="px-3 py-2 text-sm text-[var(--color-fg-muted)]">Sem meses</div>
          ) : (
            meses.map((m) => {
              const on = selecionados.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggle(m)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]"
                >
                  <span
                    className={`w-4 h-4 flex items-center justify-center rounded border ${
                      on
                        ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white'
                        : 'border-[var(--color-border)]'
                    }`}
                  >
                    {on && <Check className="w-3 h-3" />}
                  </span>
                  {formatLabel(m)}
                </button>
              );
            })
          )}

          {selecionados.length > 0 && (
            <>
              <div className="my-1 border-t border-[var(--color-border)]" />
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full px-3 py-2 text-xs text-left text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
              >
                Limpar seleção
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
