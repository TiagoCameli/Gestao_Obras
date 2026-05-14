// Marco 4 / PR18 — Modal de detalhe de uma peça.
//
// Mostra dados cadastrais + saldo por depósito + última movimentação.
// Botão "Editar" abre o PecaFormModal no mesmo registro.

import { Pencil, Package, MapPin, Factory, Wrench, FileInput } from 'lucide-react';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import { useSaldoEstoqueTotal, useSaldoEstoquePorDeposito } from '../../../hooks/useSaldoEstoque';
import { useInsumos } from '../../../hooks/useInsumos';
import { useAuth } from '../../../contexts/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
  insumoId: string;
  onEditar?: () => void;
  onRegistrarEntrada?: () => void;
}

function fmtBRL(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtQty(n: number, unidade: string): string {
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${unidade}`;
}

export default function PecaDetalheModal({ open, onClose, insumoId, onEditar, onRegistrarEntrada }: Props) {
  const { temAcao } = useAuth();
  const canEdit = temAcao('editar_peca_almoxarifado');
  const { data: saldos = [] } = useSaldoEstoqueTotal({ apenasManutencao: true });
  const { data: insumos = [] } = useInsumos();
  const { data: porDeposito = [], isLoading: loadingDep } = useSaldoEstoquePorDeposito(insumoId);

  const saldo = saldos.find((s) => s.insumoId === insumoId);
  const insumo = insumos.find((i) => i.id === insumoId);

  if (!saldo || !insumo) {
    return (
      <Modal open={open} onClose={onClose} title="Peça">
        <p className="text-sm text-[var(--color-fg-muted)] py-6 text-center">
          Peça não encontrada.
        </p>
      </Modal>
    );
  }

  const valorTotal = saldo.custoMedio != null && saldo.saldoTotal > 0
    ? saldo.custoMedio * saldo.saldoTotal
    : null;

  return (
    <Modal open={open} onClose={onClose} title={saldo.insumoNome} size="lg">
      <div className="space-y-5">
        {/* Header com identificação */}
        <div className="flex items-start gap-3">
          <div className="w-14 h-14 rounded-xl bg-[var(--color-info-soft)] text-[var(--color-info-fg)] flex items-center justify-center shrink-0">
            {saldo.fotoUrl ? (
              <img src={saldo.fotoUrl} alt={saldo.insumoNome} className="w-14 h-14 rounded-xl object-cover" />
            ) : (
              <Package className="w-7 h-7" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {saldo.codigoSku && (
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]">
                  SKU {saldo.codigoSku}
                </span>
              )}
              {saldo.codigoEan && (
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]">
                  EAN {saldo.codigoEan}
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--color-fg-muted)] mt-1">
              {saldo.fabricante && (
                <span className="inline-flex items-center gap-1 mr-3">
                  <Factory className="w-3.5 h-3.5" /> {saldo.fabricante}
                  {saldo.codigoFabricante && ` · ${saldo.codigoFabricante}`}
                </span>
              )}
              {insumo.aplicacaoTecnica && (
                <span className="text-[var(--color-fg-subtle)]">{insumo.aplicacaoTecnica}</span>
              )}
            </p>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              {onRegistrarEntrada && (
                <Button size="sm" onClick={onRegistrarEntrada}>
                  <FileInput className="w-3.5 h-3.5" /> Nova entrada
                </Button>
              )}
              {onEditar && (
                <Button variant="secondary" size="sm" onClick={onEditar}>
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </Button>
              )}
            </div>
          )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3">
            <div className="text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)]">Saldo total</div>
            <div className="text-lg font-semibold text-[var(--color-fg)]">
              {fmtQty(saldo.saldoTotal, saldo.unidade)}
            </div>
            {saldo.estoqueMinimo != null && (
              <div className="text-[11px] text-[var(--color-fg-subtle)]">
                Mínimo: {fmtQty(saldo.estoqueMinimo, saldo.unidade)}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3">
            <div className="text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)]">Custo médio</div>
            <div className="text-lg font-mono font-semibold text-[var(--color-fg)]">
              {fmtBRL(saldo.custoMedio)}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3">
            <div className="text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)]">Valor em estoque</div>
            <div className="text-lg font-mono font-semibold text-[var(--color-fg)]">
              {fmtBRL(valorTotal)}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3">
            <div className="text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)]">Lead time</div>
            <div className="text-lg font-semibold text-[var(--color-fg)]">
              {insumo.leadTimeDias != null ? `${insumo.leadTimeDias} dias` : '—'}
            </div>
          </div>
        </div>

        {/* Saldo por depósito */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> Saldo por depósito
          </h3>
          {loadingDep ? (
            <p className="text-sm text-[var(--color-fg-muted)] py-4 text-center">Carregando…</p>
          ) : porDeposito.length === 0 ? (
            <p className="text-xs text-[var(--color-fg-muted)] py-3 text-center">
              Sem depósitos cadastrados ou sem saldo nesta peça.
            </p>
          ) : (
            <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] text-xs uppercase">
                  <tr>
                    <th className="text-left px-3 py-2">Depósito</th>
                    <th className="text-right px-3 py-2">Saldo</th>
                    <th className="text-right px-3 py-2">Custo médio</th>
                    <th className="text-right px-3 py-2">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {porDeposito.map((d) => (
                    <tr key={d.depositoId} className="border-t border-[var(--color-border)]">
                      <td className="px-3 py-2 text-[var(--color-fg)]">{d.depositoNome}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmtQty(d.saldo, d.unidade)}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmtBRL(d.custoMedio)}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {d.custoMedio != null && d.saldo > 0
                          ? fmtBRL(d.custoMedio * d.saldo)
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Compatibilidade */}
        {(saldo.equipamentosCompativeis ?? []).length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5" /> Compatível com
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {saldo.equipamentosCompativeis.map((e) => (
                <span
                  key={e}
                  className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-surface-2)] text-[var(--color-fg)] border border-[var(--color-border)]"
                >
                  {e}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}
