import { useCallback, useMemo, useState } from 'react';
import type { Deposito, EtapaObra, Obra } from '../types';
import { useObras, useAdicionarObra, useAtualizarObra, useExcluirObra } from '../hooks/useObras';
import { useEtapas, useSalvarEtapasObra } from '../hooks/useEtapas';
import { useDepositos, useExcluirDeposito } from '../hooks/useDepositos';
import { useSalvarDepositosObra } from '../hooks/useDepositos';
import { useUnidades } from '../hooks/useUnidades';
import { formatCurrency, formatDate } from '../utils/formatters';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PasswordDialog from '../components/ui/PasswordDialog';
import ObraForm from '../components/obras/ObraForm';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { useAuth } from '../contexts/AuthContext';

const STATUS_LABELS: Record<Obra['status'], string> = {
  planejamento: 'Planejamento',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  pausada: 'Pausada',
};

const STATUS_COLORS: Record<Obra['status'], string> = {
  planejamento: 'bg-emt-verde-claro text-emt-verde-escuro',
  em_andamento: 'bg-yellow-100 text-yellow-800',
  concluida: 'bg-green-100 text-green-800',
  pausada: 'bg-gray-100 text-gray-800',
};

export default function ObrasPage() {
  const { temAcao, usuario } = useAuth();
  const canCreate = temAcao('criar_obras');
  const canEdit = temAcao('editar_obras');
  const canDelete = temAcao('excluir_obras');

  const { data: obras = [], isLoading: loadingObras } = useObras();
  const { data: todasEtapas = [], isLoading: loadingEtapas } = useEtapas();
  const { data: todosDepositos = [], isLoading: loadingDepositos } = useDepositos();
  const { data: todasUnidades = [], isLoading: loadingUnidades } = useUnidades();

  const adicionarObraMutation = useAdicionarObra();
  const atualizarObraMutation = useAtualizarObra();
  const excluirObraMutation = useExcluirObra();
  const salvarEtapasObraMutation = useSalvarEtapasObra();
  const salvarDepositosObraMutation = useSalvarDepositosObra();
  const excluirDepositoMutation = useExcluirDeposito();

  const isLoading = loadingObras || loadingEtapas || loadingDepositos || loadingUnidades;

  // Search & filter
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  const obrasFiltradas = useMemo(() => {
    let resultado = obras;
    if (busca) {
      const termo = busca.toLowerCase();
      resultado = resultado.filter(
        (o) =>
          o.nome.toLowerCase().includes(termo) ||
          o.endereco.toLowerCase().includes(termo) ||
          o.responsavel.toLowerCase().includes(termo)
      );
    }
    if (filtroStatus) {
      resultado = resultado.filter((o) => o.status === filtroStatus);
    }
    return resultado;
  }, [obras, busca, filtroStatus]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Obra | null>(null);

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteDepId, setDeleteDepId] = useState<string | null>(null);

  // Expand state
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const handleSubmit = useCallback(
    async (obra: Obra, etapas: EtapaObra[], depositos: Deposito[]) => {
      if (editando) {
        await atualizarObraMutation.mutateAsync(obra);
        await salvarEtapasObraMutation.mutateAsync({ obraId: obra.id, etapas });
        await salvarDepositosObraMutation.mutateAsync({ obraId: obra.id, depositos });
      } else {
        await adicionarObraMutation.mutateAsync({ ...obra, criadoPor: usuario?.nome || '' });
        await salvarEtapasObraMutation.mutateAsync({ obraId: obra.id, etapas });
        await salvarDepositosObraMutation.mutateAsync({ obraId: obra.id, depositos });
      }
      setModalOpen(false);
      setEditando(null);
    },
    [editando, atualizarObraMutation, adicionarObraMutation, salvarEtapasObraMutation, salvarDepositosObraMutation, usuario]
  );

  const handleEdit = useCallback((obra: Obra) => {
    pedirSenha(() => {
      setEditando(obra);
      setModalOpen(true);
    });
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    await excluirObraMutation.mutateAsync(id);
    setDeleteId(null);
  }, [excluirObraMutation]);

  const handleDeleteDeposito = useCallback(async (id: string) => {
    await excluirDepositoMutation.mutateAsync(id);
    setDeleteDepId(null);
  }, [excluirDepositoMutation]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500 text-lg">Carregando obras...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Obras</h1>
        {canCreate && (
          <Button onClick={() => { setEditando(null); setModalOpen(true); }}>
            Nova Obra
          </Button>
        )}
      </div>

      {/* Busca e filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="md:col-span-2">
          <Input
            id="buscaObra"
            label=""
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, endereço ou responsável..."
          />
        </div>
        <Select
          id="filtroStatus"
          label=""
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          options={[
            { value: 'planejamento', label: 'Planejamento' },
            { value: 'em_andamento', label: 'Em Andamento' },
            { value: 'concluida', label: 'Concluída' },
            { value: 'pausada', label: 'Pausada' },
          ]}
          placeholder="Todos os status"
        />
      </div>

      {obrasFiltradas.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">
              {obras.length === 0
                ? 'Nenhuma obra cadastrada ainda.'
                : 'Nenhuma obra encontrada com os filtros aplicados.'}
            </p>
            {obras.length === 0 && canCreate && (
              <Button onClick={() => { setEditando(null); setModalOpen(true); }}>
                Cadastrar Primeira Obra
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {obrasFiltradas.map((obra) => {
            const etapasObra = todasEtapas.filter((e) => e.obraId === obra.id);
            const depositosObra = todosDepositos.filter((d) => d.obraId === obra.id);
            const isExpanded = expandedId === obra.id;

            return (
              <Card key={obra.id} className="p-0 overflow-hidden">
                <div
                  className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleExpand(obra.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-lg font-semibold text-gray-800">
                          {obra.nome}
                        </h2>
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[obra.status]}`}
                        >
                          {STATUS_LABELS[obra.status]}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{obra.endereco}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right mr-2">
                        <p className="text-lg font-bold text-emt-verde-escuro">
                          {formatCurrency(obra.orcamento)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {etapasObra.length} etapa{etapasObra.length !== 1 ? 's' : ''}
                          {depositosObra.length > 0 &&
                            ` · ${depositosObra.length} tanque${depositosObra.length !== 1 ? 's' : ''}`}
                        </p>
                      </div>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500">Responsável</p>
                        <p className="text-sm font-medium text-gray-700">
                          {obra.responsavel}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Inicio</p>
                        <p className="text-sm font-medium text-gray-700">
                          {formatDate(obra.dataInicio)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Previsao Termino</p>
                        <p className="text-sm font-medium text-gray-700">
                          {formatDate(obra.dataPrevisaoFim)}
                        </p>
                      </div>
                    </div>

                    {etapasObra.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-2">Etapas</p>
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-emt-verde text-white">
                              <tr>
                                <th className="text-left px-3 py-1.5 text-white font-medium uppercase text-xs">#</th>
                                <th className="text-left px-3 py-1.5 text-white font-medium uppercase text-xs">Etapa</th>
                                <th className="text-left px-3 py-1.5 text-white font-medium uppercase text-xs">Unidade</th>
                                <th className="text-right px-3 py-1.5 text-white font-medium uppercase text-xs">Qtd</th>
                                <th className="text-right px-3 py-1.5 text-white font-medium uppercase text-xs">Valor Unit.</th>
                                <th className="text-right px-3 py-1.5 text-white font-medium uppercase text-xs">Valor Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                              {etapasObra.map((etapa, i) => (
                                <tr key={etapa.id}>
                                  <td className="px-3 py-1.5 text-gray-400 font-mono">{i + 1}.</td>
                                  <td className="px-3 py-1.5 text-gray-700 font-medium">{etapa.nome}</td>
                                  <td className="px-3 py-1.5 text-gray-600">{etapa.unidade || '-'}</td>
                                  <td className="px-3 py-1.5 text-right text-gray-600">{etapa.quantidade ?? '-'}</td>
                                  <td className="px-3 py-1.5 text-right text-gray-600">{etapa.valorUnitario != null ? formatCurrency(etapa.valorUnitario) : '-'}</td>
                                  <td className="px-3 py-1.5 text-right font-semibold text-gray-700">{etapa.quantidade != null && etapa.valorUnitario != null ? formatCurrency(etapa.quantidade * etapa.valorUnitario) : '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {depositosObra.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-2">Tanques</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {depositosObra.map((dep) => {
                            const pct =
                              dep.capacidadeLitros > 0
                                ? (dep.nivelAtualLitros / dep.capacidadeLitros) * 100
                                : 0;
                            const cor =
                              pct > 50
                                ? 'bg-green-500'
                                : pct > 20
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500';
                            return (
                              <div
                                key={dep.id}
                                className="bg-white border border-gray-200 rounded-lg p-3"
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-700">
                                      {dep.nome}
                                    </span>
                                  </div>
                                  {canDelete && (
                                    <Button
                                      variant="ghost"
                                      className="text-xs px-2 py-1 text-red-600 hover:bg-red-50"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        pedirSenha(() => setDeleteDepId(dep.id));
                                      }}
                                    >
                                      Excluir
                                    </Button>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full ${cor}`}
                                      style={{
                                        width: `${Math.min(pct, 100)}%`,
                                      }}
                                    />
                                  </div>
                                  <span className="text-xs text-gray-500 whitespace-nowrap">
                                    {dep.nivelAtualLitros.toFixed(0)} /{' '}
                                    {dep.capacidadeLitros.toFixed(0)} L
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2 border-t border-gray-200">
                      {canEdit && (
                        <Button
                          variant="secondary"
                          className="text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(obra);
                          }}
                        >
                          Editar
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="danger"
                          className="text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            pedirSenha(() => setDeleteId(obra.id));
                          }}
                        >
                          Excluir
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditando(null);
        }}
        title={editando ? 'Editar Obra' : 'Nova Obra'}
      >
        <ObraForm
          initial={editando}
          initialEtapas={editando ? todasEtapas.filter((e) => e.obraId === editando.id) : []}
          initialDepositos={editando ? todosDepositos.filter((d) => d.obraId === editando.id) : []}
          unidades={todasUnidades}
          onSubmit={handleSubmit}
          onCancel={() => {
            setModalOpen(false);
            setEditando(null);
          }}
        />
      </Modal>

      <PasswordDialog
        open={senhaOpen}
        onClose={() => {
          setSenhaOpen(false);
          setSenhaAction(null);
        }}
        onSuccess={() => {
          if (senhaAction) senhaAction();
          setSenhaAction(null);
        }}
        title="Senha de Confirmacao"
      />

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) handleDelete(deleteId);
        }}
        title="Excluir Obra"
        message="Tem certeza que deseja excluir esta obra? Todas as etapas, tanques e abastecimentos vinculados tambem serao excluidos."
      />

      <ConfirmDialog
        open={deleteDepId !== null}
        onClose={() => setDeleteDepId(null)}
        onConfirm={() => {
          if (deleteDepId) handleDeleteDeposito(deleteDepId);
        }}
        title="Excluir Tanque"
        message="Tem certeza que deseja excluir este tanque? Todas as entradas e saidas de combustivel vinculadas a este tanque tambem serao excluidas."
      />
    </div>
  );
}
