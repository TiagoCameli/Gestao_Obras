import { useState, useMemo, useCallback } from 'react';
import { useUrlState } from '../hooks/useUrlState';
import type { Equipamento, TipoEquipamento, PropriedadeEquipamento, StatusEquipamento } from '../types';
import { STATUS_EQUIPAMENTO_LABEL } from '../types';
import { useEquipamentos, useAdicionarEquipamento, useAtualizarEquipamento, useExcluirEquipamento } from '../hooks/useEquipamentos';
import { useEmpresas } from '../hooks/useEmpresas';
import { useFornecedores } from '../hooks/useFornecedores';
import { useChangeStatusEquipamento } from '../hooks/useHistoricoStatusEquipamento';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import FrotaStats from '../components/frota/FrotaStats';
import FrotaGrid from '../components/frota/FrotaGrid';
import FrotaList from '../components/frota/FrotaList';
import FrotaDetalhe from '../components/frota/FrotaDetalhe';
import EquipamentoFormFrota from '../components/frota/EquipamentoFormFrota';
import { exportarFrotaPDF, exportarFrotaExcel } from '../utils/frotaExport';
import { exportarEtiquetasEmLotePdf } from '../utils/equipamentoQrExport';
import { Plus, Search, X, LayoutGrid, List as ListIcon, FileText, Sheet, SlidersHorizontal, QrCode } from 'lucide-react';

type ModoVisualizacao = 'grid' | 'lista';
type FiltroStatus = 'todos' | StatusEquipamento;
type FiltroPropriedade = 'todos' | PropriedadeEquipamento;

const PROP_LABELS: Record<FiltroPropriedade, string> = {
  todos: 'Todas',
  propria: 'Próprios',
  alugada: 'Alugados',
};

const STATUS_LABELS: Record<FiltroStatus, string> = {
  todos: 'Todos',
  ativa: STATUS_EQUIPAMENTO_LABEL.ativa,
  manutencao_preventiva: STATUS_EQUIPAMENTO_LABEL.manutencao_preventiva,
  manutencao_corretiva: STATUS_EQUIPAMENTO_LABEL.manutencao_corretiva,
  fora_funcionamento: STATUS_EQUIPAMENTO_LABEL.fora_funcionamento,
};

