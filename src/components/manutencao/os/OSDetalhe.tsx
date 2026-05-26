// Marco 2 / PR11 — Página de detalhe da OS.
//
// Acessada via /manutencao/os/:numero. Mostra:
//   - Header: voltar, numero, equipamento, status, ações
//   - Resumo: tipo, prioridade, datas, medições, custos
//   - Diagnóstico: defeito, sintomas, sistemas, causa raiz, solução, recomendações
//   - Peças e mão de obra (read-only — PR12 trará UI de gestão)
//   - Anexos (galeria)
//   - Timeline de transições

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Pencil, ShieldCheck, Calendar, Clock,
  Gauge, Wrench, FileText, ChevronRight, Activity, Plus, Trash2,
} from 'lucide-react';
import {
  useOrdemServicoByNumero,
  usePecasOS,
  useMaoObraOS,
  useTransicoesOS,
  useAtualizarOS,
  useMudarStatusOS,
  useAdicionarPecaOS,
  useExcluirPecaOS,
  useAdicionarMaoObraOS,
  useExcluirMaoObraOS,
} from '../../../hooks/useOrdensServico';
import { useEquipamentos } from '../../../hooks/useEquipamentos';
import { useInsumos } from '../../../hooks/useInsumos';
import { useColaboradores } from '../../../hooks/useColaboradores';
import { useDepositosMaterial } from '../../../hooks/useDepositosMaterial';
import { useAuth } from '../../../contexts/AuthContext';
import AdicionarPecaOSModal from './AdicionarPecaOSModal';
import AdicionarMaoObraOSModal from './AdicionarMaoObraOSModal';
import type { OSPeca, OSMaoObra } from '../../../types';
import {
  TIPO_OS_LABEL, PRIORIDADE_OS_LABEL, STATUS_OS_LABEL,
} from '../../../types';
import type { OrdemServico, StatusOS } from '../../../types';
import Button from '../../ui/Button';
import ConfirmDialog from '../../ui/ConfirmDialog';
import { STATUS_COLOR, PRIORIDADE_COLOR, TIPO_COLOR } from './styles';
import MudarStatusOSModal from './MudarStatusOSModal';
import EditarDiagnosticoOSModal from './EditarDiagnosticoOSModal';

