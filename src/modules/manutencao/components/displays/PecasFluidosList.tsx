import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import type {
  PecaConsumo,
  FluidoConsumo,
  Peca,
  Fluido,
  FluidoRecomendado,
} from '../../types';

export interface PecasFluidosListProps {
  pecas: PecaConsumo[];
  /**
   * Em mode='tarefa' (default): FluidoConsumo[] (com quantityLiters).
   * Em mode='modelo': FluidoRecomendado[] (com system, sem quantidade).
   */
  fluidos: FluidoConsumo[] | FluidoRecomendado[];
  pecasCatalog: Peca[];
  fluidosCatalog: Fluido[];
  mostrarCustoEstimado?: boolean;
  /**
   * 'tarefa' (default): mostra coluna "L" com quantityLiters consumido.
   * 'modelo': mostra coluna "Sistema" com o system do FluidoRecomendado.
   */
  mode?: 'tarefa' | 'modelo';
  className?: string;
}

const SISTEMA_LABEL: Record<FluidoRecomendado['system'], string> = {
  motor: 'Motor',
  hidraulico: 'Hidráulico',
  transmissao: 'Transmissão',
  swing_drive: 'Swing drive',
  comando_final: 'Comando final',
  arrefecimento: 'Arrefecimento',
  graxa_geral: 'Graxa geral',
  eixo_dianteiro: 'Eixo dianteiro',
  eixo_traseiro: 'Eixo traseiro',
};

function formatarBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function PecasFluidosList({
  pecas,
  fluidos,
  pecasCatalog,
  fluidosCatalog,
  mostrarCustoEstimado = false,
  mode = 'tarefa',
  className = '',
}: PecasFluidosListProps) {
  const pecaPorPN = useMemo(() => {
    const m = new Map<string, Peca>();
    pecasCatalog.forEach((p) => m.set(p.partNumber, p));
    return m;
  }, [pecasCatalog]);

  const fluidoPorId = useMemo(() => {
    const m = new Map<string, Fluido>();
    fluidosCatalog.forEach((f) => m.set(f.id, f));
    return m;
  }, [fluidosCatalog]);

  const totalPecas = useMemo(
    () =>
      pecas.reduce((acc, p) => {
        const cat = pecaPorPN.get(p.partNumber);
        if (cat?.custoMedioBrl) return acc + cat.custoMedioBrl * p.quantity;
        return acc;
      }, 0),
    [pecas, pecaPorPN]
  );

  const totalFluidos = useMemo(() => {
    if (mode !== 'tarefa') return 0;
    return (fluidos as FluidoConsumo[]).reduce((acc, f) => {
      const cat = fluidoPorId.get(f.fluidoId);
      if (cat?.custoMedioLitroBrl) return acc + cat.custoMedioLitroBrl * f.quantityLiters;
      return acc;
    }, 0);
  }, [fluidos, fluidoPorId, mode]);

  return (
    <div className={'grid gap-4 grid-cols-1 lg:grid-cols-2 ' + className}>
      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide mb-2 text-[var(--color-fg-muted)]">
          Peças
        </h4>
        {pecas.length === 0 ? (
          <p className="text-sm italic text-[var(--color-fg-subtle)]">Nenhuma peça.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Part #</th>
                  <th className="text-right font-medium px-3 py-2">Qtd</th>
                  <th className="text-left font-medium px-3 py-2">Descrição</th>
                  <th className="text-right font-medium px-3 py-2">Custo unit. (R$)</th>
                </tr>
              </thead>
              <tbody>
                {pecas.map((p, i) => {
                  const cat = pecaPorPN.get(p.partNumber);
                  const semCatalogo = !cat;
                  return (
                    <tr
                      key={p.partNumber + i}
                      className={
                        i % 2 === 0
                          ? 'bg-[var(--color-surface-1)]'
                          : 'bg-[var(--color-surface-2)]/50'
                      }
                    >
                      <td className="px-3 py-2 font-mono text-[var(--color-fg)]">
                        <span className="inline-flex items-center gap-1.5">
                          {p.partNumber}
                          {semCatalogo && (
                            <AlertTriangle
                              aria-label="Peça não cadastrada no catálogo"
                              className="w-3.5 h-3.5 text-[var(--color-warning-fg)]"
                            >
                              <title>Peça não cadastrada no catálogo</title>
                            </AlertTriangle>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-[var(--color-fg)]">
                        {p.quantity}
                      </td>
                      <td className="px-3 py-2 text-[var(--color-fg-muted)]">
                        {cat?.description ?? (
                          <span className="italic text-[var(--color-fg-subtle)]">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-[var(--color-fg-muted)]">
                        {cat?.custoMedioBrl ? formatarBRL(cat.custoMedioBrl) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide mb-2 text-[var(--color-fg-muted)]">
          Fluidos
        </h4>
        {fluidos.length === 0 ? (
          <p className="text-sm italic text-[var(--color-fg-subtle)]">Nenhum fluido.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Fluido</th>
                  {mode === 'tarefa' ? (
                    <th className="text-right font-medium px-3 py-2">L</th>
                  ) : (
                    <th className="text-left font-medium px-3 py-2">Sistema</th>
                  )}
                  <th className="text-left font-medium px-3 py-2">Viscosidade</th>
                </tr>
              </thead>
              <tbody>
                {fluidos.map((f, i) => {
                  const cat = fluidoPorId.get(f.fluidoId);
                  const nome = cat?.catProductName ?? cat?.description ?? null;
                  return (
                    <tr
                      key={f.fluidoId + i}
                      className={
                        i % 2 === 0
                          ? 'bg-[var(--color-surface-1)]'
                          : 'bg-[var(--color-surface-2)]/50'
                      }
                    >
                      <td className="px-3 py-2 text-[var(--color-fg)]">
                        {nome ? (
                          nome
                        ) : (
                          <span className="inline-flex items-center gap-1.5 font-mono text-[var(--color-fg-muted)]">
                            {f.fluidoId}
                            <AlertTriangle
                              aria-label="Fluido não cadastrado no catálogo"
                              className="w-3.5 h-3.5 text-[var(--color-warning-fg)]"
                            >
                              <title>Fluido não cadastrado no catálogo</title>
                            </AlertTriangle>
                          </span>
                        )}
                      </td>
                      {mode === 'tarefa' ? (
                        <td className="px-3 py-2 text-right font-mono text-[var(--color-fg)]">
                          {(f as FluidoConsumo).quantityLiters}
                        </td>
                      ) : (
                        <td className="px-3 py-2 text-[var(--color-fg-muted)]">
                          {SISTEMA_LABEL[(f as FluidoRecomendado).system] ??
                            (f as FluidoRecomendado).system}
                        </td>
                      )}
                      <td className="px-3 py-2 text-[var(--color-fg-muted)]">
                        {cat?.viscosity ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {mostrarCustoEstimado && (totalPecas > 0 || totalFluidos > 0) && (
        <div className="lg:col-span-2 mt-1 px-3 py-2 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm flex flex-wrap items-center justify-between gap-2">
          <span className="text-[var(--color-fg-muted)]">Custo estimado:</span>
          <span className="font-semibold text-[var(--color-fg)]">
            {formatarBRL(totalPecas + totalFluidos)}
            <span className="text-xs font-normal text-[var(--color-fg-subtle)] ml-2">
              (peças {formatarBRL(totalPecas)} + fluidos {formatarBRL(totalFluidos)})
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

export default PecasFluidosList;
