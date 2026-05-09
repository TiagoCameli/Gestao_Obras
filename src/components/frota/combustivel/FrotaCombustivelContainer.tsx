import { useState, useCallback, useMemo } from 'react';
import type {
  Abastecimento,
  EntradaCombustivel,
  TransferenciaCombustivel,
  Deposito,
  SaidaCombustivel,
} from '../../../types';
import { useObras } from '../../../hooks/useObras';
import { useEtapas } from '../../../hooks/useEtapas';
import { useDepositos, useAdicionarDeposito, useAtualizarDeposito, useExcluirDeposito } from '../../../hooks/useDepositos';
// Hooks novos (Fase 3) — saídas via tabela unificada saidas_combustivel
import { useSaidasCombustivel, useAdicionarSaidaCombustivel, useAtualizarSaidaCombustivel, useExcluirSaidaCombustivel } from '../../../hooks/useSaidasCombustivel';
import { useEntradasCombustivel, useAdicionarEntradaCombustivel, useAtualizarEntradaCombustivel, useExcluirEntradaCombustivel } from '../../../hooks/useEntradasCombustivel';
import { useTransferenciasCombustivel, useAdicionarTransferenciaCombustivel, useExcluirTransferenciaCombustivel } from '../../../hooks/useTransferenciasCombustivel';
import { useEquipamentos } from '../../../hooks/useEquipamentos';
import { useFornecedores } from '../../../hooks/useFornecedores';
import { useInsumos } from '../../../hooks/useInsumos';
import { useAuth } from '../../../contexts/AuthContext';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import PasswordDialog from '../../ui/PasswordDialog';
// Saída unificada (Fase 4)
import SaidaCombustivelForm from '../../combustivel/SaidaCombustivelForm';
import SaidaCombustivelList from '../../combustivel/SaidaCombustivelList';
import EntradaForm from '../../combustivel/EntradaForm';
import EntradaList from '../../combustivel/EntradaList';
import TransferenciaForm from '../../combustivel/TransferenciaForm';
import TransferenciaList from '../../combustivel/TransferenciaList';
import TanqueList from './TanqueList';
import TanqueForm from './TanqueForm';
import ExportarPDFModal from '../../combustivel/ExportarPDFModal';
// v2 — IA premium da página /combustivel (F1+, filtros globais em F2)
import { CombustivelFilterProvider, useCombustivelFilter } from '../../combustivel/v2/filters/FilterContext';
import FilterBar from '../../combustivel/v2/filters/FilterBar';
import FilterChips from '../../combustivel/v2/filters/FilterChips';
import CombustivelTabsNav, { type CombustivelTabId } from '../../combustivel/v2/CombustivelTabsNav';
import VisaoGeralTab from '../../combustivel/v2/visao-geral/VisaoGeralTab';
import ObrasTab from '../../combustivel/v2/obras/ObrasTab';
import ConsumidoresTab from '../../combustivel/v2/consumidores/ConsumidoresTab';
import FornecedoresTab from '../../combustivel/v2/fornecedores/FornecedoresTab';
import RelatoriosTab from '../../combustivel/v2/relatorios/RelatoriosTab';
import AtribuirSentinelModal from '../../combustivel/v2/atribuicao/AtribuirSentinelModal';
import ModeSwitch from '../../combustivel/v2/ModeSwitch';
import ComingSoon from '../../combustivel/v2/ComingSoon';
import { ClipboardList } from 'lucide-react';

type SubTab = CombustivelTabId;

/** Wrapper raiz — apenas monta o Provider de filtros pra que o Content
 *  possa consumir `useCombustivelFilter()`. Toda a lógica está no Content. */
export default function FrotaCombustivelContainer() {
  return (
    <CombustivelFilterProvider>
      <FrotaCombustivelContent />
    </CombustivelFilterProvider>
  );
}

