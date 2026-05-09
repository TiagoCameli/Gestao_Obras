// Componente reutilizado em todos os templates de relatório (F4) pra
// reservar slot da seção "Anomalias detectadas". Quando F3 entregar
// a detecção, o mesmo componente passa a renderizar a lista real
// recebendo `anomalias` populado — zero refactor nos templates.
//
// Esta é a versão UI. O equivalente PDF/Excel está embutido nos
// geradores de cada template (mantém o slot reservado lá também).

import { AlertCircle, Sparkles } from 'lucide-react';

interface Anomalia {
  id: string;
  tipo: string;
  severidade: 'baixa' | 'media' | 'alta';
  descricao: string;
  contexto?: string;
}

interface Props {
  anomalias?: Anomalia[];
  /** Quando true (default pré-F3), renderiza placeholder. */
  placeholder?: boolean;
}

export default function AnomaliasSection({ anomalias = [], placeholder = true }: Props) {
  if (placeholder) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-[var(--color-fg-muted)] shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-[var(--color-fg)]">Anomalias detectadas</h4>
            <p className="text-xs text-[var(--color-fg-muted)] italic mt-1">
              Detecção em desenvolvimento — disponível na próxima versão (F3).
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (anomalias.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-5">
        <h4 className="text-sm font-semibold text-[var(--color-fg)]">Anomalias detectadas</h4>
        <p className="text-xs text-[var(--color-fg-muted)] mt-1">
          Nenhuma anomalia identificada no período. ✓
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
      <h4 className="text-sm font-semibold text-amber-900 mb-3 inline-flex items-center gap-2">
        <AlertCircle className="w-4 h-4" />
        Anomalias detectadas ({anomalias.length})
      </h4>
      <ul className="space-y-2 text-xs text-amber-800">
        {anomalias.map((a) => (
          <li key={a.id} className="flex items-start gap-2">
            <span
              className={`shrink-0 mt-0.5 text-[10px] px-1.5 py-0.5 rounded font-bold ${
                a.severidade === 'alta'
                  ? 'bg-red-200 text-red-900'
                  : a.severidade === 'media'
                    ? 'bg-amber-200 text-amber-900'
                    : 'bg-gray-200 text-gray-700'
              }`}
            >
              {a.severidade.toUpperCase()}
            </span>
            <div>
              <span className="font-semibold">{a.tipo}: </span>
              {a.descricao}
              {a.contexto && <span className="text-amber-700"> · {a.contexto}</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
