import { useState, useCallback, useMemo } from 'react';
import type { OrdemServico, ItemOS, PlanoManutencao, HistoricoMedicao } from '../../../types';
import { useEquipamentos } from '../../../hooks/useEquipamentos';
import {
  useOrdensServico,
  useAdicionarOS,
  useAtualizarOS,
  useItensOS,
  useSalvarItensOS,
  usePlanosManutencao,
  useAdicionarPlano,
  useAtualizarPlano,
  useExcluirPlano,
  useHistoricoMedicoes,
  useAdicionarMedicao,
} from '../../../hooks/useManutencao';
import { useAuth } from '../../../contexts/AuthContext';
import Modal from '../../ui/Modal';
import ManutencaoDashboard from './ManutencaoDashboard';
import ListaOS from './ListaOS';
import FormOS from './FormOS';
import DetalheOS from './DetalheOS';
import PlanosManutencao from './PlanosManutencao';
import FormPlano from './FormPlano';
import AlertasManutencao from './AlertasManutencao';
import RegistroMedicao from './RegistroMedicao';
import HistoricoMedicoes from './HistoricoMedicoes';

type SubTab = 'dashboard' | 'ordens' | 'planos' | 'alertas' | 'medicoes';

export default function ManutencaoContainer() {
  const { temAcao, usuario } = useAuth();
  const { data: equipamentos = [] } = useEquipamentos();
  const { data: ordensServico = [] } = useOrdensServico();
  const { data: planos = [] } = usePlanosManutencao();
  const { data: medicoes = [] } = useHistoricoMedicoes();

  const adicionarOS = useAdicionarOS();
  const atualizarOS = useAtualizarOS();
  const salvarItensOS = useSalvarItensOS();
  const adicionarPlano = useAdicionarPlano();
  const atualizarPlano = useAtualizarPlano();
  const excluirPlano = useExcluirPlano();
  const adicionarMedicao = useAdicionarMedicao();


  const canCreate = temAcao('criar_os');
  const canEdit = temAcao('editar_os');

  const [subTab, setSubTab] = useState<SubTab>('dashboard');
  const [modalNovaOS, setModalNovaOS] = useState(false);
  const [osSelecionada, setOsSelecionada] = useState<OrdemServico | null>(null);
  const [editandoOS, setEditandoOS] = useState<OrdemServico | null>(null);
  const [modalNovoPlano, setModalNovoPlano] = useState(false);
  const [editandoPlano, setEditandoPlano] = useState<PlanoManutencao | null>(null);
  const [modalNovaMedicao, setModalNovaMedicao] = useState(false);
  const [prefilledEquipId, setPrefilledEquipId] = useState('');

  // Fetch items for selected OS
  const { data: itensOsSelecionada = [] } = useItensOS(osSelecionada?.id ?? '');
  const { data: itensEditandoOS = [] } = useItensOS(editandoOS?.id ?? '');

  const equipamentoIds = useMemo(() => equipamentos.map((e) => e.id), [equipamentos]);
  const nomeUsuario = usuario?.nome ?? '';

  const handleSalvarOS = useCallback(async (os: OrdemServico, itens: ItemOS[]) => {
    if (os.id) {
      await atualizarOS.mutateAsync(os);
      await salvarItensOS.mutateAsync({ osId: os.id, itens });
    } else {
      await adicionarOS.mutateAsync(os);
    }
    setModalNovaOS(false);
    setEditandoOS(null);
  }, [adicionarOS, atualizarOS, salvarItensOS]);

  const handleSalvarPlano = useCallback(async (plano: PlanoManutencao) => {
    if (plano.id) {
      await atualizarPlano.mutateAsync(plano);
    } else {
      await adicionarPlano.mutateAsync(plano);
    }
    setModalNovoPlano(false);
    setEditandoPlano(null);
  }, [adicionarPlano, atualizarPlano]);

  const handleExcluirPlano = useCallback(async (id: string) => {
    if (!confirm('Excluir este plano de manutenção?')) return;
    await excluirPlano.mutateAsync(id);
  }, [excluirPlano]);

  const handleSalvarMedicao = useCallback(async (medicao: HistoricoMedicao) => {
    await adicionarMedicao.mutateAsync(medicao);
    setModalNovaMedicao(false);
  }, [adicionarMedicao]);

  const handleCriarOSFromAlerta = useCallback((equipamentoId: string) => {
    setPrefilledEquipId(equipamentoId);
    setModalNovaOS(true);
  }, []);

  const subTabs: { key: SubTab; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'ordens', label: 'Ordens de Serviço' },
    { key: 'planos', label: 'Planos' },
    { key: 'alertas', label: 'Alertas' },
    { key: 'medicoes', label: 'Medições' },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-tab navigation */}
      <div className="flex gap-1 bg-gray-200 dark:bg-slate-700 rounded-lg p-1 w-fit overflow-x-auto">
        {subTabs.map((t) => (
          <button
            key={t.key}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              subTab === t.key
                ? 'bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 shadow-sm'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
            }`}
            onClick={() => setSubTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {subTab === 'dashboard' && (
        <ManutencaoDashboard
          ordensServico={ordensServico}
          planos={planos}
          medicoes={medicoes}
          equipamentoIds={equipamentoIds}
        />
      )}

      {subTab === 'ordens' && (
        <ListaOS
          ordensServico={ordensServico}
          equipamentos={equipamentos}
          onSelect={setOsSelecionada}
          onNovaOS={() => { setPrefilledEquipId(''); setModalNovaOS(true); }}
          canCreate={canCreate}
        />
      )}

      {subTab === 'planos' && (
        <PlanosManutencao
          planos={planos}
          equipamentos={equipamentos}
          medicoes={medicoes}
          onNovoPlano={() => setModalNovoPlano(true)}
          onEditarPlano={setEditandoPlano}
          onExcluirPlano={handleExcluirPlano}
          canCreate={canCreate}
        />
      )}

      {subTab === 'alertas' && (
        <AlertasManutencao
          planos={planos}
          equipamentos={equipamentos}
          medicoes={medicoes}
          onCriarOS={handleCriarOSFromAlerta}
        />
      )}

      {subTab === 'medicoes' && (
        <HistoricoMedicoes
          medicoes={medicoes}
          equipamentos={equipamentos}
          onNovaMedicao={() => setModalNovaMedicao(true)}
        />
      )}

      {/* Modal: Nova OS */}
      <Modal
        open={modalNovaOS}
        onClose={() => setModalNovaOS(false)}
        title="Nova Ordem de Serviço"
        size="lg"
      >
        <FormOS
          equipamentos={equipamentos}
          onSubmit={handleSalvarOS}
          onCancel={() => setModalNovaOS(false)}
          usuario={nomeUsuario}
          initial={prefilledEquipId ? {
            id: '',
            numero: '',
            equipamentoId: prefilledEquipId,
            tipo: 'corretiva',
            prioridade: 'normal',
            status: 'aberta',
            descricao: '',
            dataAbertura: new Date().toISOString().split('T')[0],
            dataPrevista: '',
            dataConclusao: '',
            medicaoAbertura: 0,
            medicaoConclusao: null,
            responsavel: '',
            observacoes: '',
            criadoPor: nomeUsuario,
          } : undefined}
        />
      </Modal>

      {/* Modal: Detalhe OS */}
      <Modal
        open={!!osSelecionada}
        onClose={() => setOsSelecionada(null)}
        title={osSelecionada ? `OS ${osSelecionada.numero}` : 'Detalhes'}
        size="lg"
      >
        {osSelecionada && (
          <DetalheOS
            os={osSelecionada}
            itens={itensOsSelecionada}
            equipamentos={equipamentos}
            onEditar={canEdit ? () => {
              setEditandoOS(osSelecionada);
              setOsSelecionada(null);
            } : undefined}
            onClose={() => setOsSelecionada(null)}
          />
        )}
      </Modal>

      {/* Modal: Editar OS */}
      <Modal
        open={!!editandoOS}
        onClose={() => setEditandoOS(null)}
        title="Editar Ordem de Serviço"
        size="lg"
      >
        {editandoOS && (
          <FormOS
            initial={editandoOS}
            itensIniciais={itensEditandoOS}
            equipamentos={equipamentos}
            onSubmit={handleSalvarOS}
            onCancel={() => setEditandoOS(null)}
            usuario={nomeUsuario}
          />
        )}
      </Modal>

      {/* Modal: Novo Plano */}
      <Modal
        open={modalNovoPlano}
        onClose={() => setModalNovoPlano(false)}
        title="Novo Plano de Manutenção"
      >
        <FormPlano
          equipamentos={equipamentos}
          onSubmit={handleSalvarPlano}
          onCancel={() => setModalNovoPlano(false)}
          usuario={nomeUsuario}
        />
      </Modal>

      {/* Modal: Editar Plano */}
      <Modal
        open={!!editandoPlano}
        onClose={() => setEditandoPlano(null)}
        title="Editar Plano de Manutenção"
      >
        {editandoPlano && (
          <FormPlano
            initial={editandoPlano}
            equipamentos={equipamentos}
            onSubmit={handleSalvarPlano}
            onCancel={() => setEditandoPlano(null)}
            usuario={nomeUsuario}
          />
        )}
      </Modal>

      {/* Modal: Nova Medição */}
      <Modal
        open={modalNovaMedicao}
        onClose={() => setModalNovaMedicao(false)}
        title="Registrar Medição"
      >
        <RegistroMedicao
          equipamentos={equipamentos}
          onSubmit={handleSalvarMedicao}
          onCancel={() => setModalNovaMedicao(false)}
          usuario={nomeUsuario}
        />
      </Modal>

    </div>
  );
}
