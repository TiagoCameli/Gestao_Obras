// Task 2.3 — Detalhe do serviço com peças, terceiros e óleos.
// Status/timeline e mão de obra removidos da UI (banco fica pra Fase 4).

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Pencil, ShieldCheck, Calendar,
  Gauge, Wrench, Plus, Trash2, Check, X,
} from 'lucide-react';
import {
  useOrdemServicoByNumero,
  usePecasOS,
  useAtualizarOS,
  useAdicionarPecaOS,
  useExcluirPecaOS,
  useExcluirOS,
} from '../../../hooks/useOrdensServico';
import { useTerceirosOS, useExcluirTerceiroOS } from '../../../hooks/useOSTerceiros';
import { useOleosOS, useExcluirOleoOS } from '../../../hooks/useOSOleos';
import { useTiposOleo } from '../../../hooks/useTiposOleo';
import { useEquipamentos } from '../../../hooks/useEquipamentos';
import { useInsumos } from '../../../hooks/useInsumos';
import { useAuth } from '../../../contexts/AuthContext';
import AdicionarPecaOSModal from './AdicionarPecaOSModal';
import AdicionarTerceiroOSModal from './AdicionarTerceiroOSModal';
import AdicionarOleoOSModal from './AdicionarOleoOSModal';
import EditarOSModal from './EditarOSModal';
import type { OSPeca } from '../../../types';
import {
  TIPO_OS_LABEL, PRIORIDADE_OS_LABEL, STATUS_OS_LABEL,
} from '../../../types';
import Button from '../../ui/Button';
import ConfirmDialog from '../../ui/ConfirmDialog';
import { STATUS_COLOR, PRIORIDADE_COLOR, TIPO_COLOR } from './styles';
import FotoGaleria from '../../shared/FotoGaleria';
import ArquivosLista from '../../shared/ArquivosLista';