export default function Frota() {
  const { data: equipamentos = [], isLoading } = useEquipamentos();
  const { data: empresas = [] } = useEmpresas();
  const { data: fornecedores = [] } = useFornecedores();
  const { temAcao, usuario } = useAuth();
  const adicionarMutation = useAdicionarEquipamento();
  const atualizarMutation = useAtualizarEquipamento();
  const excluirMutation = useExcluirEquipamento();
  const changeStatusMutation = useChangeStatusEquipamento();

  const [busca, setBusca] = useUrlState('busca');
  const [buscaPatrimonio, setBuscaPatrimonio] = useUrlState('patrimonio');
  const [filtroEmpresa, setFiltroEmpresa] = useUrlState('empresa');
  const [categoriaRaw, setCategoriaRaw] = useUrlState('categoria');
  const categoriaFiltro = categoriaRaw as TipoEquipamento | '';
  const setCategoriaFiltro = (v: TipoEquipamento | '') => setCategoriaRaw(v);
  const [modoRaw, setModoRaw] = useUrlState('view', 'grid');
  const modoVisualizacao = (modoRaw as ModoVisualizacao) || 'grid';
  const setModoVisualizacao = (v: ModoVisualizacao) => setModoRaw(v);
  const [equipamentoSelecionado, setEquipamentoSelecionado] = useState<Equipamento | null>(null);
  const [filtroStatusRaw, setFiltroStatusRaw] = useUrlState('status', 'todos');
  const filtroStatus = (filtroStatusRaw as FiltroStatus) || 'todos';
  const setFiltroStatus = (v: FiltroStatus) => setFiltroStatusRaw(v);
  const [filtroPropRaw, setFiltroPropRaw] = useUrlState('propriedade', 'todos');
  const filtroPropriedade = (filtroPropRaw as FiltroPropriedade) || 'todos';
  const setFiltroPropriedade = (v: FiltroPropriedade) => setFiltroPropRaw(v);
  const [modalNovoOpen, setModalNovoOpen] = useState(false);
  const [editandoEquip, setEditandoEquip] = useState<Equipamento | null>(null);
  const [excluindoEquip, setExcluindoEquip] = useState<Equipamento | null>(null);
  const [filtrosAvancadosOpen, setFiltrosAvancadosOpen] = useState(false);

  const canCreate = temAcao('criar_veiculo');
  const canEdit = temAcao('editar_veiculo');
  const canDelete = temAcao('excluir_veiculo');

  async function handleChangeStatus(
    eq: Equipamento,
    status: StatusEquipamento,
    motivo: string,
    observacoes: string,
  ) {
    try {
      await changeStatusMutation.mutateAsync({
        equipamentoId: eq.id,
        statusDe: eq.status,
        statusPara: status,
        motivo,
        observacoes,
        usuarioNome: usuario?.nome ?? '',
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao atualizar status');
    }
  }

  async function handleConfirmarExclusao() {
    if (!excluindoEquip) return;
    try {
      await excluirMutation.mutateAsync(excluindoEquip.id);
      setExcluindoEquip(null);
      setEquipamentoSelecionado(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao excluir');
    }
  }

  const alertasMap = useMemo(() => new Map<string, number>(), []);

  const handleAdicionarEquipamento = useCallback(async (eq: Equipamento) => {
    await adicionarMutation.mutateAsync({ ...eq, criadoPor: usuario?.nome || '' });
    setModalNovoOpen(false);
  }, [adicionarMutation, usuario]);

  const handleEditarEquipamento = useCallback(async (eq: Equipamento) => {
    await atualizarMutation.mutateAsync(eq);
    setEditandoEquip(null);
    setEquipamentoSelecionado(null);
  }, [atualizarMutation]);

  const equipamentosFiltrados = useMemo(() => {
    let lista = equipamentos;

    if (filtroStatus !== 'todos') lista = lista.filter((e) => e.status === filtroStatus);

    if (filtroPropriedade !== 'todos') {
      lista = lista.filter((e) => e.propriedade === filtroPropriedade);
    }

    if (categoriaFiltro) {
      lista = lista.filter((e) => e.tipo === categoriaFiltro);
    }

    if (filtroEmpresa) {
      lista = lista.filter((e) => e.empresaId === filtroEmpresa);
    }

    if (busca.trim()) {
      const termo = busca.toLowerCase();
      lista = lista.filter(
        (e) =>
          e.nome.toLowerCase().includes(termo) ||
          (e.modelo ?? '').toLowerCase().includes(termo) ||
          (e.marca ?? '').toLowerCase().includes(termo)
      );
    }

    if (buscaPatrimonio.trim()) {
      const termo = buscaPatrimonio.toLowerCase();
      lista = lista.filter((e) => e.codigoPatrimonio.toLowerCase().includes(termo));
    }

    return lista;
  }, [equipamentos, filtroStatus, filtroPropriedade, categoriaFiltro, filtroEmpresa, busca, buscaPatrimonio]);

  const filtrosAtivosCount =
    (filtroStatus !== 'todos' ? 1 : 0) +
    (filtroPropriedade !== 'todos' ? 1 : 0) +
    (categoriaFiltro ? 1 : 0) +
    (filtroEmpresa ? 1 : 0) +
    (busca.trim() ? 1 : 0) +
    (buscaPatrimonio.trim() ? 1 : 0);

  function limparFiltros() {
    setBusca('');
    setBuscaPatrimonio('');
    setFiltroEmpresa('');
    setCategoriaFiltro('');
    setFiltroStatus('todos');
    setFiltroPropriedade('todos');
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[var(--color-fg-muted)] text-sm">Carregando frota...</p>
      </div>
    );
  }

  function exportarComFiltros(fn: typeof exportarFrotaPDF) {
    const filtros: string[] = [];
    if (filtroStatus !== 'todos') filtros.push(`Status: ${filtroStatus}`);
    if (filtroPropriedade !== 'todos') filtros.push(`Propriedade: ${filtroPropriedade}`);
    if (categoriaFiltro) filtros.push(`Tipo: ${categoriaFiltro}`);
    if (filtroEmpresa) {
      const nome = empresas.find((e) => e.id === filtroEmpresa)?.nome;
      if (nome) filtros.push(`Empresa: ${nome}`);
    }
    fn(equipamentosFiltrados, empresas, filtros.length > 0 ? filtros.join(' | ') : undefined);
  }

  return (
    <div className="space-y-6">
      {/* HERO HEADER */}
      <header className="rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-surface-1)] to-[var(--color-surface-2)] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight text-[var(--color-fg)] leading-tight">
              Frota
            </h1>
            <p className="text-sm text-[var(--color-fg-muted)] mt-1">
              Gestão de equipamentos próprios e alugados.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canCreate && (
              <Button onClick={() => setModalNovoOpen(true)} variant="primary">
                <Plus aria-hidden className="w-4 h-4" />
                Novo equipamento
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => exportarComFiltros(exportarFrotaPDF)}>
              <FileText aria-hidden className="w-4 h-4" />
              PDF
            </Button>
            <Button variant="secondary" size="sm" onClick={() => exportarComFiltros(exportarFrotaExcel)}>
              <Sheet aria-hidden className="w-4 h-4" />
              Excel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => exportarEtiquetasEmLotePdf(equipamentosFiltrados)}
              disabled={equipamentosFiltrados.length === 0}
              title={`Imprimir QRs · ${equipamentosFiltrados.length} equipamento(s)`}
            >
              <QrCode aria-hidden className="w-4 h-4" />
              Etiquetas QR
            </Button>
          </div>
        </div>
      </header>

      {/* KPIs */}
      <FrotaStats equipamentos={equipamentos} />

      {/* BARRA DE BUSCA + AÇÕES */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          {/* Busca principal */}
          <div className="relative flex-1 min-w-0">
            <Search aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-fg-subtle)]" />
            <input
              type="text"
              placeholder="Buscar por nome, modelo ou marca..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full h-11 pl-10 pr-9 text-sm rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)] transition-colors"
            />
            {busca && (
              <button
                onClick={() => setBusca('')}
                aria-label="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]"
              >
                <X aria-hidden className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Patrimônio */}
          <div className="relative sm:w-56">
            <Search aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-fg-subtle)]" />
            <input
              type="text"
              placeholder="Patrimônio..."
              value={buscaPatrimonio}
              onChange={(e) => setBuscaPatrimonio(e.target.value)}
              className="w-full h-11 pl-10 pr-9 text-sm font-mono rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)] transition-colors"
            />
            {buscaPatrimonio && (
              <button
                onClick={() => setBuscaPatrimonio('')}
                aria-label="Limpar"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]"
              >
                <X aria-hidden className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Toggle filtros avançados */}
          <button
            onClick={() => setFiltrosAvancadosOpen((v) => !v)}
            className={
              'inline-flex items-center gap-2 h-11 px-3 rounded-xl border text-sm font-medium transition-colors ' +
              (filtrosAvancadosOpen || filtrosAtivosCount > 0
                ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)] border-[var(--color-accent)]/30'
                : 'bg-[var(--color-surface-1)] text-[var(--color-fg-muted)] border-[var(--color-border)] hover:text-[var(--color-fg)]')
            }
            aria-expanded={filtrosAvancadosOpen}
          >
            <SlidersHorizontal aria-hidden className="w-4 h-4" />
            Filtros
            {filtrosAtivosCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[11px] font-bold bg-[var(--color-accent)] text-[var(--color-fg-on-accent)]">
                {filtrosAtivosCount}
              </span>
            )}
          </button>

          {/* Toggle de visualização */}
          <div className="inline-flex rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-0.5 h-11">
            {(['grid', 'lista'] as ModoVisualizacao[]).map((v) => {
              const ativo = modoVisualizacao === v;
              const Icon = v === 'grid' ? LayoutGrid : ListIcon;
              return (
                <button
                  key={v}
                  onClick={() => setModoVisualizacao(v)}
                  className={
                    'inline-flex items-center justify-center w-10 rounded-lg transition-colors ' +
                    (ativo
                      ? 'bg-[var(--color-fg)] text-[var(--color-surface-1)]'
                      : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]')
                  }
                  title={v === 'grid' ? 'Grid' : 'Lista'}
                  aria-label={v === 'grid' ? 'Ver em grade' : 'Ver em lista'}
                  aria-pressed={ativo}
                >
                  <Icon aria-hidden className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Filtros avançados (segmented controls) */}
        {filtrosAvancadosOpen && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[var(--color-border)]">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-fg-muted)]">
                Status
              </span>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value as FiltroStatus)}
                className="h-9 px-2.5 text-sm rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
              >
                <option value="todos">Todos</option>
                <option value="ativa">{STATUS_LABELS.ativa}</option>
                <option value="manutencao_preventiva">{STATUS_LABELS.manutencao_preventiva}</option>
                <option value="manutencao_corretiva">{STATUS_LABELS.manutencao_corretiva}</option>
                <option value="fora_funcionamento">{STATUS_LABELS.fora_funcionamento}</option>
              </select>
            </div>
            <SegmentedControl
              label="Propriedade"
              value={filtroPropriedade}
              options={(['todos', 'propria', 'alugada'] as FiltroPropriedade[]).map((v) => ({
                value: v,
                label: PROP_LABELS[v],
              }))}
              onChange={(v) => setFiltroPropriedade(v as FiltroPropriedade)}
            />
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-fg-muted)]">
                Tipo
              </span>
              <select
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value as TipoEquipamento | '')}
                className="h-9 px-2.5 text-sm rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
              >
                <option value="">Todos</option>
                {Array.from(
                  equipamentos.reduce((acc, e) => {
                    if (e.tipo) acc.set(e.tipo, (acc.get(e.tipo) ?? 0) + 1);
                    return acc;
                  }, new Map<TipoEquipamento, number>()).entries()
                )
                  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
                  .map(([t, n]) => (
                    <option key={t} value={t}>
                      {t} ({n})
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-fg-muted)]">
                Empresa
              </span>
              <select
                value={filtroEmpresa}
                onChange={(e) => setFiltroEmpresa(e.target.value)}
                className="h-9 px-2.5 text-sm rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
              >
                <option value="">Todas</option>
                {empresas
                  .filter((e) => e.ativo !== false)
                  .sort((a, b) => a.nome.localeCompare(b.nome))
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome}
                    </option>
                  ))}
              </select>
            </div>
            {filtrosAtivosCount > 0 && (
              <button
                onClick={limparFiltros}
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-danger-fg)] transition-colors ml-auto"
              >
                <X aria-hidden className="w-3.5 h-3.5" />
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* CONTEÚDO */}
      <div>
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <p className="text-sm text-[var(--color-fg-muted)]">
            <span className="font-semibold text-[var(--color-fg)]">{equipamentosFiltrados.length}</span>{' '}
            de {equipamentos.length} equipamento{equipamentos.length === 1 ? '' : 's'}
          </p>
          {(categoriaFiltro || filtroEmpresa || filtroStatus !== 'todos' || filtroPropriedade !== 'todos') && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {filtroStatus !== 'todos' && (
                <Chip label={STATUS_LABELS[filtroStatus]} onClear={() => setFiltroStatus('todos')} />
              )}
              {filtroPropriedade !== 'todos' && (
                <Chip label={PROP_LABELS[filtroPropriedade]} onClear={() => setFiltroPropriedade('todos')} />
              )}
              {categoriaFiltro && (
                <Chip label={categoriaFiltro} onClear={() => setCategoriaFiltro('')} />
              )}
              {filtroEmpresa && (
                <Chip
                  label={empresas.find((e) => e.id === filtroEmpresa)?.nome ?? '?'}
                  onClear={() => setFiltroEmpresa('')}
                />
              )}
            </div>
          )}
        </div>

        {modoVisualizacao === 'grid' ? (
          equipamentosFiltrados.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] py-16 px-6 text-center">
              <p className="text-sm font-medium text-[var(--color-fg)]">Nenhum equipamento</p>
              <p className="text-xs text-[var(--color-fg-muted)] mt-1">
                Ajuste os filtros ou cadastre um novo equipamento.
              </p>
            </div>
          ) : (
            <FrotaGrid
              equipamentos={equipamentosFiltrados}
              empresas={empresas}
              categoriaFiltro={categoriaFiltro}
              onSelect={setEquipamentoSelecionado}
              onChangeStatus={canEdit ? handleChangeStatus : undefined}
              alertasMap={alertasMap}
            />
          )
        ) : (
          <FrotaList
            equipamentos={equipamentosFiltrados}
            empresas={empresas}
            onSelect={setEquipamentoSelecionado}
            onChangeStatus={canEdit ? handleChangeStatus : undefined}
            alertasMap={alertasMap}
          />
        )}
      </div>

      <Modal
        open={!!equipamentoSelecionado}
        onClose={() => setEquipamentoSelecionado(null)}
        title={equipamentoSelecionado?.nome ?? 'Detalhes'}
        size="lg"
      >
        {equipamentoSelecionado && (
          <FrotaDetalhe
            equipamento={equipamentoSelecionado}
            empresas={empresas}
            fornecedores={fornecedores}
            onEditar={
              canEdit
                ? () => {
                    setEditandoEquip(equipamentoSelecionado);
                    setEquipamentoSelecionado(null);
                  }
                : undefined
            }
            onExcluir={
              canDelete
                ? () => setExcluindoEquip(equipamentoSelecionado)
                : undefined
            }
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!excluindoEquip}
        onClose={() => setExcluindoEquip(null)}
        onConfirm={handleConfirmarExclusao}
        title="Excluir equipamento"
        message={
          excluindoEquip
            ? `Tem certeza que deseja excluir "${excluindoEquip.nome}"${excluindoEquip.codigoPatrimonio ? ` (${excluindoEquip.codigoPatrimonio})` : ''}? Esta ação é IRREVERSÍVEL e remove o registro do banco.`
            : ''
        }
        requirePassword={false}
      />

      <Modal open={!!editandoEquip} onClose={() => setEditandoEquip(null)} title="Editar Equipamento" size="lg">
        {editandoEquip && (
          <EquipamentoFormFrota
            initial={editandoEquip}
            onSubmit={handleEditarEquipamento}
            onCancel={() => setEditandoEquip(null)}
            empresas={empresas}
            equipamentosExistentes={equipamentos}
          />
        )}
      </Modal>

      <Modal open={modalNovoOpen} onClose={() => setModalNovoOpen(false)} title="Novo Equipamento" size="lg">
        <EquipamentoFormFrota
          onSubmit={handleAdicionarEquipamento}
          onCancel={() => setModalNovoOpen(false)}
          empresas={empresas}
          equipamentosExistentes={equipamentos}
          onImportBatch={async (novos) => {
            for (const eq of novos) {
              await adicionarMutation.mutateAsync({ ...eq, criadoPor: usuario?.nome || '' });
            }
            setModalNovoOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)] border border-[var(--color-accent)]/20">
      {label}
      <button
        onClick={onClear}
        aria-label={`Remover filtro ${label}`}
        className="hover:text-[var(--color-danger-fg)]"
      >
        <X aria-hidden className="w-3 h-3" />
      </button>
    </span>
  );
}

function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-fg-muted)]">
        {label}
      </span>
      <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-0.5">
        {options.map((opt) => {
          const ativo = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={
                'px-3 h-8 rounded-md text-xs font-medium transition-colors ' +
                (ativo
                  ? 'bg-[var(--color-fg)] text-[var(--color-surface-1)]'
                  : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]')
              }
              aria-pressed={ativo}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
