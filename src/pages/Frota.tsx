import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUrlState } from '../hooks/useUrlState';
import type { Equipamento, TipoEquipamento } from '../types';
import { useEquipamentos, useAdicionarEquipamento, useAtualizarEquipamento } from '../hooks/useEquipamentos';
import { useEmpresas } from '../hooks/useEmpresas';
import { usePlanosManutencao, useHistoricoMedicoes } from '../hooks/useManutencao';
import { useAuth } from '../contexts/AuthContext';
import { contarAlertasEquipamento } from '../utils/manutencao';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import FrotaStats from '../components/frota/FrotaStats';
import FrotaCategoryPills from '../components/frota/FrotaCategoryPills';
import FrotaGrid from '../components/frota/FrotaGrid';
import FrotaList from '../components/frota/FrotaList';
import FrotaDetalhe from '../components/frota/FrotaDetalhe';
import EquipamentoFormFrota from '../components/frota/EquipamentoFormFrota';
import ManutencaoContainer from '../components/frota/manutencao/ManutencaoContainer';
import FrotaCombustivelContainer from '../components/frota/combustivel/FrotaCombustivelContainer';
import { exportarFrotaPDF, exportarFrotaExcel } from '../utils/frotaExport';

type MainTab = 'equipamentos' | 'manutencao' | 'combustivel';
type ModoVisualizacao = 'grid' | 'lista';
type FiltroAtivo = 'todos' | 'ativos' | 'inativos';