function FrotaCombustivelContent() {
  const { temAcao, usuario } = useAuth();
  const canEdit = temAcao('editar_combustivel');
  const canDelete = temAcao('excluir_combustivel');
  const canCreateEntrada = temAcao('criar_entrada_combustivel');
  const canCreateSaida = temAcao('criar_saida_combustivel');
  const canCreateTransferencia = temAcao('criar_transferencia_combustivel');

  const [subTab, setSubTab] = useState<SubTab>('visao_geral');

  // Filtros globais (URL state) — fonte única pras listas operacionais e
  // analíticas. Substitui o AbastecimentoFilters legado removido em F2.
  const { state: filterState, setApenasSentinel } = useCombustivelFilter();

  // Handler do banner sentinel + click no row "_naoid" do ranking.
  // Liga apenasSentinel + navega pra Saídas. SubTab fora da URL hoje
  // (limitação atual; F2.X depois).
  const handleAtribuirSentinels = useCallback(() => {
    setApenasSentinel(true);
    setSubTab('saidas');
  }, [setApenasSentinel]);

  const { data: obras = [] } = useObras();
  const { data: etapas = [] } = useEtapas();
  // Depositos: divididos por uso.
  // - depositosTodos (incluindo externos): pra views/lists/dashboards/exports.
  //   Garante que rows com depósito externo (Transterra) renderizam o nome.
  // - depositosOperacionais (default, só internos): pra forms que CRIAM rows.
  //   Triggers do DB bloqueiam INSERT em externos — filtro UI evita 4xx.
  const { data: depositosTodos = [] } = useDepositos({ incluirExternos: true });
  const { data: depositosOperacionais = [] } = useDepositos();
  // Saídas via tabela unificada (Fase 3) — fonte canônica.
  const { data: todasSaidas = [] } = useSaidasCombustivel();
  // Adapter inline pro shape Abastecimento legado (ExportarPDFModal ainda
  // consome — será removido quando F4 entregar a aba Relatórios).
  const todosAbastecimentos: Abastecimento[] = useMemo(
    () => todasSaidas.map((s) => ({
      id: s.id,
      dataHora: s.data,
      tipoCombustivel: s.tipoCombustivel ?? '',
      quantidadeLitros: s.litros,
      valorTotal: s.valorTotal,
      obraId: s.obraId ?? '',
      etapaId: s.etapaId ?? '',
      alocacoes: s.alocacoes ?? [],
      depositoId: s.tanqueId ?? '',
      equipamentoId: (s.equipamentoId === 'desconhecido' ? '' : (s.equipamentoId ?? '')),
      veiculo: '',
      fotosUrls: s.fotoUrls ?? [],
      observacoes: s.observacoes ?? '',
      criadoPor: s.createdBy ?? '',
      origemCombustivel: s.origem,
      fornecedor: '',
      pago: s.pago ?? false,
      dataPagamento: s.pagoEm ?? '',
      pagoPor: '',
    })),
    [todasSaidas]
  );
  const { data: todasEntradas = [] } = useEntradasCombustivel();
  const { data: todasTransferencias = [] } = useTransferenciasCombustivel();
  const { data: todosEquipamentos = [] } = useEquipamentos();
  const { data: todosFornecedores = [] } = useFornecedores();
  const { data: todosInsumos = [] } = useInsumos();

  // Transportadoras filtradas pra forms/lists de saídas
  const transportadoras = useMemo(
    () => todosFornecedores.filter((f) => f.ehTransportadora && f.ativo !== false),
    [todosFornecedores]
  );

  // Combustíveis = insumos tipo 'combustivel' ativos
  const combustiveis = useMemo(
    () => todosInsumos.filter((i) => i.tipo === 'combustivel' && i.ativo !== false),
    [todosInsumos]
  );

  // Deposito mutations
  const adicionarDepositoMut = useAdicionarDeposito();
  const atualizarDepositoMut = useAtualizarDeposito();
  const excluirDepositoMut = useExcluirDeposito();

  // Saída mutations (modelo unificado Fase 3)
  const adicionarSaidaMut = useAdicionarSaidaCombustivel();
  const atualizarSaidaMut = useAtualizarSaidaCombustivel();
  const excluirSaidaMut = useExcluirSaidaCombustivel();

  // Entrada mutations
  const adicionarEntradaMut = useAdicionarEntradaCombustivel();
  const atualizarEntradaMut = useAtualizarEntradaCombustivel();
  const excluirEntradaMut = useExcluirEntradaCombustivel();

  // Transferencia mutations
  const adicionarTransferenciaMut = useAdicionarTransferenciaCombustivel();
  const excluirTransferenciaMut = useExcluirTransferenciaCombustivel();

  // Tanque state
  const [modalTanqueOpen, setModalTanqueOpen] = useState(false);
  const [editandoTanque, setEditandoTanque] = useState<Deposito | null>(null);

  // Saida state (modelo unificado Fase 3/4)
  const [modalSaidaOpen, setModalSaidaOpen] = useState(false);
  const [editandoSaida, setEditandoSaida] = useState<SaidaCombustivel | null>(null);

  // Entrada state
  const [modalEntradaOpen, setModalEntradaOpen] = useState(false);
  const [editandoEntrada, setEditandoEntrada] = useState<EntradaCombustivel | null>(null);

  // Transferencia state
  const [modalTransferenciaOpen, setModalTransferenciaOpen] = useState(false);

  // Exportar state
  const [modalExportarOpen, setModalExportarOpen] = useState(false);

  // Atribuição retroativa em batch (F2.B.2)
  const [modalAtribuirOpen, setModalAtribuirOpen] = useState(false);

  // Password gate
  const [senhaOpen, setSenhaOpen] = useState(false);
  const [senhaAction, setSenhaAction] = useState<(() => void) | null>(null);

  function pedirSenha(action: () => void) {
    if (usuario?.cargo === 'Administrador') {
      action();
      return;
    }
    setSenhaAction(() => action);
    setSenhaOpen(true);
  }

  // Filtragem das listas operacionais — agora consome filterState (Context)
  // em vez do legado <AbastecimentoFilters>. Default 30d herdado do preset
  // 'ultimos_30' resolve o "lista abre com tudo".
  const periodoFromTs = useMemo(() => new Date(filterState.periodo.from + 'T00:00:00').getTime(), [filterState.periodo.from]);
  const periodoToTs = useMemo(() => new Date(filterState.periodo.to + 'T23:59:59').getTime(), [filterState.periodo.to]);

  function dentroPeriodo(iso: string): boolean {
    const t = new Date(iso).getTime();
    return t >= periodoFromTs && t <= periodoToTs;
  }

  const tipoConsumidorAlvo = filterState.mode === 'proprios' ? 'equipamento_proprio' : 'carreta_transportadora';

  const saidasFiltradas = useMemo(() => {
    return todasSaidas.filter((s) => {
      if (s.tipoConsumidor !== tipoConsumidorAlvo) return false;
      if (!dentroPeriodo(s.data)) return false;
      if (filterState.obraIds.length > 0 && !(s.obraId && filterState.obraIds.includes(s.obraId))) return false;
      if (filterState.tipoCombustiveis.length > 0 && !filterState.tipoCombustiveis.includes(s.tipoCombustivel)) return false;
      if (filterState.tanqueIds.length > 0 && !(s.tanqueId && filterState.tanqueIds.includes(s.tanqueId))) return false;
      // Sentinel mode: força sem-equipamento e ignora equipamentoIds.
      if (filterState.apenasSentinel) {
        if (s.equipamentoId !== 'desconhecido') return false;
      } else if (filterState.equipamentoIds.length > 0) {
        if (!s.equipamentoId || !filterState.equipamentoIds.includes(s.equipamentoId)) return false;
      }
      if (filterState.transportadoraIds.length > 0) {
        if (!s.transportadoraId || !filterState.transportadoraIds.includes(s.transportadoraId)) return false;
      }
      if (filterState.placas.length > 0) {
        const placa = (s.placa || '').trim();
        if (!placa || !filterState.placas.includes(placa)) return false;
      }
      if (filterState.operadores.length > 0) {
        const op = (s.motorista || '').trim();
        if (!op || !filterState.operadores.includes(op)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todasSaidas, tipoConsumidorAlvo, periodoFromTs, periodoToTs, filterState.obraIds, filterState.tipoCombustiveis, filterState.tanqueIds, filterState.equipamentoIds, filterState.transportadoraIds, filterState.placas, filterState.operadores, filterState.apenasSentinel]);

  // Adapter pro shape Abastecimento legado (ExportarPDFModal). Filtra os
  // mesmos critérios da Saída — quando F4 entregar a aba Relatórios o modal
  // legado morre junto com esse adapter.
  const abastecimentosFiltrados = useMemo(() => {
    const ids = new Set(saidasFiltradas.map((s) => s.id));
    return todosAbastecimentos.filter((a) => ids.has(a.id));
  }, [todosAbastecimentos, saidasFiltradas]);

  const entradasFiltradas = useMemo(() => {
    return todasEntradas.filter((e) => {
      if (!dentroPeriodo(e.dataHora)) return false;
      if (filterState.tipoCombustiveis.length > 0 && !filterState.tipoCombustiveis.includes(e.tipoCombustivel)) return false;
      if (filterState.tanqueIds.length > 0 && !(e.depositoId && filterState.tanqueIds.includes(e.depositoId))) return false;
      if (filterState.fornecedores.length > 0) {
        const f = (e.fornecedor || '').trim();
        if (!f || !filterState.fornecedores.includes(f)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todasEntradas, periodoFromTs, periodoToTs, filterState.tipoCombustiveis, filterState.tanqueIds, filterState.fornecedores]);

  const transferenciasFiltradas = useMemo(() => {
    return todasTransferencias.filter((t) => {
      if (!dentroPeriodo(t.dataHora)) return false;
      if (filterState.tanqueOrigemIds.length > 0 && !filterState.tanqueOrigemIds.includes(t.depositoOrigemId)) return false;
      if (filterState.tanqueDestinoIds.length > 0 && !filterState.tanqueDestinoIds.includes(t.depositoDestinoId)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todasTransferencias, periodoFromTs, periodoToTs, filterState.tanqueOrigemIds, filterState.tanqueDestinoIds]);

  // Listas distinct pra alimentar o multi-select da FilterBar v2.
  const fornecedoresDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const e of todasEntradas) {
      const v = (e.fornecedor || '').trim();
      if (v) set.add(v);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [todasEntradas]);

  const operadoresDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const s of todasSaidas) {
      const v = (s.motorista || '').trim();
      if (v) set.add(v);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [todasSaidas]);

  // Placas distinct (apenas saídas de carreta — onde placa faz sentido).
  const placasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const s of todasSaidas) {
      if (s.tipoConsumidor !== 'carreta_transportadora') continue;
      const v = (s.placa || '').trim();
      if (v) set.add(v);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [todasSaidas]);

  // Maps id→label pra resolver chips de filtro globais
  const obrasMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);
  const equipamentosMap = useMemo(() => new Map(todosEquipamentos.map((e) => [e.id, e.nome])), [todosEquipamentos]);
  const insumosMap = useMemo(() => new Map(todosInsumos.map((i) => [i.id, i.nome])), [todosInsumos]);
  const transportadorasMap = useMemo(() => new Map(transportadoras.map((t) => [t.id, t.nome])), [transportadoras]);
  const tanquesMap = useMemo(() => new Map(depositosTodos.map((d) => [d.id, d.nome])), [depositosTodos]);

  // Tanque handlers
  const handleSubmitTanque = useCallback(
    async (deposito: Deposito) => {
      if (editandoTanque) {
        await atualizarDepositoMut.mutateAsync(deposito);
      } else {
        await adicionarDepositoMut.mutateAsync({ ...deposito, criadoPor: usuario?.nome || '' });
      }
      setModalTanqueOpen(false);
      setEditandoTanque(null);
    },
    [editandoTanque, atualizarDepositoMut, adicionarDepositoMut, usuario]
  );

  const handleEditTanque = useCallback((deposito: Deposito) => {
    pedirSenha(() => {
      setEditandoTanque(deposito);
      setModalTanqueOpen(true);
    });
  }, []);

  const handleDeleteTanque = useCallback(
    async (id: string) => {
      pedirSenha(async () => {
        await excluirDepositoMut.mutateAsync(id);
      });
    },
    [excluirDepositoMut]
  );

  // Saida handlers (modelo unificado SaidaCombustivel)
  const handleSubmitSaida = useCallback(
    async (saida: SaidaCombustivel) => {
      if (editandoSaida) {
        // F5.A.0: rastreia quem alterou. Atribuição retroativa em batch
        // (F2.B.2) também passa por aqui — todo UPDATE seta updated_by.
        await atualizarSaidaMut.mutateAsync({ ...saida, updatedBy: usuario?.nome || null });
      } else {
        await adicionarSaidaMut.mutateAsync({ ...saida, createdBy: usuario?.nome || null });
      }
      setModalSaidaOpen(false);
      setEditandoSaida(null);
    },
    [editandoSaida, atualizarSaidaMut, adicionarSaidaMut, usuario]
  );

  const handleEditSaida = useCallback((s: SaidaCombustivel) => {
    pedirSenha(() => {
      setEditandoSaida(s);
      setModalSaidaOpen(true);
    });
  }, []);

  const handleDeleteSaida = useCallback(
    async (id: string) => {
      await excluirSaidaMut.mutateAsync(id);
    },
    [excluirSaidaMut]
  );

  // Entrada handlers
  const handleSubmitEntrada = useCallback(
    async (data: EntradaCombustivel) => {
      if (editandoEntrada) {
        await atualizarEntradaMut.mutateAsync(data);
      } else {
        await adicionarEntradaMut.mutateAsync({ ...data, criadoPor: usuario?.nome || '' });
      }
      setModalEntradaOpen(false);
      setEditandoEntrada(null);
    },
    [editandoEntrada, atualizarEntradaMut, adicionarEntradaMut, usuario]
  );

  const handleEditEntrada = useCallback((ent: EntradaCombustivel) => {
    pedirSenha(() => {
      setEditandoEntrada(ent);
      setModalEntradaOpen(true);
    });
  }, []);

  const handleDeleteEntrada = useCallback(
    async (id: string) => {
      await excluirEntradaMut.mutateAsync(id);
    },
    [excluirEntradaMut]
  );

  // Transferencia handlers
  const handleSubmitTransferencia = useCallback(
    async (data: TransferenciaCombustivel) => {
      await adicionarTransferenciaMut.mutateAsync({ ...data, criadoPor: usuario?.nome || '' });
      setModalTransferenciaOpen(false);
    },
    [adicionarTransferenciaMut, usuario]
  );

  const handleDeleteTransferencia = useCallback(
    async (id: string) => {
      await excluirTransferenciaMut.mutateAsync(id);
    },
    [excluirTransferenciaMut]
  );

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 px-3 sm:px-4 pt-1">
        {canCreateEntrada && (
          <Button
            onClick={() => { setEditandoEntrada(null); setModalEntradaOpen(true); }}
            className="text-sm"
          >
            + Nova Entrada
          </Button>
        )}
        {canCreateSaida && (
          <Button
            onClick={() => { setEditandoSaida(null); setModalSaidaOpen(true); }}
            className="text-sm"
          >
            + Nova Saída
          </Button>
        )}
        {canCreateTransferencia && (
          <Button
            onClick={() => setModalTransferenciaOpen(true)}
            className="text-sm"
          >
            + Nova Transferência
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() => setModalExportarOpen(true)}
          className="text-sm"
        >
          Exportar Relatório
        </Button>
      </div>

      {/* Mode switch — separa "dois mundos" da operação (proprios vs carretas).
          Compartilha tanques. */}
      <div className="px-3 sm:px-4">
        <ModeSwitch />
      </div>

      {/* Barra global de filtros (sticky) — fonte única em toda a página
          (analítico + operacional). Tanque origem/destino só aparecem na
          aba Transferências. */}
      <FilterBar
        obras={obras}
        equipamentos={todosEquipamentos}
        combustiveis={combustiveis}
        fornecedoresDisponiveis={fornecedoresDisponiveis}
        operadoresDisponiveis={operadoresDisponiveis}
        transportadoras={transportadoras}
        placasDisponiveis={placasDisponiveis}
        depositos={depositosTodos}
        activeTab={subTab}
      />
      <FilterChips
        obrasMap={obrasMap}
        equipamentosMap={equipamentosMap}
        insumosMap={insumosMap}
        transportadorasMap={transportadorasMap}
        tanquesMap={tanquesMap}
      />

      {/* Sub-tab navigation v2 */}
      <div className="px-3 sm:px-4">
        <CombustivelTabsNav active={subTab} onChange={setSubTab} />
      </div>

      {/* Sub-tab content */}
      <div className="px-3 sm:px-4">
      {subTab === 'visao_geral' && (
        <VisaoGeralTab
          saidas={todasSaidas}
          entradas={todasEntradas}
          obras={obras}
          equipamentos={todosEquipamentos}
          transportadoras={transportadoras}
          combustiveis={combustiveis}
          onVerTodasSaidas={() => setSubTab('saidas')}
          onAtribuirSentinels={handleAtribuirSentinels}
        />
      )}

      {subTab === 'consumidores' && (
        <ConsumidoresTab
          saidas={todasSaidas}
          obras={obras}
          equipamentos={todosEquipamentos}
          transportadoras={transportadoras}
          combustiveis={combustiveis}
          onAtribuirSentinels={handleAtribuirSentinels}
        />
      )}

      {subTab === 'obras' && (
        <ObrasTab
          saidas={todasSaidas}
          obras={obras}
          equipamentos={todosEquipamentos}
          transportadoras={transportadoras}
        />
      )}

      {subTab === 'fornecedores' && (
        <FornecedoresTab entradas={todasEntradas} />
      )}

      {subTab === 'anomalias' && (
        <ComingSoon
          phase="F3"
          title="Anomalias e Insights"
          description="Equipamentos com consumo crescente, fornecedores acima da média, detecção de gastos fora do padrão. Cálculo cliente-side via histórico de medição."
        />
      )}

      {subTab === 'relatorios' && (
        <RelatoriosTab
          saidas={todasSaidas}
          entradas={todasEntradas}
          equipamentos={todosEquipamentos}
          transportadoras={transportadoras}
          obras={obras}
          combustiveis={combustiveis}
        />
      )}

      {subTab === 'tanques' && (
        <TanqueList
          depositos={
            filterState.tanqueIds.length > 0
              ? depositosTodos.filter((d) => filterState.tanqueIds.includes(d.id))
              : depositosTodos
          }
          onEdit={handleEditTanque}
          onDelete={(id) => handleDeleteTanque(id)}
          canEdit={canEdit}
          canDelete={canDelete}
          onNovo={() => { setEditandoTanque(null); setModalTanqueOpen(true); }}
          canCreate={canCreateEntrada}
        />
      )}

      {subTab === 'entradas' && (
        <EntradaList
          entradas={entradasFiltradas}
          depositos={depositosTodos}
          onEdit={handleEditEntrada}
          onDelete={(id) => pedirSenha(() => handleDeleteEntrada(id))}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}

      {subTab === 'saidas' && (
        <>
          {/* F2.B.2: toolbar inline pra atribuição retroativa em batch.
              Aparece só quando o usuário está olhando o subset sentinel
              (apenasSentinel=true) e em mode=proprios. */}
          {filterState.apenasSentinel && filterState.mode === 'proprios' && saidasFiltradas.length > 0 && (
            <div className="mb-3 rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <span className="font-semibold tabular-nums">{saidasFiltradas.length}</span>{' '}
                saída{saidasFiltradas.length !== 1 ? 's' : ''} sem equipamento no escopo atual.
                Atribuir em lote economiza edição linha-a-linha.
              </div>
              <Button
                type="button"
                onClick={() => setModalAtribuirOpen(true)}
                className="text-sm inline-flex items-center gap-1.5"
              >
                <ClipboardList className="w-4 h-4" />
                Atribuir todas em lote ({saidasFiltradas.length})
              </Button>
            </div>
          )}
          <SaidaCombustivelList
            saidas={saidasFiltradas}
            obras={obras}
            depositos={depositosTodos}
            equipamentos={todosEquipamentos}
            transportadoras={transportadoras}
            combustiveis={combustiveis}
            onEdit={handleEditSaida}
            onDelete={(id) => pedirSenha(() => handleDeleteSaida(id))}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </>
      )}

      {subTab === 'transferencias' && (
        <TransferenciaList
          transferencias={transferenciasFiltradas}
          depositos={depositosTodos}
          onDelete={(id) => pedirSenha(() => handleDeleteTransferencia(id))}
          canDelete={canDelete}
        />
      )}
      </div>

      {/* Password dialog */}
      <PasswordDialog
        open={senhaOpen}
        onClose={() => { setSenhaOpen(false); setSenhaAction(null); }}
        onSuccess={() => {
          if (senhaAction) senhaAction();
          setSenhaAction(null);
        }}
        title="Senha de Edição"
      />

      {/* Modal Tanque */}
      <Modal
        open={modalTanqueOpen}
        onClose={() => { setModalTanqueOpen(false); setEditandoTanque(null); }}
        title={editandoTanque ? 'Editar Tanque' : 'Novo Tanque de Combustível'}
      >
        <TanqueForm
          initial={editandoTanque}
          onSubmit={handleSubmitTanque}
          onCancel={() => { setModalTanqueOpen(false); setEditandoTanque(null); }}
        />
      </Modal>

      {/* Modal Saida (form unificado Fase 4) */}
      <Modal
        open={modalSaidaOpen}
        onClose={() => { setModalSaidaOpen(false); setEditandoSaida(null); }}
        title={editandoSaida ? 'Editar Saída' : 'Nova Saída de Combustível'}
        size="lg"
      >
        <SaidaCombustivelForm
          initial={editandoSaida}
          onSubmit={handleSubmitSaida}
          onCancel={() => { setModalSaidaOpen(false); setEditandoSaida(null); }}
          obras={obras}
          etapas={etapas}
          depositos={depositosTodos}
          equipamentos={todosEquipamentos}
          transportadoras={transportadoras}
          combustiveis={combustiveis}
          entradasCombustivel={todasEntradas}
        />
      </Modal>

      {/* Modal Entrada */}
      <Modal
        open={modalEntradaOpen}
        onClose={() => { setModalEntradaOpen(false); setEditandoEntrada(null); }}
        title={editandoEntrada ? 'Editar Entrada' : 'Nova Entrada de Combustível'}
      >
        <EntradaForm
          initial={editandoEntrada}
          onSubmit={handleSubmitEntrada}
          onCancel={() => { setModalEntradaOpen(false); setEditandoEntrada(null); }}
          depositos={depositosOperacionais}
          onImportBatch={async (items) => {
            for (const item of items) {
              await adicionarEntradaMut.mutateAsync({ ...item, criadoPor: usuario?.nome || '' });
            }
            setModalEntradaOpen(false);
            setEditandoEntrada(null);
          }}
        />
      </Modal>

      {/* Modal Transferencia */}
      <Modal
        open={modalTransferenciaOpen}
        onClose={() => setModalTransferenciaOpen(false)}
        title="Nova Transferência de Combustível"
      >
        <TransferenciaForm
          onSubmit={handleSubmitTransferencia}
          onCancel={() => setModalTransferenciaOpen(false)}
          depositos={depositosOperacionais}
          onImportBatch={async (items) => {
            for (const item of items) {
              await adicionarTransferenciaMut.mutateAsync({ ...item, criadoPor: usuario?.nome || '' });
            }
            setModalTransferenciaOpen(false);
          }}
        />
      </Modal>

      {/* Modal Atribuir Sentinel em batch (F2.B.2) */}
      <AtribuirSentinelModal
        open={modalAtribuirOpen}
        onClose={() => setModalAtribuirOpen(false)}
        saidasSentinel={saidasFiltradas}
        equipamentos={todosEquipamentos}
        depositos={depositosTodos}
        obras={obras}
      />

      {/* Modal Exportar Relatório */}
      <ExportarPDFModal
        open={modalExportarOpen}
        onClose={() => setModalExportarOpen(false)}
        abastecimentos={abastecimentosFiltrados}
        entradas={entradasFiltradas}
        transferencias={transferenciasFiltradas}
        obras={obras}
        depositos={depositosTodos}
      />
    </div>
  );
}
