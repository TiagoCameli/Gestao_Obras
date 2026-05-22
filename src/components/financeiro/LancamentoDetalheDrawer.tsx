/**
 * LancamentoDetalheDrawer — Drawer lateral com todos os detalhes de um
 * lançamento financeiro. Substitui o expand inline da lista.
 *
 * Mostra: header (fornecedor, empresa, categoria, vencimento, valor,
 * status), parcelas (com ação Pagar/Estornar), rateio com obra/etapa/OS,
 * anexos clicáveis, observações. Footer condicional com Editar/Fechar/
 * Reabrir/Excluir conforme status + permissões.
 */
import { useState } from 'react';
import {
  Banknote, Lock, Unlock, Pencil, Trash2, RotateCcw, FileText, ExternalLink,
  Calendar, Building2, Wrench, Briefcase, Warehouse, Fuel,
  Paperclip, Loader2, X, Image as ImageIcon,
} from 'lucide-react';
import type {
  LancamentoFinanceiro,
  ParcelaLancamento,
  Fornecedor,
  Empresa,
  CategoriaFinanceira,
  Obra,
  EtapaObra,
  OrdemServico,
  Equipamento,
} from '../../types';
import Drawer from '../ui/Drawer';
import Button from '../ui/Button';
import RegistrarPagamentoModal from './RegistrarPagamentoModal';
import { useEstornarPagamentoFinanceiro } from '../../hooks/usePagamentosFinanceiros';
import { useAtualizarAnexosLancamento } from '../../hooks/useLancamentosFinanceiros';
import { supabase } from '../../lib/supabase';
import { useAnexosFinanceiroUrls } from '../../hooks/useFinanceiroAnexos';
import { dbToPagamentoLancamento } from '../../lib/mappers';
import { useToast } from '../ui/Toast';