export default function Frota() {
  const { data: equipamentos = [], isLoading } = useEquipamentos();
  const { data: empresas = [] } = useEmpresas();
  const { data: planos = [] } = usePlanosManutencao();
  const { data: medicoes = [] } = useHistoricoMedicoes();
  const { temAcao, usuario } = useAuth();
  const adicionarMutation = useAdicionarEquipamento();
  const atualizarMutation = useAtualizarEquipamento();

  // Main tab via URL
  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs: MainTab[] = ['equipamentos', 'manutencao', 'combustivel'];
  const tabParam = searchParams.get('tab') as MainTab | null;
  const mainTab: MainTab = tabParam && validTabs.includes(tabParam) ? tabParam : 'equipamentos';
  const setMainTab = useCallback(
    (t: MainTab) => setSearchParams({ tab: t }, { replace: true }),
    [setSearchParams]
  );

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
  const [filtroAtivoRaw, setFiltroAtivoRaw] = useUrlState('ativo', 'todos');
  const filtroAtivo = (filtroAtivoRaw as FiltroAtivo) || 'todos';
  const setFiltroAtivo = (v: FiltroAtivo) => setFiltroAtivoRaw(v);
  const [modalNovoOpen, setModalNovoOpen] = useState(false);
  const [editandoEquip, setEditandoEquip] = useState<Equipamento | null>(null);

  const canCreate = temAcao('criar_cadastros');
  const canEdit = temAcao('editar_cadastros');

  // Alertas map for badges
  const alertasMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const eq of equipamentos) {
      const count = contarAlertasEquipamento(eq.id, planos, medicoes);
      if (count > 0) map.set(eq.id, count);
    }
    return map;
  }, [equipamentos, planos, medicoes]);

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

    if (filtroAtivo === 'ativos') lista = lista.filter((e) => e.ativo);
    else if (filtroAtivo === 'inativos') lista = lista.filter((e) => !e.ativo);

    if (categoriaFiltro) {
      lista = lista.filter((e) => e.tipo === categoriaFiltro);
    }

    if (filtroEmpresa) {
      lista = lista.filter((e) => e.empresaId === filtroEmpresa);
    }

    if (busca.trim()) {
      const termo = busca.toLowerCase();
      lista = lista.filter((e) => e.nome.toLowerCase().includes(termo));
    }

    if (buscaPatrimonio.trim()) {
      const termo = buscaPatrimonio.toLowerCase();
      lista = lista.filter((e) => e.codigoPatrimonio.toLowerCase().includes(termo));
    }

    return lista;
  }, [equipamentos, filtroAtivo, categoriaFiltro, filtroEmpresa, busca, buscaPatrimonio]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[var(--color-fg-muted)]">Carregando frota...</p>
      </div>
    );
  }

  const mainTabs: { key: MainTab; label: string }[] = [
    { key: 'equipamentos', label: 'Equipamentos' },
    { key: 'manutencao', label: 'Manutenção' },
    { key: 'combustivel', label: 'Combustível' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight text-[var(--color-fg)]">Frota</h1>
        {mainTab === 'equipamentos' && (
          <div className="flex items-center gap-2 flex-wrap">
            {canCreate && (
              <Button onClick={() => setModalNovoOpen(true)} className="text-sm">
                + Novo Equipamento
              </Button>
            )}
            {/* Export buttons */}
            <Button
              variant="secondary"
              className="text-sm"
              onClick={() => {
                const filtros: string[] = [];
                if (filtroAtivo !== 'todos') filtros.push(`Status: ${filtroAtivo}`);
                if (categoriaFiltro) filtros.push(`Tipo: ${categoriaFiltro}`);
                if (filtroEmpresa) {
                  const nome = empresas.find((e) => e.id === filtroEmpresa)?.nome;
                  if (nome) filtros.push(`Empresa: ${nome}`);
                }
                exportarFrotaPDF(equipamentosFiltrados, empresas, filtros.length > 0 ? filtros.join(' | ') : undefined);
              }}
            >
              Exportar PDF
            </Button>
            <Button
              variant="secondary"
              className="text-sm"
              onClick={() => {
                const filtros: string[] = [];
                if (filtroAtivo !== 'todos') filtros.push(`Status: ${filtroAtivo}`);
                if (categoriaFiltro) filtros.push(`Tipo: ${categoriaFiltro}`);
                if (filtroEmpresa) {
                  const nome = empresas.find((e) => e.id === filtroEmpresa)?.nome;
                  if (nome) filtros.push(`Empresa: ${nome}`);
                }
                exportarFrotaExcel(equipamentosFiltrados, empresas, filtros.length > 0 ? filtros.join(' | ') : undefined);
              }}
            >
              Exportar Excel
            </Button>
            {/* Status filter */}
            <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden text-sm">
              {(['todos', 'ativos', 'inativos'] as FiltroAtivo[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFiltroAtivo(f)}
                  className={`px-3 py-1.5 capitalize transition-colors ${
                    filtroAtivo === f
                      ? 'bg-[var(--color-accent)] text-[var(--color-fg-on-accent)]'
                      : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            {/* View toggle */}
            <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
              <button
                onClick={() => setModoVisualizacao('grid')}
                className={`p-2 transition-colors ${
                  modoVisualizacao === 'grid'
                    ? 'bg-[var(--color-accent)] text-[var(--color-fg-on-accent)]'
                    : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)]'
                }`}
                title="Grid"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setModoVisualizacao('lista')}
                className={`p-2 transition-colors ${
                  modoVisualizacao === 'lista'
                    ? 'bg-[var(--color-accent)] text-[var(--color-fg-on-accent)]'
                    : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)]'
                }`}
                title="Lista"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg p-1 w-fit overflow-x-auto">
        {mainTabs.map((t) => (
          <button
            key={t.key}
            className={`px-5 py-2.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              mainTab === t.key
                ? 'bg-[var(--color-surface-1)] text-[var(--color-fg)] shadow-sm'
                : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
            }`}
            onClick={() => setMainTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {mainTab === 'equipamentos' && (
        <>
          {/* Stats */}
          <FrotaStats equipamentos={equipamentos} />

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Filtrar por nome..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full h-[44px] border border-[var(--color-border)] bg-[var(--color-surface-1)] text-[var(--color-fg)] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
            />
            <input
              type="text"
              placeholder="Filtrar por patrimônio..."
              value={buscaPatrimonio}
              onChange={(e) => setBuscaPatrimonio(e.target.value)}
              className="w-full h-[44px] border border-[var(--color-border)] bg-[var(--color-surface-1)] text-[var(--color-fg)] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
            />
            <select
              value={filtroEmpresa}
              onChange={(e) => setFiltroEmpresa(e.target.value)}
              className="w-full h-[44px] border border-[var(--color-border)] bg-[var(--color-surface-1)] text-[var(--color-fg)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
            >
              <option value="">Todas as empresas</option>
              {empresas
                .filter((e) => e.ativo !== false)
                .sort((a, b) => a.nome.localeCompare(b.nome))
                .map((e) => (
                  <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
            </select>
            <select
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value as TipoEquipamento | '')}
              className="w-full h-[44px] border border-[var(--color-border)] bg-[var(--color-surface-1)] text-[var(--color-fg)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
            >
              <option value="">Todos os tipos</option>
              {Array.from(new Set(equipamentos.map((e) => e.tipo).filter(Boolean)))
                .sort((a, b) => a.localeCompare(b))
                .map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
            </select>
          </div>

          {/* Category pills */}
          <FrotaCategoryPills
            equipamentos={filtroAtivo === 'ativos' ? equipamentos.filter((e) => e.ativo) : filtroAtivo === 'inativos' ? equipamentos.filter((e) => !e.ativo) : equipamentos}
            categoriaFiltro={categoriaFiltro}
            onSelect={setCategoriaFiltro}
          />

          {/* Content */}
          {modoVisualizacao === 'grid' ? (
            <FrotaGrid
              equipamentos={equipamentosFiltrados}
              empresas={empresas}
              categoriaFiltro={categoriaFiltro}
              onSelect={setEquipamentoSelecionado}
              alertasMap={alertasMap}
            />
          ) : (
            <FrotaList
              equipamentos={equipamentosFiltrados}
              empresas={empresas}
              onSelect={setEquipamentoSelecionado}
              alertasMap={alertasMap}
            />
          )}

          {/* Empty state */}
          {equipamentosFiltrados.length === 0 && modoVisualizacao === 'grid' && (
            <div className="text-center py-12 text-gray-400 dark:text-slate-500">
              Nenhum equipamento encontrado.
            </div>
          )}

          {/* Detail modal */}
          <Modal
            open={!!equipamentoSelecionado}
            onClose={() => setEquipamentoSelecionado(null)}
            title={equipamentoSelecionado?.nome ?? 'Detalhes'}
          >
            {equipamentoSelecionado && (
              <FrotaDetalhe
                equipamento={equipamentoSelecionado}
                empresas={empresas}
                onEditar={canEdit ? () => {
                  setEditandoEquip(equipamentoSelecionado);
                  setEquipamentoSelecionado(null);
                } : undefined}
              />
            )}
          </Modal>

          {/* Edit equipment modal */}
          <Modal
            open={!!editandoEquip}
            onClose={() => setEditandoEquip(null)}
            title="Editar Equipamento"
          >
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

          {/* New equipment modal */}
          <Modal
            open={modalNovoOpen}
            onClose={() => setModalNovoOpen(false)}
            title="Novo Equipamento"
          >
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
        </>
      )}

      {mainTab === 'manutencao' && <ManutencaoContainer />}

      {mainTab === 'combustivel' && <FrotaCombustivelContainer />}
    </div>
  );
}
