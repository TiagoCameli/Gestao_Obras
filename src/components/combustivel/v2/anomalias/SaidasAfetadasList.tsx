// SaidasAfetadasList — lista compacta de saídas dentro do AnomaliaDrawer.
// Componente standalone (não reusa SaidaCombustivelList que é tabela full
// e pesada pro espaço lateral do drawer).

import { Pencil, Trash2 } from 'lucide-react';
import type { Equipamento, Fornecedor, Insumo, Obra, SaidaCombustivel } from '../../../../types';
import { fmtDataHora } from '../shared/formatters';

interface Props {
  saidas: SaidaCombustivel[];
  obras: Obra[];
  equipamentos: Equipamento[];
  transportadoras: Fornecedor[];
  combustiveis: Insumo[];
  /** Botão "Editar" — quando undefined, esconde. */
  onEdit?: (s: SaidaCombustivel) => void;
  /** Botão "Excluir" — quando undefined, esconde. Útil pra D4 (duplicatas)
   *  onde o user precisa escolher quais manter. */
  onDelete?: (id: string) => void;
  /** Bloqueia ações enquanto uma mutation está rodando. */
  busy?: boolean;
}

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function SaidasAfetadasList({
  saidas,
  obras,
  equipamentos,
  transportadoras,
  combustiveis,
  onEdit,
  onDelete,
  busy = false,
}: Props) {
  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const eqMap = new Map(equipamentos.map((e) => [e.id, e]));
  const transpMap = new Map(transportadoras.map((t) => [t.id, t.nome]));
  const combMap = new Map(combustiveis.map((c) => [c.id, c.nome]));

  if (saidas.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)]/30 p-3 text-xs text-[var(--color-fg-muted)] italic text-center">
        Nenhuma saída afetada disponível.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {saidas.map((s) => {
        let consumidor: string;
        if (s.tipoConsumidor === 'equipamento_proprio') {
          if (s.equipamentoId === 'desconhecido') {
            consumidor = 'Não identificado';
          } else if (s.equipamentoId) {
            const eq = eqMap.get(s.equipamentoId);
            const codigo = eq?.codigoPatrimonio || eq?.tipo || '';
            consumidor = eq ? (codigo ? `${codigo} · ${eq.nome}` : eq.nome) : s.equipamentoId;
          } else {
            consumidor = '—';
          }
        } else {
          const transp = s.transportadoraId ? (transpMap.get(s.transportadoraId) ?? '') : '';
          consumidor = `${s.placa ?? '—'}${transp ? ` · ${transp}` : ''}`;
        }
        const obra = s.obraId ? (obrasMap.get(s.obraId) ?? '—') : '—';
        const combustivel = combMap.get(s.tipoCombustivel) ?? s.tipoCombustivel;

        return (
          <li
            key={s.id}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3 text-xs"
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[10px] text-[var(--color-fg-subtle)] tabular-nums">
                  {fmtDataHora(s.data)}
                </div>
                <div className="font-medium text-[var(--color-fg)] truncate mt-0.5">{consumidor}</div>
              </div>
              {(onEdit || onDelete) && (
                <div className="flex gap-1 shrink-0">
                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(s)}
                      disabled={busy}
                      className="p-1.5 rounded text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)] disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Editar saída"
                      aria-label="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(s.id)}
                      disabled={busy}
                      className="p-1.5 rounded text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Excluir saída"
                      aria-label="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[var(--color-fg-muted)]">
              <div>
                <span className="opacity-60">Obra:</span> <span className="text-[var(--color-fg)]">{obra}</span>
              </div>
              <div>
                <span className="opacity-60">Combustível:</span> <span className="text-[var(--color-fg)]">{combustivel}</span>
              </div>
              <div>
                <span className="opacity-60">Litros:</span>{' '}
                <span className="text-[var(--color-fg)] font-mono tabular-nums">
                  {s.litros.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L
                </span>
              </div>
              <div>
                <span className="opacity-60">Valor:</span>{' '}
                <span className="text-[var(--color-fg)] font-mono tabular-nums font-semibold">{fmtBRL(s.valorTotal)}</span>
              </div>
            </div>
            {s.observacoes && (
              <div className="mt-1.5 text-[10px] text-[var(--color-fg-subtle)] italic line-clamp-2">
                {s.observacoes}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
