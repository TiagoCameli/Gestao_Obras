/**
 * CompraDetalheDrawer — Drawer único para mostrar detalhes de
 * Pedido, Cotação ou Ordem de Compra ao clicar em uma linha das listas.
 *
 * Renderização condicional pelo prop `tipo`. Cabeçalho mostra número/status/data,
 * corpo lista itens, footer expõe ações relevantes (Editar, Aprovar, etc.).
 */
import type {
  Cotacao,
  Fornecedor,
  Obra,
  OrdemCompra,
  PedidoCompra,
} from '../../types';
import Drawer from '../ui/Drawer';
import Button from '../ui/Button';
import BadgeStatusCompra from './BadgeStatusCompra';
import { formatCurrency, formatDate } from '../../utils/formatters';

type DetalheData =
  | { tipo: 'pedido'; pedido: PedidoCompra }
  | { tipo: 'cotacao'; cotacao: Cotacao }
  | { tipo: 'oc'; oc: OrdemCompra };

interface Props {
  open: boolean;
  onClose: () => void;
  data: DetalheData | null;
  /** Mapas auxiliares para resolver IDs em labels. */
  obras: Obra[];
  fornecedores: Fornecedor[];
  /** Ações disponíveis no footer (cada uma é opcional; só aparece se passada). */
  onEditar?: () => void;
  onAprovar?: () => void;
  onReprovar?: () => void;
  /** Reabre / volta para status anterior (Pedido aprovado → pendente; Cotação cotada → em_cotacao). */
  onReabrir?: () => void;
  onEnviarCotacao?: () => void;
  onGerarOC?: () => void;
  onGerarLancamento?: () => void;
}