function fmtDataHora(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function fmtData(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s.slice(0, 10);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' });
}

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function OSDetalhe() {
  const { numero } = useParams<{ numero: string }>();
  const navigate = useNavigate();
  const { temAcao, usuario } = useAuth();

  const { data: os, isLoading } = useOrdemServicoByNumero(numero);
  const { data: equipamentos = [] } = useEquipamentos();
  const equipamento = os ? equipamentos.find((e) => e.id === os.equipamentoId) : null;

  const { data: pecas = [] } = usePecasOS(os?.id);
  const { data: maoObra = [] } = useMaoObraOS(os?.id);
  const { data: transicoes = [] } = useTransicoesOS(os?.id);

  const atualizarMut = useAtualizarOS();
  const mudarStatusMut = useMudarStatusOS();
  const adicionarPecaMut = useAdicionarPecaOS();
  const excluirPecaMut = useExcluirPecaOS();
  const adicionarMOMut = useAdicionarMaoObraOS();
  const excluirMOMut = useExcluirMaoObraOS();

  const { data: insumos = [] } = useInsumos();
  const { data: colaboradores = [] } = useColaboradores();
  const { data: depositos = [] } = useDepositosMaterial();

  const canMudarStatus = temAcao('mudar_status_os');
  const canEditarDiag = temAcao('editar_diagnostico_os');
  const canAddPeca = temAcao('adicionar_peca_os');
  const canAddMO = temAcao('adicionar_mao_obra_os');

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [diagModalOpen, setDiagModalOpen] = useState(false);
  // ConfirmDialog state pra exclusão de peças e mão de obra
  const [excluirPecaId, setExcluirPecaId] = useState<string | null>(null);
  const [excluirMoId, setExcluirMoId] = useState<string | null>(null);
  const [pecaModalOpen, setPecaModalOpen] = useState(false);
  const [moModalOpen, setMOModalOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-[var(--color-fg-muted)]">Carregando OS…</p>
      </div>
    );
  }

  if (!os) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-12 text-center">
        <p className="text-sm font-medium text-[var(--color-fg)]">OS não encontrada</p>
        <p className="text-xs text-[var(--color-fg-muted)] mt-1">
          O número {numero} não existe ou foi excluído.
        </p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/manutencao/os')}>
          <ArrowLeft className="w-4 h-4" /> Voltar pra lista
        </Button>
      </div>
    );
  }

  const sCor = STATUS_COLOR[os.status];
  const pCor = PRIORIDADE_COLOR[os.prioridade];

  async function handleMudarStatus(novoStatus: StatusOS, observacao: string) {
    if (!os) return;
    await mudarStatusMut.mutateAsync({
      osId: os.id,
      novoStatus,
      usuarioNome: usuario?.nome ?? '',
    });
    if (observacao) {
      // Se houve observação, anexa às recomendações/observações (auditoria fica em os_transicoes via trigger)
      await atualizarMut.mutateAsync({
        ...os,
        status: novoStatus,
        observacoes: os.observacoes
          ? `${os.observacoes}\n\n[${new Date().toLocaleString('pt-BR')}] ${observacao}`
          : `[${new Date().toLocaleString('pt-BR')}] ${observacao}`,
        updatedBy: usuario?.nome ?? '',
      });
    }
  }

  async function handleSalvarDiagnostico(patch: Partial<OrdemServico>) {
    if (!os) return;
    await atualizarMut.mutateAsync({
      ...os,
      ...patch,
      updatedBy: usuario?.nome ?? '',
    });
  }

  async function handleAdicionarPeca(peca: OSPeca) {
    await adicionarPecaMut.mutateAsync(peca);
  }

  async function handleAdicionarMO(mo: OSMaoObra) {
    await adicionarMOMut.mutateAsync(mo);
  }

  function handleExcluirPeca(pecaId: string) {
    if (!os) return;
    if (!canAddPeca) return;
    setExcluirPecaId(pecaId);
  }

  function handleExcluirMO(moId: string) {
    if (!os) return;
    if (!canAddMO) return;
    setExcluirMoId(moId);
  }

  const insumoNome = (id: string) => insumos.find((i) => i.id === id)?.nome ?? id;
  const colabNome = (id: string) => colaboradores.find((c) => c.id === id)?.nome ?? id;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/manutencao/os')}
          className="text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] inline-flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Ordens de Serviço
        </button>
        <div className={'rounded-2xl border-l-4 ' + TIPO_COLOR[os.tipo] + ' border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 sm:p-5'}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-mono font-semibold text-[var(--color-fg)]">
                  {os.numero}
                </span>
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: sCor.bg, color: sCor.fg }}
                >
                  <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sCor.dot }} />
                  {STATUS_OS_LABEL[os.status]}
                </span>
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: pCor.bg, color: pCor.fg }}
                >
                  {PRIORIDADE_OS_LABEL[os.prioridade]}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]">
                  <Wrench className="w-3 h-3" />
                  {TIPO_OS_LABEL[os.tipo]}
                </span>
                {os.garantiaAcionada && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-info-soft)] text-[var(--color-info-fg)]">
                    <ShieldCheck className="w-3 h-3" />
                    Garantia
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-semibold text-[var(--color-fg)] mt-2">
                {equipamento
                  ? equipamento.codigoPatrimonio
                    ? `${equipamento.codigoPatrimonio} · ${equipamento.nome}`
                    : equipamento.nome
                  : 'Equipamento não encontrado'}
              </h1>
              {equipamento?.tipo && (
                <p className="text-sm text-[var(--color-fg-muted)] mt-0.5">{equipamento.tipo}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {canMudarStatus && (
                <Button variant="secondary" size="sm" onClick={() => setStatusModalOpen(true)}>
                  <ChevronRight className="w-3.5 h-3.5" />
                  Avançar status
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Resumo - datas, medições, custo */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        <Bloco titulo="Datas" icon={Calendar}>
          <Linha label="Abertura" valor={fmtDataHora(os.dataAbertura)} />
          <Linha label="Início execução" valor={fmtDataHora(os.dataInicioExecucao)} />
          <Linha label="Conclusão" valor={fmtDataHora(os.dataConclusao)} />
          <Linha label="Prazo" valor={fmtDataHora(os.prazoAtendimento)} />
        </Bloco>

        <Bloco titulo="Medições e parada" icon={Gauge}>
          <Linha
            label="Medição abertura"
            valor={os.medicaoAbertura != null ? os.medicaoAbertura.toLocaleString('pt-BR') : null}
          />
          <Linha
            label="Medição conclusão"
            valor={os.medicaoConclusao != null ? os.medicaoConclusao.toLocaleString('pt-BR') : null}
          />
          <Linha label="Parada início" valor={fmtDataHora(os.paradaInicio)} />
          <Linha label="Parada fim" valor={fmtDataHora(os.paradaFim)} />
        </Bloco>

        <Bloco titulo="Custos" icon={Wrench}>
          <Linha label="Peças" valor={fmtBRL(os.custoPecas)} />
          <Linha label="Serviço terceiro" valor={fmtBRL(os.custoServicoTerceiro)} />
          <Linha label="Mão de obra própria" valor={fmtBRL(os.custoMaoObraPropria)} />
          <Linha label="Total" valor={<strong className="text-[var(--color-fg)]">{fmtBRL(os.custoTotal)}</strong>} destaque />
        </Bloco>
      </section>

      {/* Diagnóstico */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
            Diagnóstico
          </h3>
          {canEditarDiag && (
            <Button size="sm" variant="secondary" onClick={() => setDiagModalOpen(true)}>
              <Pencil className="w-3.5 h-3.5" />
              Editar diagnóstico
            </Button>
          )}
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 space-y-3">
          <Campo label="Defeito reportado" valor={os.defeitoReportado || '—'} />
          {os.sintomas.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">Sintomas</div>
              <div className="flex flex-wrap gap-1">
                {os.sintomas.map((s) => (
                  <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {os.sistemasAfetados.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">Sistemas afetados</div>
              <div className="flex flex-wrap gap-1">
                {os.sistemasAfetados.map((s) => (
                  <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-warning-soft)] text-[var(--color-warning-fg)] capitalize">
                    {s.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
          {os.causaRaiz && <Campo label="Causa raiz" valor={os.causaRaiz} />}
          {os.solucaoAplicada && <Campo label="Solução aplicada" valor={os.solucaoAplicada} />}
          {os.recomendacoes && <Campo label="Recomendações" valor={os.recomendacoes} />}
          {os.observacoes && <Campo label="Observações" valor={os.observacoes} />}
        </div>
      </section>

      {/* Peças e mão de obra */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* PEÇAS */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
              Peças utilizadas
              {pecas.length > 0 && (
                <span className="ml-2 text-[var(--color-fg-subtle)] font-normal">({pecas.length})</span>
              )}
            </h3>
            {canAddPeca && (
              <Button size="sm" variant="secondary" onClick={() => setPecaModalOpen(true)}>
                <Plus className="w-3.5 h-3.5" />
                Adicionar
              </Button>
            )}
          </div>
          {pecas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 text-center text-sm text-[var(--color-fg-muted)]">
              Nenhuma peça registrada.
              {canAddPeca && (
                <p className="text-xs text-[var(--color-fg-subtle)] mt-1">
                  Clique em Adicionar pra registrar a 1ª peça.
                </p>
              )}
            </div>
          ) : (
            <ul className="space-y-1">
              {pecas.map((p) => (
                <li
                  key={p.id}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-2.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--color-fg)] truncate">{insumoNome(p.insumoId)}</p>
                    <p className="text-xs text-[var(--color-fg-muted)]">
                      {p.quantidade} × {fmtBRL(p.custoUnitario)}
                      {' · '}
                      <span className="capitalize">{p.status}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <strong className="text-sm font-mono">{fmtBRL(p.custoTotal)}</strong>
                    {canAddPeca && (
                      <button
                        type="button"
                        onClick={() => handleExcluirPeca(p.id)}
                        className="w-7 h-7 inline-flex items-center justify-center rounded-md text-[var(--color-fg-subtle)] hover:text-[var(--color-danger)] hover:bg-[var(--color-surface-2)]"
                        aria-label="Remover peça"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* MÃO DE OBRA */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
              Mão de obra própria
              {maoObra.length > 0 && (
                <span className="ml-2 text-[var(--color-fg-subtle)] font-normal">({maoObra.length})</span>
              )}
            </h3>
            {canAddMO && (
              <Button size="sm" variant="secondary" onClick={() => setMOModalOpen(true)}>
                <Plus className="w-3.5 h-3.5" />
                Apontar horas
              </Button>
            )}
          </div>
          {maoObra.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 text-center text-sm text-[var(--color-fg-muted)]">
              Nenhuma hora apontada.
              {canAddMO && (
                <p className="text-xs text-[var(--color-fg-subtle)] mt-1">
                  Clique em Apontar horas pra registrar a 1ª.
                </p>
              )}
            </div>
          ) : (
            <ul className="space-y-1">
              {maoObra.map((m) => (
                <li
                  key={m.id}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-2.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--color-fg)] truncate">{colabNome(m.colaboradorId)}</p>
                    <p className="text-xs text-[var(--color-fg-muted)]">
                      {fmtData(m.data)} · {m.horas} h
                      {m.custoHora != null && <> · {fmtBRL(m.custoHora)}/h</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <strong className="text-sm font-mono">{fmtBRL(m.custoTotal)}</strong>
                    {canAddMO && (
                      <button
                        type="button"
                        onClick={() => handleExcluirMO(m.id)}
                        className="w-7 h-7 inline-flex items-center justify-center rounded-md text-[var(--color-fg-subtle)] hover:text-[var(--color-danger)] hover:bg-[var(--color-surface-2)]"
                        aria-label="Remover apontamento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Timeline de transições */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2">
          Histórico de status
          <span className="ml-2 text-[var(--color-fg-subtle)] font-normal">({transicoes.length})</span>
        </h3>
        {transicoes.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)] py-2">Sem transições.</p>
        ) : (
          <ul className="relative space-y-2">
            <span aria-hidden className="absolute left-3.5 top-2 bottom-2 w-px bg-[var(--color-border)]" />
            {transicoes.map((t) => {
              const sCor = STATUS_COLOR[t.statusPara];
              return (
                <li key={t.id} className="relative pl-10">
                  <span
                    aria-hidden
                    className="absolute left-0 top-1.5 w-7 h-7 rounded-full inline-flex items-center justify-center"
                    style={{ backgroundColor: sCor.bg }}
                  >
                    <Activity className="w-3.5 h-3.5" style={{ color: sCor.fg }} />
                  </span>
                  <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-2.5">
                    <div className="text-sm font-medium text-[var(--color-fg)]">
                      {t.statusDe ? STATUS_OS_LABEL[t.statusDe] : 'Criação'} → {STATUS_OS_LABEL[t.statusPara]}
                    </div>
                    {t.motivo && <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">{t.motivo}</p>}
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-[var(--color-fg-subtle)]">
                      <Clock className="w-3 h-3" />
                      {fmtDataHora(t.createdAt)}
                      {t.createdBy && <span>· {t.createdBy}</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Anexos */}
      {(os.fotoUrls.length > 0 || os.arquivoUrls.length > 0) && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2">
            Anexos
          </h3>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3">
            {os.fotoUrls.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {os.fotoUrls.map((url, i) => (
                  <a key={url + i} href={url} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-[var(--color-border)]">
                    <img src={url} alt={`Anexo ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                  </a>
                ))}
              </div>
            )}
            {os.arquivoUrls.length > 0 && (
              <ul className="space-y-1 mt-2">
                {os.arquivoUrls.map((url) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-[var(--color-accent-fg, var(--color-info-fg))] hover:underline inline-flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      {url.split('/').pop()}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {statusModalOpen && (
        <MudarStatusOSModal
          open={statusModalOpen}
          onClose={() => setStatusModalOpen(false)}
          numero={os.numero}
          statusAtual={os.status}
          onConfirm={handleMudarStatus}
        />
      )}

      {diagModalOpen && (
        <EditarDiagnosticoOSModal
          open={diagModalOpen}
          onClose={() => setDiagModalOpen(false)}
          os={os}
          onSubmit={handleSalvarDiagnostico}
        />
      )}

      {pecaModalOpen && (
        <AdicionarPecaOSModal
          open={pecaModalOpen}
          onClose={() => setPecaModalOpen(false)}
          osId={os.id}
          insumos={insumos}
          depositos={depositos}
          onSubmit={handleAdicionarPeca}
          usuarioNome={usuario?.nome ?? ''}
        />
      )}

      {moModalOpen && (
        <AdicionarMaoObraOSModal
          open={moModalOpen}
          onClose={() => setMOModalOpen(false)}
          osId={os.id}
          colaboradores={colaboradores}
          onSubmit={handleAdicionarMO}
          usuarioNome={usuario?.nome ?? ''}
        />
      )}

      <ConfirmDialog
        open={excluirPecaId !== null}
        onClose={() => setExcluirPecaId(null)}
        onConfirm={async () => {
          if (!excluirPecaId) return;
          try {
            await excluirPecaMut.mutateAsync({ pecaId: excluirPecaId, osId: os.id });
          } finally {
            setExcluirPecaId(null);
          }
        }}
        title="Excluir peça"
        message="Confirma a exclusão desta peça da OS?"
        requirePassword={false}
      />

      <ConfirmDialog
        open={excluirMoId !== null}
        onClose={() => setExcluirMoId(null)}
        onConfirm={async () => {
          if (!excluirMoId) return;
          try {
            await excluirMOMut.mutateAsync({ moId: excluirMoId, osId: os.id });
          } finally {
            setExcluirMoId(null);
          }
        }}
        title="Excluir mão de obra"
        message="Confirma a exclusão deste lançamento de mão de obra?"
        requirePassword={false}
      />
    </div>
  );
}

function Bloco({
  titulo, icon: Icon, children,
}: {
  titulo: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)] mb-2">
        <Icon aria-hidden className="w-3.5 h-3.5" />
        {titulo}
      </div>
      <dl className="space-y-1 text-sm">{children}</dl>
    </div>
  );
}

function Linha({
  label, valor, destaque,
}: {
  label: string;
  valor: React.ReactNode;
  destaque?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-[var(--color-fg-muted)] text-xs">{label}</dt>
      <dd className={'font-medium text-sm text-right truncate ' + (destaque ? 'text-[var(--color-fg)]' : '')}>
        {valor === null || valor === undefined || valor === '' ? (
          <span className="text-[var(--color-fg-subtle)] font-normal">—</span>
        ) : (
          valor
        )}
      </dd>
    </div>
  );
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)] mb-0.5">{label}</div>
      <p className="text-sm text-[var(--color-fg)] whitespace-pre-line">{valor}</p>
    </div>
  );
}