function fmtDataHora(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
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
  const { data: terceiros = [] } = useTerceirosOS(os?.id);
  const { data: oleos = [] } = useOleosOS(os?.id);
  const { data: tiposOleo = [] } = useTiposOleo();

  const atualizarMut = useAtualizarOS();
  const adicionarPecaMut = useAdicionarPecaOS();
  const excluirPecaMut = useExcluirPecaOS();
  const excluirTerceiroMut = useExcluirTerceiroOS();
  const excluirOleoMut = useExcluirOleoOS();
  const excluirOSMut = useExcluirOS();

  const { data: insumos = [] } = useInsumos();

  const canEditarDescricao = temAcao('editar_diagnostico_os');
  const canEditarOS = temAcao('editar_os');
  const canExcluirOS = temAcao('excluir_os');
  const canAddPeca = temAcao('adicionar_peca_os');
  const canAddTerceiro = temAcao('adicionar_terceiro_os');
  const canAddOleo = temAcao('adicionar_oleo_os');

  const [descricaoEditando, setDescricaoEditando] = useState(false);
  const [descricaoRascunho, setDescricaoRascunho] = useState('');
  const [descricaoSalvando, setDescricaoSalvando] = useState(false);

  const [pecaModalOpen, setPecaModalOpen] = useState(false);
  const [terceiroModalOpen, setTerceiroModalOpen] = useState(false);
  const [oleoModalOpen, setOleoModalOpen] = useState(false);

  const [excluirPecaId, setExcluirPecaId] = useState<string | null>(null);
  const [excluirTerceiroId, setExcluirTerceiroId] = useState<string | null>(null);
  const [excluirOleoId, setExcluirOleoId] = useState<string | null>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [confirmExcluirOpen, setConfirmExcluirOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-[var(--color-fg-muted)]">Carregando serviço…</p>
      </div>
    );
  }

  if (!os) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-12 text-center">
        <p className="text-sm font-medium text-[var(--color-fg)]">Serviço não encontrado</p>
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

  function iniciarEdicaoDescricao() {
    setDescricaoRascunho(os?.solucaoAplicada ?? '');
    setDescricaoEditando(true);
  }

  async function salvarDescricao() {
    if (!os) return;
    setDescricaoSalvando(true);
    try {
      await atualizarMut.mutateAsync({
        ...os,
        solucaoAplicada: descricaoRascunho,
        updatedBy: usuario?.nome ?? '',
      });
      setDescricaoEditando(false);
    } finally {
      setDescricaoSalvando(false);
    }
  }

  async function handleAdicionarPeca(peca: OSPeca) {
    await adicionarPecaMut.mutateAsync(peca);
  }

  const insumoNome = (id: string) => insumos.find((i) => i.id === id)?.nome ?? id;
  const tipoOleoNome = (id: string) => tiposOleo.find((t) => t.id === id)?.nome ?? id;

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
          Voltar para Serviços
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

            {(canEditarOS || canExcluirOS) && (
              <div className="flex items-center gap-2 shrink-0">
                {canEditarOS && (
                  <Button size="sm" variant="secondary" onClick={() => setEditModalOpen(true)}>
                    <Pencil className="w-3.5 h-3.5" />
                    Editar
                  </Button>
                )}
                {canExcluirOS && (
                  <Button size="sm" variant="danger" onClick={() => setConfirmExcluirOpen(true)}>
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir
                  </Button>
                )}
              </div>
            )}
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
          <Linha label="Terceiros" valor={fmtBRL(os.custoTerceiros)} />
          <Linha label="Óleos" valor={fmtBRL(os.custoOleos)} />
          <Linha label="Total" valor={<strong className="text-[var(--color-fg)]">{fmtBRL(os.custoTotal)}</strong>} destaque />
        </Bloco>
      </section>

      {/* Descrição do serviço */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
            Descrição do serviço
          </h3>
          {canEditarDescricao && !descricaoEditando && (
            <Button size="sm" variant="secondary" onClick={iniciarEdicaoDescricao}>
              <Pencil className="w-3.5 h-3.5" />
              Editar
            </Button>
          )}
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4">
          {descricaoEditando ? (
            <div className="space-y-2">
              <textarea
                autoFocus
                rows={4}
                value={descricaoRascunho}
                onChange={(e) => setDescricaoRascunho(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-2)] text-[var(--color-fg)] border border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] resize-none"
                placeholder="Descreva o serviço realizado…"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDescricaoEditando(false)}
                  disabled={descricaoSalvando}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)] disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={salvarDescricao}
                  disabled={descricaoSalvando}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  {descricaoSalvando ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-fg)] whitespace-pre-line">
              {os.solucaoAplicada || <span className="text-[var(--color-fg-subtle)]">Nenhuma descrição registrada.</span>}
            </p>
          )}
        </div>
      </section>

      {/* Peças */}
      <section>
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
                      onClick={() => setExcluirPecaId(p.id)}
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
      </section>

      {/* Terceiros */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
            Serviços de terceiros
            {terceiros.length > 0 && (
              <span className="ml-2 text-[var(--color-fg-subtle)] font-normal">({terceiros.length})</span>
            )}
          </h3>
          {canAddTerceiro && (
            <Button size="sm" variant="secondary" onClick={() => setTerceiroModalOpen(true)}>
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </Button>
          )}
        </div>
        {terceiros.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 text-center text-sm text-[var(--color-fg-muted)]">
            Nenhum serviço de terceiro registrado.
            {canAddTerceiro && (
              <p className="text-xs text-[var(--color-fg-subtle)] mt-1">
                Clique em Adicionar pra registrar o 1º serviço de terceiro.
              </p>
            )}
          </div>
        ) : (
          <ul className="space-y-1">
            {terceiros.map((t) => (
              <li
                key={t.id}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-2.5 flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--color-fg)] truncate">{t.prestador}</p>
                  {t.descricao && (
                    <p className="text-xs text-[var(--color-fg-muted)] truncate">{t.descricao}</p>
                  )}
                  {t.notaFiscal && (
                    <p className="text-xs text-[var(--color-fg-subtle)]">NF: {t.notaFiscal}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <strong className="text-sm font-mono">{fmtBRL(t.valor)}</strong>
                  {canAddTerceiro && (
                    <button
                      type="button"
                      onClick={() => setExcluirTerceiroId(t.id)}
                      className="w-7 h-7 inline-flex items-center justify-center rounded-md text-[var(--color-fg-subtle)] hover:text-[var(--color-danger)] hover:bg-[var(--color-surface-2)]"
                      aria-label="Remover terceiro"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Óleos */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
            Óleos e lubrificantes
            {oleos.length > 0 && (
              <span className="ml-2 text-[var(--color-fg-subtle)] font-normal">({oleos.length})</span>
            )}
          </h3>
          {canAddOleo && (
            <Button size="sm" variant="secondary" onClick={() => setOleoModalOpen(true)}>
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </Button>
          )}
        </div>
        {oleos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 text-center text-sm text-[var(--color-fg-muted)]">
            Nenhuma troca de óleo registrada.
            {canAddOleo && (
              <p className="text-xs text-[var(--color-fg-subtle)] mt-1">
                Clique em Adicionar pra registrar a 1ª troca.
              </p>
            )}
          </div>
        ) : (
          <ul className="space-y-1">
            {oleos.map((o) => (
              <li
                key={o.id}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-2.5 flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--color-fg)] truncate">{tipoOleoNome(o.tipoOleoId)}</p>
                  <p className="text-xs text-[var(--color-fg-muted)]">
                    {o.quantidade} {o.unidade} × {fmtBRL(o.valorUnitario)}/{o.unidade}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <strong className="text-sm font-mono">{fmtBRL(o.valorTotal)}</strong>
                  {canAddOleo && (
                    <button
                      type="button"
                      onClick={() => setExcluirOleoId(o.id)}
                      className="w-7 h-7 inline-flex items-center justify-center rounded-md text-[var(--color-fg-subtle)] hover:text-[var(--color-danger)] hover:bg-[var(--color-surface-2)]"
                      aria-label="Remover óleo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </li>
            ))}
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
              <FotoGaleria fotoUrls={os.fotoUrls} canDelete={false} canDownload size="compact" />
            )}
            {os.arquivoUrls.length > 0 && (
              <div className="mt-2">
                <ArquivosLista arquivoUrls={os.arquivoUrls} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Modais */}
      {editModalOpen && (
        <EditarOSModal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          os={os}
          equipamentos={equipamentos}
        />
      )}

      {pecaModalOpen && (
        <AdicionarPecaOSModal
          open={pecaModalOpen}
          onClose={() => setPecaModalOpen(false)}
          osId={os.id}
          onSubmit={handleAdicionarPeca}
          usuarioNome={usuario?.nome ?? ''}
        />
      )}

      {terceiroModalOpen && (
        <AdicionarTerceiroOSModal
          osId={os.id}
          onClose={() => setTerceiroModalOpen(false)}
        />
      )}

      {oleoModalOpen && (
        <AdicionarOleoOSModal
          osId={os.id}
          onClose={() => setOleoModalOpen(false)}
        />
      )}

      {/* ConfirmDialogs */}
      <ConfirmDialog
        open={confirmExcluirOpen}
        onClose={() => setConfirmExcluirOpen(false)}
        onConfirm={async () => {
          await excluirOSMut.mutateAsync({ id: os.id, deletedBy: usuario?.nome ?? '' });
          navigate('/manutencao/os');
        }}
        title="Excluir serviço"
        message="Confirma a exclusão deste serviço? As peças e óleos lançados voltam pro estoque. O serviço fica recuperável no banco, mas some da lista."
      />

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
        message="Confirma a exclusão desta peça do serviço?"
        requirePassword={false}
      />

      <ConfirmDialog
        open={excluirTerceiroId !== null}
        onClose={() => setExcluirTerceiroId(null)}
        onConfirm={async () => {
          if (!excluirTerceiroId) return;
          try {
            await excluirTerceiroMut.mutateAsync({ id: excluirTerceiroId, osId: os.id });
          } finally {
            setExcluirTerceiroId(null);
          }
        }}
        title="Excluir serviço de terceiro"
        message="Confirma a exclusão deste serviço de terceiro?"
        requirePassword={false}
      />

      <ConfirmDialog
        open={excluirOleoId !== null}
        onClose={() => setExcluirOleoId(null)}
        onConfirm={async () => {
          if (!excluirOleoId) return;
          try {
            await excluirOleoMut.mutateAsync({ id: excluirOleoId, osId: os.id });
          } finally {
            setExcluirOleoId(null);
          }
        }}
        title="Excluir troca de óleo"
        message="Confirma a exclusão desta troca de óleo?"
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