export default function CompraDetalheDrawer({
  open,
  onClose,
  data,
  obras,
  fornecedores,
  onEditar,
  onAprovar,
  onReprovar,
  onReabrir,
  onEnviarCotacao,
  onGerarOC,
  onGerarLancamento,
}: Props) {
  if (!data) {
    return (
      <Drawer open={open} onClose={onClose} title="Detalhes">
        <p className="text-sm text-[var(--color-fg-muted)]">Nada selecionado.</p>
      </Drawer>
    );
  }

  // ─────────── helpers
  const obraNome = (id: string) =>
    obras.find((o) => o.id === id)?.nome || (id ? '—' : '');
  const fornecedorNome = (id: string) =>
    fornecedores.find((f) => f.id === id)?.nome || (id ? '—' : '');

  // ─────────── PEDIDO
  if (data.tipo === 'pedido') {
    const p = data.pedido;
    return (
      <Drawer
        open={open}
        onClose={onClose}
        title={`Pedido ${p.numero}`}
        subtitle={`Solicitado por ${p.solicitante} · ${formatDate(p.data)}`}
        width="lg"
        footer={
          <div className="flex flex-wrap gap-2 justify-end">
            {onEditar && (
              <Button type="button" variant="secondary" onClick={onEditar}>
                Editar
              </Button>
            )}
            {onReprovar && p.status === 'pendente' && (
              <Button type="button" variant="secondary" onClick={onReprovar}>
                Reprovar
              </Button>
            )}
            {onAprovar && p.status === 'pendente' && (
              <Button type="button" onClick={onAprovar}>
                Aprovar
              </Button>
            )}
            {onReabrir && p.status === 'aprovado' && (
              <Button type="button" variant="secondary" onClick={onReabrir}>
                ↩ Voltar pra pendente
              </Button>
            )}
            {onEnviarCotacao && p.status === 'aprovado' && (
              <Button type="button" onClick={onEnviarCotacao}>
                Gerar cotação
              </Button>
            )}
            {onGerarOC && p.status === 'aprovado' && (
              <Button type="button" variant="secondary" onClick={onGerarOC}>
                Gerar OC direto
              </Button>
            )}
          </div>
        }
      >
        <section className="space-y-5">
          <BlocoInfo>
            <Linha label="Status"><BadgeStatusCompra status={p.status} /></Linha>
            <Linha label="Obra">{obraNome(p.obraId) || '—'}</Linha>
            <Linha label="Urgência" className="capitalize">{p.urgencia}</Linha>
            {p.valorEstimado != null && (
              <Linha label="Valor estimado">{formatCurrency(p.valorEstimado)}</Linha>
            )}
            {p.aprovadoPor && (
              <Linha label="Aprovado por">{p.aprovadoPor} · {p.aprovadoEm && formatDate(p.aprovadoEm)}</Linha>
            )}
            {p.reprovadoPor && (
              <>
                <Linha label="Reprovado por">{p.reprovadoPor} · {p.reprovadoEm && formatDate(p.reprovadoEm)}</Linha>
                {p.motivoReprovacao && (
                  <Linha label="Motivo">{p.motivoReprovacao}</Linha>
                )}
              </>
            )}
          </BlocoInfo>

          {p.descricaoLivre && (
            <BlocoInfo titulo="Descrição livre">
              <p className="text-sm text-[var(--color-fg)] whitespace-pre-line">{p.descricaoLivre}</p>
            </BlocoInfo>
          )}

          {p.itens.length > 0 && (
            <BlocoInfo titulo={`Itens (${p.itens.length})`}>
              <table className="w-full text-sm">
                <thead className="text-[10.5px] uppercase tracking-wide text-[var(--color-fg-muted)]">
                  <tr>
                    <th className="text-left py-1.5 font-medium">Descrição</th>
                    <th className="text-right py-1.5 font-medium w-16">Qtd</th>
                    <th className="text-left py-1.5 font-medium w-16">Un</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {p.itens.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2 text-[var(--color-fg)]">{it.descricao}</td>
                      <td className="py-2 text-right text-[var(--color-fg)]">{it.quantidade}</td>
                      <td className="py-2 text-[var(--color-fg-muted)] uppercase text-xs">{it.unidade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </BlocoInfo>
          )}

          {p.observacoes && (
            <BlocoInfo titulo="Observações internas">
              <p className="text-sm text-[var(--color-fg)] whitespace-pre-line">{p.observacoes}</p>
            </BlocoInfo>
          )}
        </section>
      </Drawer>
    );
  }

  // ─────────── COTAÇÃO
  if (data.tipo === 'cotacao') {
    const c = data.cotacao;
    const vencedor = c.fornecedores.find((cf) => cf.vencedor);
    return (
      <Drawer
        open={open}
        onClose={onClose}
        title={`Cotação ${c.numero}`}
        subtitle={c.descricao || c.descricaoLivre || 'Sem descrição'}
        width="lg"
        footer={
          <div className="flex flex-wrap gap-2 justify-end">
            {onEditar && (
              <Button type="button" variant="secondary" onClick={onEditar}>
                Editar / Mapa comparativo
              </Button>
            )}
            {onReabrir && (c.status === 'cotado' || c.status === 'parcial') && (
              <Button type="button" variant="secondary" onClick={onReabrir}>
                ↩ Reabrir cotação
              </Button>
            )}
            {onEnviarCotacao && (
              <Button type="button" onClick={onEnviarCotacao}>
                Enviar para fornecedores
              </Button>
            )}
          </div>
        }
      >
        <section className="space-y-5">
          <BlocoInfo>
            <Linha label="Status"><BadgeStatusCompra status={c.status} /></Linha>
            <Linha label="Data">{formatDate(c.data)}</Linha>
            {c.prazoResposta && (
              <Linha label="Prazo de resposta">{formatDate(c.prazoResposta)}</Linha>
            )}
            <Linha label="Fornecedores cotando">
              {c.fornecedores.length === 0
                ? <span className="italic text-[var(--color-fg-muted)]">nenhum</span>
                : `${c.fornecedores.length} fornecedor${c.fornecedores.length === 1 ? '' : 'es'}`}
            </Linha>
            {vencedor && (
              <Linha label="Vencedor">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                  🏆 {fornecedorNome(vencedor.fornecedorId)}
                </span>
              </Linha>
            )}
          </BlocoInfo>

          {c.descricaoLivre && (
            <BlocoInfo titulo="Contexto do pedido">
              <p className="text-sm text-[var(--color-fg)] whitespace-pre-line">{c.descricaoLivre}</p>
            </BlocoInfo>
          )}

          {c.fornecedores.length > 0 && (
            <BlocoInfo titulo="Mapa comparativo (resumo)">
              <table className="w-full text-sm">
                <thead className="text-[10.5px] uppercase tracking-wide text-[var(--color-fg-muted)]">
                  <tr>
                    <th className="text-left py-1.5 font-medium">Fornecedor</th>
                    <th className="text-right py-1.5 font-medium">Total</th>
                    <th className="text-left py-1.5 font-medium w-24">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {c.fornecedores.map((cf) => (
                    <tr key={cf.id} className={cf.vencedor ? 'bg-emerald-50/30 dark:bg-emerald-950/10' : ''}>
                      <td className="py-2 text-[var(--color-fg)]">
                        {fornecedorNome(cf.fornecedorId)}
                        {cf.vencedor && <span className="ml-1 text-[10px]">🏆</span>}
                      </td>
                      <td className="py-2 text-right text-[var(--color-fg)]">
                        {cf.total > 0 ? formatCurrency(cf.total) : <span className="text-[var(--color-fg-subtle)]">—</span>}
                      </td>
                      <td className="py-2 text-xs text-[var(--color-fg-muted)]">
                        {cf.respondido ? '✓ respondeu' : 'aguardando'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </BlocoInfo>
          )}

          {c.itensPedido.length > 0 && (
            <BlocoInfo titulo={`Itens cotados (${c.itensPedido.length})`}>
              <table className="w-full text-sm">
                <thead className="text-[10.5px] uppercase tracking-wide text-[var(--color-fg-muted)]">
                  <tr>
                    <th className="text-left py-1.5 font-medium">Descrição</th>
                    <th className="text-right py-1.5 font-medium w-16">Qtd</th>
                    <th className="text-left py-1.5 font-medium w-16">Un</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {c.itensPedido.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2 text-[var(--color-fg)]">{it.descricao}</td>
                      <td className="py-2 text-right text-[var(--color-fg)]">{it.quantidade}</td>
                      <td className="py-2 text-[var(--color-fg-muted)] uppercase text-xs">{it.unidade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </BlocoInfo>
          )}

          {c.observacoes && (
            <BlocoInfo titulo="Observações">
              <p className="text-sm text-[var(--color-fg)] whitespace-pre-line">{c.observacoes}</p>
            </BlocoInfo>
          )}
        </section>
      </Drawer>
    );
  }

  // ─────────── ORDEM DE COMPRA
  const oc = data.oc;
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`OC ${oc.numero}`}
      subtitle={`${fornecedorNome(oc.fornecedorId)} · ${formatCurrency(oc.totalGeral)}`}
      width="lg"
      footer={
        <div className="flex flex-wrap gap-2 justify-end">
          {onEditar && (
            <Button type="button" variant="secondary" onClick={onEditar}>
              Editar
            </Button>
          )}
          {onAprovar && oc.status === 'emitida' && (
            <Button type="button" onClick={onAprovar}>
              Aprovar OC
            </Button>
          )}
          {onGerarLancamento && oc.status === 'aprovada' && (
            <Button type="button" onClick={onGerarLancamento}>
              Gerar lançamento financeiro
            </Button>
          )}
        </div>
      }
    >
      <section className="space-y-5">
        <BlocoInfo>
          <Linha label="Status"><BadgeStatusCompra status={oc.status} /></Linha>
          <Linha label="Fornecedor">{fornecedorNome(oc.fornecedorId)}</Linha>
          <Linha label="Data de criação">{formatDate(oc.dataCriacao)}</Linha>
          {oc.dataEntrega && (
            <Linha label="Data de entrega">{formatDate(oc.dataEntrega)}</Linha>
          )}
          {oc.empresaFaturamento && (
            <Linha label="Faturar para">{oc.empresaFaturamento}</Linha>
          )}
          {oc.condicaoPagamento && (
            <Linha label="Condição de pagamento">{oc.condicaoPagamento}</Linha>
          )}
          {oc.formaPagamento && (
            <Linha label="Forma de pagamento">{oc.formaPagamento}</Linha>
          )}
          {oc.prazoEntrega && (
            <Linha label="Prazo de entrega">{oc.prazoEntrega}</Linha>
          )}
        </BlocoInfo>

        <BlocoInfo titulo="Valores">
          <Linha label="Materiais">{formatCurrency(oc.totalMateriais)}</Linha>
          {oc.custosAdicionais && (
            <>
              {oc.custosAdicionais.frete > 0 && <Linha label="Frete">{formatCurrency(oc.custosAdicionais.frete)}</Linha>}
              {oc.custosAdicionais.impostos > 0 && <Linha label="Impostos">{formatCurrency(oc.custosAdicionais.impostos)}</Linha>}
              {oc.custosAdicionais.desconto > 0 && <Linha label="Desconto">- {formatCurrency(oc.custosAdicionais.desconto)}</Linha>}
            </>
          )}
          <Linha label="Total geral">
            <strong className="text-[var(--color-fg)]">{formatCurrency(oc.totalGeral)}</strong>
          </Linha>
        </BlocoInfo>

        {oc.itens.length > 0 && (
          <BlocoInfo titulo={`Itens (${oc.itens.length})`}>
            <table className="w-full text-sm">
              <thead className="text-[10.5px] uppercase tracking-wide text-[var(--color-fg-muted)]">
                <tr>
                  <th className="text-left py-1.5 font-medium">Descrição</th>
                  <th className="text-right py-1.5 font-medium w-16">Qtd</th>
                  <th className="text-left py-1.5 font-medium w-16">Un</th>
                  <th className="text-right py-1.5 font-medium w-24">Preço un</th>
                  <th className="text-right py-1.5 font-medium w-24">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {oc.itens.map((it) => (
                  <tr key={it.id}>
                    <td className="py-2 text-[var(--color-fg)]">{it.descricao}</td>
                    <td className="py-2 text-right text-[var(--color-fg)]">{it.quantidade}</td>
                    <td className="py-2 text-[var(--color-fg-muted)] uppercase text-xs">{it.unidade}</td>
                    <td className="py-2 text-right text-[var(--color-fg-muted)]">{formatCurrency(it.precoUnitario)}</td>
                    <td className="py-2 text-right text-[var(--color-fg)] font-medium">{formatCurrency(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </BlocoInfo>
        )}

        {oc.parcelas && oc.parcelas.length > 0 && (
          <BlocoInfo titulo={`Parcelas (${oc.parcelas.length})`}>
            <ul className="text-sm space-y-1">
              {oc.parcelas.map((par, i) => (
                <li key={i} className="flex items-center justify-between">
                  <span className="text-[var(--color-fg-muted)]">
                    {par.numero || i + 1}ª · venc. {formatDate(par.data)}
                  </span>
                  <span className="text-[var(--color-fg)] font-medium">{formatCurrency(par.valor)}</span>
                </li>
              ))}
            </ul>
          </BlocoInfo>
        )}

        {oc.observacoes && (
          <BlocoInfo titulo="Observações">
            <p className="text-sm text-[var(--color-fg)] whitespace-pre-line">{oc.observacoes}</p>
          </BlocoInfo>
        )}
      </section>
    </Drawer>
  );
}

// ─────────────────────────── auxiliares ──────────────────────────────────

function BlocoInfo({ titulo, children }: { titulo?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-4">
      {titulo && (
        <div className="text-[10.5px] uppercase tracking-[0.06em] font-semibold text-[var(--color-fg-muted)] mb-3">
          {titulo}
        </div>
      )}
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Linha({
  label,
  children,
  className,
}: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-[var(--color-fg-muted)] shrink-0">{label}</span>
      <span className={`text-right text-[var(--color-fg)] ${className ?? ''}`}>{children}</span>
    </div>
  );
}
