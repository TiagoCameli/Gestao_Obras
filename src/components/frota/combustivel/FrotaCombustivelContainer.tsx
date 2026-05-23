import { useState, useCallback, useMemo } from 'react';
import type {
  EntradaCombustivel,
  TransferenciaCombustivel,
  Deposito,
  SaidaCombustivel,
} from '../../../types';
import { useToast } from '../../ui/Toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../shadcn/dialog';
import { useObras } from '../../../hooks/useObras';
import { useEtapas } from '../../../hooks/useEtapas';
import { useDepositos, useAdicionarDeposito, useAtualizarDeposito, useExcluirDeposito } from '../../../hooks/useDepositos';
// Hooks novos (Fase 3) — saídas via tabela unificada saidas_combustivel
import { useSaidasCombustivel, useAdicionarSaidaCombustivel, useAtualizarSaidaCombustivel, useExcluirSaidaCombustivel, useRegistrarSaidaFIFO } from '../../../hooks/useSaidasCombustivel';
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
import SaidaCombustivelListV2 from '../../combustivel/SaidaCombustivelListV2';
import SaidaDetalhesDrawer from '../../combustivel/SaidaDetalhesDrawer';
import EntradaForm from '../../combustivel/EntradaForm';
import EntradaListV2 from '../../combustivel/EntradaListV2';
import EntradaDetalhesDrawer from '../../combustivel/EntradaDetalhesDrawer';
import TransferenciaForm from '../../combustivel/TransferenciaForm';
import TransferenciaListV2 from '../../combustivel/TransferenciaListV2';
import TransferenciaDetalhesDrawer from '../../combustivel/TransferenciaDetalhesDrawer';
import TanqueList from './TanqueList';
import TanqueForm from './TanqueForm';
import TanqueDetalhesDrawer from './TanqueDetalhesDrawer';
// v2 — IA premium da página /combustivel (F1+, filtros globais em F2)
import { CombustivelFilterProvider, useCombustivelFilter } from '../../combustivel/v2/filters/FilterContext';
import FilterBar from '../../combustivel/v2/filters/FilterBar';
import FilterChips from '../../combustivel/v2/filters/FilterChips';
import CombustivelTabsNav, { type CombustivelTabId } from '../../combustivel/v2/CombustivelTabsNav';
import VisaoGeralTab from '../../combustivel/v2/visao-geral/VisaoGeralTab';
import LixeiraTab from '../../combustivel/v2/lixeira/LixeiraTab';
import ErrorState from '../../combustivel/v2/shared/ErrorState';
import SkeletonBlock from '../../combustivel/v2/shared/SkeletonBlock';
import CombustivelErrorBoundary from '../../combustivel/v2/shared/CombustivelErrorBoundary';
import ObrasTab from '../../combustivel/v2/obras/ObrasTab';
import ConsumidoresTab from '../../combustivel/v2/consumidores/ConsumidoresTab';
import FornecedoresTab from '../../combustivel/v2/fornecedores/FornecedoresTab';
import RelatoriosTab from '../../combustivel/v2/relatorios/RelatoriosTab';
import AtribuirSentinelModal from '../../combustivel/v2/atribuicao/AtribuirSentinelModal';
import ModeSwitch from '../../combustivel/v2/ModeSwitch';
import AnomaliasTab from '../../combustivel/v2/anomalias/AnomaliasTab';
import type { Severidade } from '../../combustivel/v2/anomalias/detect';
import {
  useAnomaliasChecks,
  useMarcarAnomaliaVerificada,
  useDesfazerVerificacaoAnomalia,
} from '../../../hooks/useAnomaliasChecks';
import { ClipboardList } from 'lucide-react';

type SubTab = CombustivelTabId;

/** Wrapper raiz — Error Boundary + Provider de filtros. ErrorBoundary captura
 *  erros runtime que escapem dos try/catch locais (último recurso anti-white
 *  screen). Provider expõe useCombustivelFilter pro Content. */
export default function FrotaCombustivelContainer() {
  return (
    <CombustivelErrorBoundary>
      <CombustivelFilterProvider>
        <FrotaCombustivelContent />
      </CombustivelFilterProvider>
    </CombustivelErrorBoundary>
  );
}