interface Props {
  open: boolean;
  onClose: () => void;
  lancamento: LancamentoFinanceiro | null;
  fornecedores: Fornecedor[];
  empresas: Empresa[];
  categorias: CategoriaFinanceira[];
  obras: Obra[];
  etapas: EtapaObra[];
  ordensServico: OrdemServico[];
  equipamentos: Equipamento[];
  /** Ações condicionais — pai controla permissão/visibilidade. */
  onEditar?: () => void;
  onFechar?: () => void;
  onReabrir?: () => void;
  onExcluir?: () => void;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  em_aberto:    { label: 'Em aberto',    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200' },
  pago_parcial: { label: 'Pago parcial', cls: 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200' },
  pago:         { label: 'Pago',         cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' },
  cancelado:    { label: 'Cancelado',    cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
};

const TIPO_DESTINO_LABEL: Record<string, { label: string; Icon: typeof Building2 }> = {
  obra_etapa:             { label: 'Obra/Etapa',          Icon: Building2 },
  obra_deposito:          { label: 'Obra (depósito)',     Icon: Warehouse },
  deposito_central:       { label: 'Depósito central',    Icon: Warehouse },
  sede:                   { label: 'Sede',                Icon: Briefcase },
  manutencao_equipamento: { label: 'Manutenção (OS)',     Icon: Wrench },
  tanque_combustivel:     { label: 'Tanque combustível',  Icon: Fuel },
};

function fmtMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtData(s?: string): string {
  if (!s) return '—';
  try { return new Date(s + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return s; }
}
function fmtDataHora(s?: string): string {
  if (!s) return '—';
  try { return new Date(s).toLocaleString('pt-BR'); }
  catch { return s; }
}

export default function LancamentoDetalheDrawer({
  open, onClose, lancamento, fornecedores, empresas, categorias,
  obras, etapas, ordensServico, equipamentos,
  onEditar, onFechar, onReabrir, onExcluir,
}: Props) {
  const { showToast } = useToast();
  const estornarMut = useEstornarPagamentoFinanceiro();
  const atualizarAnexosMut = useAtualizarAnexosLancamento();
  const [pagarParcela, setPagarParcela] = useState<ParcelaLancamento | null>(null);
  const [uploadingAnexo, setUploadingAnexo] = useState(false);
  const signedAnexosUrls = useAnexosFinanceiroUrls(lancamento?.anexosUrls);

  if (!lancamento) {
    return (
      <Drawer open={open} onClose={onClose} title="Lançamento financeiro" width="lg">
        <p className="text-sm text-[var(--color-fg-muted)]">Nenhum lançamento selecionado.</p>
      </Drawer>
    );
  }

  const l = lancamento;
  const fornecedor = l.fornecedorId ? fornecedores.find((f) => f.id === l.fornecedorId) : undefined;
  const empresa = l.empresaPagadoraId ? empresas.find((e) => e.id === l.empresaPagadoraId) : undefined;
  const categoria = l.categoriaId ? categorias.find((c) => c.id === l.categoriaId) : undefined;
  const totalPago = l.parcelas.reduce((s, p) => s + (p.valorPago ?? 0), 0);
  const totalAberto = l.valorTotal - totalPago;

  async function handleEstornar(p: ParcelaLancamento) {
    if (!l) return;
    if (!window.confirm(`Estornar pagamento da parcela ${p.numero}/${l.parcelas.length}? A parcela volta pra "em aberto".`)) return;
    try {
      const { data, error } = await supabase
        .from('financeiro_pagamentos')
        .select('*')
        .eq('parcela_id', p.id)
        .order('data_pagamento', { ascending: false })
        .limit(1);
      if (error) throw error;
      if (!data?.[0]) {
        showToast({ kind: 'error', message: 'Pagamento não encontrado pra estornar.' });
        return;
      }
      const pag = dbToPagamentoLancamento(data[0]);
      await estornarMut.mutateAsync({ pagamento: pag, parcela: p, lancamento: l });
      showToast({ kind: 'success', message: `Pagamento estornado.` });
    } catch (err) {
      showToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Erro ao estornar.',
      });
    }
  }

  // ── Upload de anexo direto no drawer ────────────────────────────────
  async function handleAddAnexo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !l) return;
    setUploadingAnexo(true);
    try {
      const ext = file.name.split('.').pop() ?? 'bin';
      const path = `${l.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from('financeiro-anexos')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const novosAnexos = [...(l.anexosUrls ?? []), path];
      await atualizarAnexosMut.mutateAsync({ id: l.id, anexosUrls: novosAnexos });
      showToast({ kind: 'success', message: `Anexo "${file.name}" adicionado.` });
    } catch (err) {
      showToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Falha ao enviar anexo.',
      });
    } finally {
      setUploadingAnexo(false);
      e.target.value = '';
    }
  }

  async function handleRemoveAnexo(url: string) {
    if (!l) return;
    if (!window.confirm('Remover este anexo do lançamento? O arquivo continua no Storage; só o vínculo é removido.')) return;
    try {
      const novosAnexos = (l.anexosUrls ?? []).filter((u) => u !== url);
      await atualizarAnexosMut.mutateAsync({ id: l.id, anexosUrls: novosAnexos });
      showToast({ kind: 'success', message: 'Anexo removido.' });
    } catch (err) {
      showToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Falha ao remover anexo.',
      });
    }
  }

  function ehImagem(url: string): boolean {
    return /\.(jpe?g|png|webp|gif|svg)$/i.test(url);
  }

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title={`Lançamento ${l.numero}`}
        subtitle={
          `${fornecedor?.nome ?? l.favorecidoNome ?? '—'}` +
          (empresa ? ` · ${empresa.nome}` : '') +
          ` · ${fmtMoeda(l.valorTotal)}`
        }
        width="lg"
        footer={
          <div className="flex flex-wrap gap-2 justify-end">
            {onEditar && !l.fechado && (
              <Button type="button" variant="secondary" onClick={onEditar}>
                <span className="inline-flex items-center gap-1.5">
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </span>
              </Button>
            )}
            {onFechar && !l.fechado && (
              <Button type="button" variant="secondary" onClick={onFechar}>
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> Fechar
                </span>
              </Button>
            )}
            {onReabrir && l.fechado && (
              <Button type="button" variant="secondary" onClick={onReabrir}>
                <span className="inline-flex items-center gap-1.5">
                  <Unlock className="w-3.5 h-3.5" /> Reabrir
                </span>
              </Button>
            )}
            {onExcluir && !l.fechado && (
              <Button type="button" variant="secondary" onClick={onExcluir}>
                <span className="inline-flex items-center gap-1.5 text-rose-600">
                  <Trash2 className="w-3.5 h-3.5" /> Excluir
                </span>
              </Button>
            )}
          </div>
        }
      >
        <section className="space-y-5">
          {/* Banner fechado */}
          {l.fechado && (
            <div className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-3.5 py-2.5 text-[12px] flex items-start gap-2">
              <Lock className="w-4 h-4 mt-[1px] shrink-0 text-slate-600 dark:text-slate-300" />
              <span className="text-slate-800 dark:text-slate-200">
                <strong>Lançamento fechado.</strong> Edição travada
                {l.fechadoEm && <> em {fmtDataHora(l.fechadoEm)}</>}
                {l.fechadoPor && <> por {l.fechadoPor}</>}.
                Pagamentos seguem permitidos.
              </span>
            </div>
          )}

          {/* Header info */}
          <BlocoInfo>
            <Linha label="Status">
              <span className={'inline-block px-2 py-0.5 rounded text-[10.5px] font-medium ' + (STATUS_LABEL[l.status]?.cls ?? '')}>
                {STATUS_LABEL[l.status]?.label ?? l.status}
              </span>
            </Linha>
            <Linha label="Origem">
              {l.origem === 'oc' ? (
                <span className="inline-flex items-center gap-1 text-[11.5px]">
                  Ordem de Compra
                  {l.ordemCompraId && (
                    <span className="font-mono text-[10.5px] text-[var(--color-fg-muted)]">
                      ({l.ordemCompraId.slice(0, 8)})
                    </span>
                  )}
                </span>
              ) : (
                <span className="capitalize">{l.origem}</span>
              )}
            </Linha>
            <Linha label="Fornecedor / favorecido">
              {fornecedor?.nome ?? l.favorecidoNome ?? '—'}
            </Linha>
            <Linha label="Empresa pagadora">{empresa?.nome ?? '—'}</Linha>
            <Linha label="Categoria">{categoria?.nome ?? '—'}</Linha>
            <Linha label="Data emissão">{fmtData(l.dataEmissao)}</Linha>
            <Linha label="Forma de pagamento">{l.formaPagamento || '—'}</Linha>
          </BlocoInfo>

          {/* Valores */}
          <BlocoInfo titulo="Valores">
            <Linha label="Valor total">
              <strong className="text-[var(--color-fg)] tabular-nums">{fmtMoeda(l.valorTotal)}</strong>
            </Linha>
            <Linha label="Pago">
              <span className="text-emerald-700 dark:text-emerald-400 tabular-nums">{fmtMoeda(totalPago)}</span>
            </Linha>
            <Linha label="Em aberto">
              <span className="text-amber-700 dark:text-amber-400 tabular-nums">{fmtMoeda(totalAberto)}</span>
            </Linha>
          </BlocoInfo>

          {/* Parcelas */}
          {l.parcelas.length > 0 && (
            <BlocoInfo titulo={`Parcelas (${l.parcelas.length})`}>
              <table className="w-full text-sm">
                <thead className="text-[10.5px] uppercase tracking-wide text-[var(--color-fg-muted)]">
                  <tr>
                    <th className="text-left py-1.5 font-medium w-12">Nº</th>
                    <th className="text-left py-1.5 font-medium">Vencimento</th>
                    <th className="text-right py-1.5 font-medium">Valor</th>
                    <th className="text-right py-1.5 font-medium w-24">Status</th>
                    <th className="w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {l.parcelas.map((p) => {
                    const ehVencida = p.status === 'em_aberto' &&
                      new Date(p.dataVencimento + 'T00:00') < new Date();
                    return (
                      <tr key={p.id}>
                        <td className="py-1.5 text-[var(--color-fg-muted)]">
                          {p.numero}/{l.parcelas.length}
                        </td>
                        <td className="py-1.5 text-[var(--color-fg-muted)]">
                          {fmtData(p.dataVencimento)}
                          {ehVencida && (
                            <span className="ml-1.5 text-[10px] text-rose-600 dark:text-rose-400">vencida</span>
                          )}
                          {p.status === 'pago' && p.dataPagamento && (
                            <div className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                              pago em {fmtData(p.dataPagamento)}
                            </div>
                          )}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">
                          {fmtMoeda(p.valor)}
                        </td>
                        <td className="py-1.5 text-right">
                          <span
                            className={
                              'inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ' +
                              (p.status === 'pago'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200')
                            }
                          >
                            {p.status === 'pago' ? 'pago' : 'em aberto'}
                          </span>
                        </td>
                        <td className="py-1.5 text-right">
                          {p.status === 'em_aberto' ? (
                            <button
                              type="button"
                              onClick={() => setPagarParcela(p)}
                              className="px-2 py-0.5 text-[11px] rounded-md bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
                              title="Registrar pagamento"
                            >
                              <span className="inline-flex items-center gap-1">
                                <Banknote className="w-3 h-3" /> Pagar
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleEstornar(p)}
                              className="px-2 py-0.5 text-[11px] rounded-md text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
                              title="Estornar pagamento"
                            >
                              <span className="inline-flex items-center gap-1">
                                <RotateCcw className="w-3 h-3" /> Estornar
                              </span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </BlocoInfo>
          )}

          {/* Rateio detalhado */}
          {l.rateios.length > 0 && (
            <BlocoInfo titulo={`Rateio de custos (${l.rateios.length} destino${l.rateios.length === 1 ? '' : 's'})`}>
              <ul className="space-y-2">
                {l.rateios.map((r) => {
                  const tipo = TIPO_DESTINO_LABEL[r.tipoDestino];
                  const TIcon = tipo?.Icon ?? Building2;
                  const obra = r.obraId ? obras.find((o) => o.id === r.obraId) : undefined;
                  const etapa = r.etapaObraId ? etapas.find((e) => e.id === r.etapaObraId) : undefined;
                  const os = r.ordemServicoId ? ordensServico.find((o) => o.id === r.ordemServicoId) : undefined;
                  const eq = r.equipamentoId ? equipamentos.find((e) => e.id === r.equipamentoId) : undefined;
                  const pctTotal = l.valorTotal > 0 ? (r.valor / l.valorTotal) * 100 : 0;
                  return (
                    <li key={r.id} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <TIcon className="w-4 h-4 text-[var(--color-fg-muted)] shrink-0" />
                          <span className="text-[12.5px] font-medium text-[var(--color-fg)] truncate">
                            {tipo?.label ?? r.tipoDestino}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[13px] font-semibold tabular-nums text-[var(--color-fg)]">
                            {fmtMoeda(r.valor)}
                          </div>
                          <div className="text-[10.5px] text-[var(--color-fg-muted)] tabular-nums">
                            {pctTotal.toFixed(1)}% do total
                          </div>
                        </div>
                      </div>
                      {/* Detalhes contextuais por tipo */}
                      <div className="text-[11.5px] text-[var(--color-fg-muted)] mt-1.5 leading-snug">
                        {obra && <>Obra: <strong>{obra.nome}</strong></>}
                        {obra && etapa && <> · </>}
                        {etapa && <>Etapa: <strong>{etapa.nome}</strong></>}
                        {os && (
                          <>
                            {(obra || etapa) && ' · '}
                            OS: <strong>{os.numero}</strong>
                            {eq && <> ({eq.codigoPatrimonio || eq.modelo || eq.tipo})</>}
                          </>
                        )}
                        {r.tipoDestino === 'sede' && (
                          <span className="italic">Administrativo / sede</span>
                        )}
                        {r.tipoDestino === 'manutencao_equipamento' && !os && (
                          <span className="italic">Sem OS — peça vai pro almoxarifado</span>
                        )}
                      </div>
                      {r.observacoes && (
                        <p className="text-[11px] italic text-[var(--color-fg-subtle)] mt-1">
                          "{r.observacoes}"
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </BlocoInfo>
          )}

          {/* Anexos — sempre visível, com upload inline.
              Anexos são metadados; podem ser adicionados/removidos mesmo
              quando o lançamento está fechado (comprovantes chegam depois). */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10.5px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold inline-flex items-center gap-1.5">
                <Paperclip className="w-3 h-3" />
                Anexos ({l.anexosUrls?.length ?? 0})
              </h3>
              <label className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] cursor-pointer">
                {uploadingAnexo ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Paperclip className="w-3 h-3" />
                )}
                {uploadingAnexo ? 'Enviando…' : 'Adicionar anexo'}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleAddAnexo}
                  disabled={uploadingAnexo}
                />
              </label>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3">
              {!l.anexosUrls || l.anexosUrls.length === 0 ? (
                <p className="text-[12px] text-[var(--color-fg-muted)] italic text-center py-3">
                  Nenhum anexo. Clique em <strong>Adicionar anexo</strong> pra subir um boleto,
                  nota fiscal ou comprovante (PDF, JPG, PNG — máx 20 MB).
                </p>
              ) : (
                <ul className="space-y-2">
                  {l.anexosUrls.map((pathOrUrl, i) => {
                    const nome = decodeURIComponent(pathOrUrl.split('/').pop() ?? '')
                      .replace(/^\d+_\w+\./, '*.');
                    const url = signedAnexosUrls[pathOrUrl] ?? (pathOrUrl.startsWith('http') ? pathOrUrl : '#');
                    const ehImg = ehImagem(pathOrUrl);
                    return (
                      <li
                        key={i}
                        className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-[var(--color-surface-2)] group"
                      >
                        {/* Thumbnail/ícone */}
                        {ehImg ? (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                            <img
                              src={url}
                              alt={nome}
                              className="w-10 h-10 rounded object-cover border border-[var(--color-border)]"
                            />
                          </a>
                        ) : (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 w-10 h-10 rounded inline-flex items-center justify-center bg-[var(--color-surface-2)] border border-[var(--color-border)]"
                            title="Abrir PDF"
                          >
                            <FileText className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                          </a>
                        )}
                        {/* Nome + link */}
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 min-w-0 text-[12.5px] text-[var(--color-fg)] hover:text-[var(--color-accent)] inline-flex items-center gap-1"
                        >
                          <span className="truncate">{nome}</span>
                          <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                        </a>
                        {/* Badge tipo */}
                        <span
                          className={
                            'shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ' +
                            (ehImg
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300')
                          }
                        >
                          {ehImg ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                          {ehImg ? 'IMG' : 'PDF'}
                        </span>
                        {/* Remover */}
                        <button
                          type="button"
                          onClick={() => handleRemoveAnexo(pathOrUrl)}
                          className="shrink-0 w-6 h-6 inline-flex items-center justify-center rounded text-[var(--color-fg-subtle)] hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/15 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remover anexo"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Observações */}
          {l.observacoes && (
            <BlocoInfo titulo="Observações">
              <p className="text-sm text-[var(--color-fg)] whitespace-pre-line">{l.observacoes}</p>
            </BlocoInfo>
          )}

          {/* Auditoria */}
          <BlocoInfo titulo="Auditoria">
            {l.criadoEm && (
              <Linha label="Criado">
                <span className="text-[11.5px]">
                  {fmtDataHora(l.criadoEm)}
                  {l.criadoPor && <> por {l.criadoPor}</>}
                </span>
              </Linha>
            )}
            {l.atualizadoEm && (
              <Linha label="Atualizado">
                <span className="text-[11.5px]">
                  {fmtDataHora(l.atualizadoEm)}
                  {l.atualizadoPor && <> por {l.atualizadoPor}</>}
                </span>
              </Linha>
            )}
            {l.fechadoEm && (
              <Linha label="Fechado">
                <span className="text-[11.5px]">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  {fmtDataHora(l.fechadoEm)}
                  {l.fechadoPor && <> por {l.fechadoPor}</>}
                </span>
              </Linha>
            )}
            {l.reabertoEm && (
              <Linha label="Reaberto">
                <span className="text-[11.5px]">
                  {fmtDataHora(l.reabertoEm)}
                  {l.reabertoPor && <> por {l.reabertoPor}</>}
                </span>
              </Linha>
            )}
          </BlocoInfo>
        </section>
      </Drawer>

      <RegistrarPagamentoModal
        open={pagarParcela !== null}
        onClose={() => setPagarParcela(null)}
        lancamento={lancamento}
        parcela={pagarParcela}
      />
    </>
  );
}

function BlocoInfo({ titulo, children }: { titulo?: string; children: React.ReactNode }) {
  return (
    <div>
      {titulo && (
        <h3 className="text-[10.5px] uppercase tracking-wide text-[var(--color-fg-muted)] mb-2 font-semibold">
          {titulo}
        </h3>
      )}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3.5 space-y-1.5">
        {children}
      </div>
    </div>
  );
}

function Linha({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span className="text-[var(--color-fg-muted)] shrink-0">{label}</span>
      <span className="text-right text-[var(--color-fg)] truncate min-w-0">{children}</span>
    </div>
  );
}