function FrotaCombustivelContent() {
  const { temAcao, usuario } = useAuth();
  const canEdit = temAcao('editar_combustivel');
  const canDelete = temAcao('excluir_combustivel');
  const canCreateEntrada = temAcao('criar_entrada_combustivel');
  const canCreateSaida = temAcao('criar_saida_combustivel');
  const canCreateTransferencia = temAcao('criar_transferencia_combustivel');
  const { showToast } = useToast();

  // Confirm dialog state — substitui window.confirm() em pedirSenha (admin bypass).
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Prompt dialog state — substitui window.prompt() em handleMarcarVerificada.
  const [promptState, setPromptState] = useState<{
    open: boolean;
    title: string;
    placeholder: string;
    onConfirm: (value: string) => void;
  } | null>(null);
  const [promptValue, setPromptValue] = useState('');

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

  // F3.C.1 — Pré-filtro de severity quando user clica no KPI Anomalias da VG.
  // Quando vira !=null, AnomaliasTab consome via useEffect e zera de volta
  // pra null, evitando re-aplicar em re-renders.
  const [anomaliasSeverityPrefill, setAnomaliasSeverityPrefill] = useState<Severidade[] | null>(null);
  const handleNavigateToAnomalias = useCallback(
    (severityPrefill: Severidade[]) => {
      setAnomaliasSeverityPrefill(severityPrefill.length > 0 ? severityPrefill : null);
      setSubTab('anomalias');
    },
    [],
  );

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
  const saidasQuery = useSaidasCombustivel();
  const todasSaidas = saidasQuery.data ?? [];
  const entradasQuery = useEntradasCombustivel();
  const todasEntradas = entradasQuery.data ?? [];
  const transferenciasQuery = useTransferenciasCombustivel();
  const todasTransferencias = transferenciasQuery.data ?? [];

  // F6.A — agrega loading/error das 3 queries críticas do módulo. KPI/charts
  // precisam de saídas+entradas+transfers pra render meaningful; quando todas
  // estão carregando inicialmente OU alguma falhou, mostra estado dedicado em
  // vez do chrome vazio (que confunde). Equipamentos/obras/etc são auxiliares
  // (já cacheadas globalmente em outros módulos) — não bloqueiam.
  const isLoadingCore =
    saidasQuery.isLoading || entradasQuery.isLoading || transferenciasQuery.isLoading;
  const isErrorCore =
    saidasQuery.isError || entradasQuery.isError || transferenciasQuery.isError;
  const errorCoreMessage =
    saidasQuery.error?.message ||
    entradasQuery.error?.message ||
    transferenciasQuery.error?.message ||
    null;
  const refetchCore = () => {
    saidasQuery.refetch();
    entradasQuery.refetch();
    transferenciasQuery.refetch();
  };
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
  // FI.4 — Insert atômico via RPC (saida + saidas_lotes + sem_suprimento)
  const registrarSaidaFIFOMut = useRegistrarSaidaFIFO();

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
  // F5.A — Drawer read-only de detalhes da Saída (preview sem modo edit).
  const [saidaDetalhes, setSaidaDetalhes] = useState<SaidaCombustivel | null>(null);

  // Entrada state
  const [modalEntradaOpen, setModalEntradaOpen] = useState(false);
  const [editandoEntrada, setEditandoEntrada] = useState<EntradaCombustivel | null>(null);
  // F8.5.1 — Drawer read-only de detalhes da Entrada (mesmo padrão da Saída).
  const [entradaDetalhes, setEntradaDetalhes] = useState<EntradaCombustivel | null>(null);

  // Transferencia state
  const [modalTransferenciaOpen, setModalTransferenciaOpen] = useState(false);
  // F8.5.2 — Drawer read-only de detalhes da Transferência.
  const [transferenciaDetalhes, setTransferenciaDetalhes] = useState<TransferenciaCombustivel | null>(null);

  // F8.5.3 — Drawer read-only de detalhes do Tanque (Depósito).
  const [tanqueDetalhes, setTanqueDetalhes] = useState<Deposito | null>(null);

  // Atribuição retroativa em batch (F2.B.2)
  const [modalAtribuirOpen, setModalAtribuirOpen] = useState(false);

  // Password gate
  const [senhaOpen, setSenhaOpen] = useState(false);
  const [senhaAction, setSenhaAction] = useState<(() => void) | null>(null);

  // F3.D-fix: pedirSenha agora aceita opts:
  // - confirmMessage: confirma com ConfirmDialog state-driven ANTES de rodar (usado em
  //   deletes pra dar freio mesmo no admin bypass).
  // - successMessage / errorMessage: notifica o usuário pós-execução via useToast.
  // Sem opts = comportamento legado (preserva edit/atribuir flows).
  type SenhaOpts = {
    confirmMessage?: string;
    successMessage?: string;
    errorMessage?: string;
  };
  function pedirSenha(action: () => void | Promise<void>, opts?: SenhaOpts) {
    const wrappedAction = async () => {
      try {
        await action();
        if (opts?.successMessage) {
          showToast({ kind: 'success', message: opts.successMessage });
        }
      } catch (e) {
        console.error('[combustivel] ação falhou', e);
        const msg = opts?.errorMessage ?? 'Operação falhou. Verifique o console e tente novamente.';
        showToast({ kind: 'error', message: msg });
      }
    };
    if (usuario?.cargo === 'Administrador') {
      if (opts?.confirmMessage) {
        setConfirmState({
          open: true,
          title: 'Confirmar ação',
          message: opts.confirmMessage,
          onConfirm: () => {
            setConfirmState(null);
            void wrappedAction();
          },
        });
        return;
      }
      void wrappedAction();
      return;
    }
    setSenhaAction(() => wrappedAction);
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
      pedirSenha(
        async () => {
          await excluirDepositoMut.mutateAsync(id);
        },
        {
          confirmMessage: 'Confirma exclusão deste tanque? Ação não pode ser desfeita.',
          successMessage: 'Tanque excluído.',
          errorMessage: 'Falha ao excluir tanque. Verifique se há saídas/entradas vinculadas.',
        },
      );
    },
    [excluirDepositoMut]
  );

  // Saida handlers (modelo unificado SaidaCombustivel)
  const handleSubmitSaida = useCallback(
    async (
      saida: SaidaCombustivel,
      fifoMeta?: {
        lotes: { fonteTipo: 'entrada' | 'transferencia'; fonteId: string; litros: number; precoLote: number }[];
        litrosSemSuprimento: number;
      },
    ) => {
      if (editandoSaida) {
        // F5.A.0: rastreia quem alterou. Atribuição retroativa em batch
        // (F2.B.2) também passa por aqui — todo UPDATE seta updated_by.
        // FI.4 — Edit mode preserva snapshot (HF.11): não recalcula FIFO,
        // não toca em saidas_lotes (RLS update admin-only).
        await atualizarSaidaMut.mutateAsync({ ...saida, updatedBy: usuario?.nome || null });
      } else if (fifoMeta) {
        // FI.4 — Insert atômico via RPC: grava saida + saidas_lotes +
        // saidas_sem_suprimento em uma única transação.
        await registrarSaidaFIFOMut.mutateAsync({
          saida: { ...saida, createdBy: usuario?.nome || null },
          lotes: fifoMeta.lotes,
          litrosSemSuprimento: fifoMeta.litrosSemSuprimento,
        });
      } else {
        // Fallback: origem != tanque (dinheiro/requisição) não tem FIFO,
        // usa insert legado.
        await adicionarSaidaMut.mutateAsync({ ...saida, createdBy: usuario?.nome || null });
      }
      setModalSaidaOpen(false);
      setEditandoSaida(null);
    },
    [editandoSaida, atualizarSaidaMut, adicionarSaidaMut, registrarSaidaFIFOMut, usuario]
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

  // F3.D — Anomalias verificadas (check). Hook + mutations + handlers wrapados
  // em pedirSenha pra dar feedback (toast). Sem confirmMessage porque marcar
  // como verificada é ação não-destrutiva (reversível via "Desfazer").
  const { data: anomaliasChecks } = useAnomaliasChecks();
  const marcarVerificadaMut = useMarcarAnomaliaVerificada();
  const desfazerVerificacaoMut = useDesfazerVerificacaoAnomalia();
  const handleMarcarVerificada = useCallback(
    (anomaliaId: string) => {
      // Dialog state-driven substitui window.prompt(). Cancelar fecha o dialog
      // sem executar a ação; confirmar (com motivo vazio ou preenchido) prossegue.
      setPromptValue('');
      setPromptState({
        open: true,
        title: 'Por que essa anomalia está OK?',
        placeholder: 'Motivo (opcional)',
        onConfirm: (motivo) => {
          setPromptState(null);
          pedirSenha(
            async () => {
              await marcarVerificadaMut.mutateAsync({
                anomaliaId,
                checkedBy: usuario?.nome ?? null,
                motivo: motivo.trim() || null,
              });
            },
            {
              successMessage: 'Anomalia marcada como verificada.',
              errorMessage: 'Falha ao marcar anomalia. Tente novamente.',
            },
          );
        },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [marcarVerificadaMut, usuario?.nome],
  );
  const handleDesfazerVerificacao = useCallback(
    (anomaliaId: string) => {
      pedirSenha(
        async () => {
          await desfazerVerificacaoMut.mutateAsync(anomaliaId);
        },
        {
          successMessage: 'Verificação desfeita.',
          errorMessage: 'Falha ao desfazer verificação. Tente novamente.',
        },
      );
    },
    [desfazerVerificacaoMut],
  );

  // F3.B — atribuição inline de equipamento via drawer de Anomalia D1.
  // Usa update existente (sem distinção de "novo" handler) com updatedBy
  // marcado pra rastro de auditoria (mesmo padrão de F2.B.2).
  const handleAtribuirEquipamento = useCallback(
    async (saida: SaidaCombustivel, equipamentoId: string) => {
      await atualizarSaidaMut.mutateAsync({
        ...saida,
        equipamentoId,
        updatedBy: usuario?.nome || null,
      });
    },
    [atualizarSaidaMut, usuario]
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
        <CombustivelTabsNav
          active={subTab}
          onChange={setSubTab}
          isAdmin={usuario?.cargo === 'Administrador'}
        />
      </div>

      {/* F6.A — error banner global pra queries críticas. Aparece no topo
          do conteúdo, mantém tabs/filtros visíveis pra user reagir.
          Compact mode pq é inline acima do conteúdo. */}
      {isErrorCore && (
        <div className="px-3 sm:px-4 pt-3">
          <div className="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-surface-1)]">
            <ErrorState
              size="compact"
              title="Falha ao carregar dados de combustível"
              description="Algumas informações podem estar desatualizadas. Tente recarregar."
              errorMessage={errorCoreMessage ?? undefined}
              onRetry={refetchCore}
            />
          </div>
        </div>
      )}

      {/* Sub-tab content */}
      <div className="px-3 sm:px-4">
      {/* F6.A — Skeleton inicial enquanto core queries carregam (1ª vez).
          Mantém shell de tabs/filtros pro user já navegar; só substitui o
          painel inferior por placeholders. Refetch silencioso (já com cache)
          NÃO mostra skeleton — só isLoading inicial. */}
      {isLoadingCore && !isErrorCore && (
        <div className="space-y-4 pt-2" aria-busy="true" aria-label="Carregando dados">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonBlock key={i} height={120} />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <SkeletonBlock className="lg:col-span-2" height={280} />
            <SkeletonBlock height={280} />
          </div>
        </div>
      )}
      {!isLoadingCore && subTab === 'visao_geral' && (
        <VisaoGeralTab
          saidas={todasSaidas}
          entradas={todasEntradas}
          obras={obras}
          equipamentos={todosEquipamentos}
          transportadoras={transportadoras}
          combustiveis={combustiveis}
          onVerTodasSaidas={() => setSubTab('saidas')}
          onAtribuirSentinels={handleAtribuirSentinels}
          onNavigateToAnomalias={handleNavigateToAnomalias}
          anomaliasChecks={anomaliasChecks}
        />
      )}

      {!isLoadingCore && subTab === 'consumidores' && (
        <ConsumidoresTab
          saidas={todasSaidas}
          obras={obras}
          equipamentos={todosEquipamentos}
          transportadoras={transportadoras}
          combustiveis={combustiveis}
          onAtribuirSentinels={handleAtribuirSentinels}
        />
      )}

      {!isLoadingCore && subTab === 'obras' && (
        <ObrasTab
          saidas={todasSaidas}
          obras={obras}
          equipamentos={todosEquipamentos}
          transportadoras={transportadoras}
        />
      )}

      {!isLoadingCore && subTab === 'fornecedores' && (
        <FornecedoresTab entradas={todasEntradas} />
      )}

      {!isLoadingCore && subTab === 'anomalias' && (
        <AnomaliasTab
          saidasFiltradas={saidasFiltradas}
          saidasTodas={todasSaidas}
          equipamentos={todosEquipamentos}
          transportadoras={transportadoras}
          obras={obras}
          combustiveis={combustiveis}
          onEditSaida={handleEditSaida}
          onDeleteSaida={(id) => pedirSenha(() => handleDeleteSaida(id), {
            confirmMessage: 'Confirma exclusão desta saída? Ação não pode ser desfeita.',
            successMessage: 'Saída excluída.',
            errorMessage: 'Falha ao excluir saída. Verifique sua conexão e tente novamente.',
          })}
          onAtribuirEquipamento={handleAtribuirEquipamento}
          severityPrefill={anomaliasSeverityPrefill}
          onConsumeSeverityPrefill={() => setAnomaliasSeverityPrefill(null)}
          anomaliasChecks={anomaliasChecks}
          onMarcarVerificada={handleMarcarVerificada}
          onDesfazerVerificacao={handleDesfazerVerificacao}
        />
      )}

      {!isLoadingCore && subTab === 'relatorios' && (
        <RelatoriosTab
          saidas={todasSaidas}
          entradas={todasEntradas}
          transferencias={todasTransferencias}
          equipamentos={todosEquipamentos}
          transportadoras={transportadoras}
          obras={obras}
          combustiveis={combustiveis}
          depositos={depositosTodos}
        />
      )}

      {/* F10 — Aba Lixeira admin-only. Lê deletados das 4 entidades operacionais
          e oferece botão Restaurar (UPDATE deleted_at = NULL). */}
      {!isLoadingCore && subTab === 'lixeira' && usuario?.cargo === 'Administrador' && (
        <LixeiraTab
          equipamentos={todosEquipamentos}
          obras={obras}
          depositos={depositosTodos}
        />
      )}

      {!isLoadingCore && subTab === 'tanques' && (
        <TanqueList
          depositos={
            filterState.tanqueIds.length > 0
              ? depositosTodos.filter((d) => filterState.tanqueIds.includes(d.id))
              : depositosTodos
          }
          insumos={combustiveis}
          onEdit={handleEditTanque}
          onDelete={(id) => handleDeleteTanque(id)}
          canEdit={canEdit}
          canDelete={canDelete}
          onNovo={() => { setEditandoTanque(null); setModalTanqueOpen(true); }}
          canCreate={canCreateEntrada}
          onSelect={setTanqueDetalhes}
        />
      )}

      {!isLoadingCore && subTab === 'entradas' && (
        <EntradaListV2
          entradas={entradasFiltradas}
          depositos={depositosTodos}
          combustiveis={combustiveis}
          fornecedores={todosFornecedores}
          onEdit={handleEditEntrada}
          onDelete={(id) => pedirSenha(() => handleDeleteEntrada(id), {
            confirmMessage: 'Confirma exclusão desta entrada? Ação não pode ser desfeita.',
            successMessage: 'Entrada excluída.',
            errorMessage: 'Falha ao excluir entrada. Verifique sua conexão e tente novamente.',
          })}
          onSelect={setEntradaDetalhes}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}

      {!isLoadingCore && subTab === 'saidas' && (
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
          <SaidaCombustivelListV2
            saidas={saidasFiltradas}
            obras={obras}
            depositos={depositosTodos}
            equipamentos={todosEquipamentos}
            transportadoras={transportadoras}
            combustiveis={combustiveis}
            onEdit={handleEditSaida}
            onDelete={(id) => pedirSenha(() => handleDeleteSaida(id), {
              confirmMessage: 'Confirma exclusão desta saída? Ação não pode ser desfeita.',
              successMessage: 'Saída excluída.',
              errorMessage: 'Falha ao excluir saída. Verifique sua conexão e tente novamente.',
            })}
            onSelect={setSaidaDetalhes}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </>
      )}

      {!isLoadingCore && subTab === 'transferencias' && (
        <TransferenciaListV2
          transferencias={transferenciasFiltradas}
          depositos={depositosTodos}
          insumos={combustiveis}
          onDelete={(id) => pedirSenha(() => handleDeleteTransferencia(id), {
            confirmMessage: 'Confirma exclusão desta transferência? Ação não pode ser desfeita.',
            successMessage: 'Transferência excluída.',
            errorMessage: 'Falha ao excluir transferência. Verifique sua conexão e tente novamente.',
          })}
          onSelect={setTransferenciaDetalhes}
          canDelete={canDelete}
        />
      )}
      </div>

      {/* F5.A — Drawer read-only de detalhes da Saída. Click em row da
          SaidaCombustivelList abre. Botões Editar/Excluir delegam aos
          handlers que já tratam pedirSenha + confirm + toast. */}
      <SaidaDetalhesDrawer
        saida={saidaDetalhes}
        open={saidaDetalhes !== null}
        onClose={() => setSaidaDetalhes(null)}
        obras={obras}
        etapas={etapas}
        depositos={depositosTodos}
        equipamentos={todosEquipamentos}
        transportadoras={transportadoras}
        combustiveis={combustiveis}
        onEdit={handleEditSaida}
        onDelete={(id) => pedirSenha(() => handleDeleteSaida(id), {
          confirmMessage: 'Confirma exclusão desta saída? Ação não pode ser desfeita.',
          successMessage: 'Saída excluída.',
          errorMessage: 'Falha ao excluir saída. Verifique sua conexão e tente novamente.',
        })}
        canEdit={canEdit}
        canDelete={canDelete}
      />

      {/* F8.5.1 — Drawer read-only de detalhes da Entrada. */}
      <EntradaDetalhesDrawer
        entrada={entradaDetalhes}
        open={entradaDetalhes !== null}
        onClose={() => setEntradaDetalhes(null)}
        depositos={depositosTodos}
        combustiveis={combustiveis}
        fornecedores={todosFornecedores}
        onEdit={handleEditEntrada}
        onDelete={(id) => pedirSenha(() => handleDeleteEntrada(id), {
          confirmMessage: 'Confirma exclusão desta entrada? Ação não pode ser desfeita.',
          successMessage: 'Entrada excluída.',
          errorMessage: 'Falha ao excluir entrada. Verifique sua conexão e tente novamente.',
        })}
        canEdit={canEdit}
        canDelete={canDelete}
      />

      {/* F8.5.2 — Drawer read-only de detalhes da Transferência. */}
      <TransferenciaDetalhesDrawer
        transferencia={transferenciaDetalhes}
        open={transferenciaDetalhes !== null}
        onClose={() => setTransferenciaDetalhes(null)}
        depositos={depositosTodos}
        insumos={combustiveis}
        onDelete={(id) => pedirSenha(() => handleDeleteTransferencia(id), {
          confirmMessage: 'Confirma exclusão desta transferência? Ação não pode ser desfeita.',
          successMessage: 'Transferência excluída.',
          errorMessage: 'Falha ao excluir transferência. Verifique sua conexão e tente novamente.',
        })}
        canDelete={canDelete}
      />

      {/* F8.5.3 — Drawer read-only de detalhes do Tanque (Depósito). */}
      <TanqueDetalhesDrawer
        tanque={tanqueDetalhes}
        open={tanqueDetalhes !== null}
        onClose={() => setTanqueDetalhes(null)}
        onEdit={handleEditTanque}
        onDelete={(id) => handleDeleteTanque(id)}
        canEdit={canEdit}
        canDelete={canDelete}
      />

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

      {/* Confirm dialog — substitui window.confirm() no admin bypass de pedirSenha. */}
      {confirmState && (
        <Dialog open={confirmState.open} onOpenChange={(o) => !o && setConfirmState(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirmState.title}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed">
              {confirmState.message}
            </p>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setConfirmState(null)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={confirmState.onConfirm}>
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Prompt dialog — substitui window.prompt() em handleMarcarVerificada. */}
      {promptState && (
        <Dialog open={promptState.open} onOpenChange={(o) => !o && setPromptState(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{promptState.title}</DialogTitle>
            </DialogHeader>
            <input
              type="text"
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  promptState.onConfirm(promptValue);
                }
              }}
              placeholder={promptState.placeholder}
              className="w-full h-10 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)]"
              autoFocus
            />
            <DialogFooter>
              <Button variant="secondary" onClick={() => setPromptState(null)}>
                Cancelar
              </Button>
              <Button onClick={() => promptState.onConfirm(promptValue)}>
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}
