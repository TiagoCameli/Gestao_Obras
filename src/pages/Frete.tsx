import { useState, useCallback } from 'react';
import type { Frete as FreteType, FiltrosFrete } from '../types';
import { useFretes, useAdicionarFrete, useAtualizarFrete, useExcluirFrete } from '../hooks/useFretes';
import { useObras } from '../hooks/useObras';
import { useInsumos } from '../hooks/useInsumos';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import FreteForm from '../components/frete/FreteForm';
import FreteList from '../components/frete/FreteList';

export default function Frete() {
  const { temAcao } = useAuth();
  const canCreate = temAcao('criar_frete');
  const canEdit = temAcao('editar_frete');
  const canDelete = temAcao('excluir_frete');

  const { data: fretes = [], isLoading } = useFretes();
  const { data: obras = [] } = useObras();
  const { data: insumos = [] } = useInsumos();
  const adicionarMutation = useAdicionarFrete();
  const atualizarMutation = useAtualizarFrete();
  const excluirMutation = useExcluirFrete();

  // Filter insumos: materials + combustiveis
  const insumosAtivos = insumos.filter((i) => i.ativo !== false);

  // Form state
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<FreteType | null>(null);

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Filters
  const [filtros, setFiltros] = useState<FiltrosFrete>({
    obraId: '',
    transportadora: '',
    dataInicio: '',
    dataFim: '',
  });

  const handleSubmit = useCallback(
    async (frete: FreteType) => {
      if (editando) {
        await atualizarMutation.mutateAsync(frete);
      } else {
        await adicionarMutation.mutateAsync(frete);
      }
      setModalOpen(false);
      setEditando(null);
    },
    [editando, adicionarMutation, atualizarMutation]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await excluirMutation.mutateAsync(id);
      setDeleteId(null);
    },
    [excluirMutation]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Frete</h1>
        {canCreate && (
          <Button onClick={() => { setEditando(null); setModalOpen(true); }}>
            Novo Frete
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
          value={filtros.obraId}
          onChange={(e) => setFiltros((f) => ({ ...f, obraId: e.target.value }))}
        >
          <option value="">Todas as obras</option>
          {obras.map((o) => (
            <option key={o.id} value={o.id}>{o.nome}</option>
          ))}
        </select>
        <input
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde w-56"
          placeholder="Buscar transportadora..."
          value={filtros.transportadora}
          onChange={(e) => setFiltros((f) => ({ ...f, transportadora: e.target.value }))}
        />
        <input
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
          type="date"
          value={filtros.dataInicio}
          onChange={(e) => setFiltros((f) => ({ ...f, dataInicio: e.target.value }))}
          title="Data inicio"
        />
        <input
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
          type="date"
          value={filtros.dataFim}
          onChange={(e) => setFiltros((f) => ({ ...f, dataFim: e.target.value }))}
          title="Data fim"
        />
        {(filtros.obraId || filtros.transportadora || filtros.dataInicio || filtros.dataFim) && (
          <button
            className="text-sm text-emt-verde hover:text-emt-verde-escuro font-medium"
            onClick={() => setFiltros({ obraId: '', transportadora: '', dataInicio: '', dataFim: '' })}
          >
            Limpar filtros
          </button>
        )}
      </div>

      <FreteList
        fretes={fretes}
        obras={obras}
        insumos={insumosAtivos}
        filtros={filtros}
        onEdit={(frete) => { setEditando(frete); setModalOpen(true); }}
        onDelete={(id) => setDeleteId(id)}
        canEdit={canEdit}
        canDelete={canDelete}
      />

      {/* Modal Form */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditando(null); }}
        title={editando ? 'Editar Frete' : 'Novo Frete'}
      >
        <FreteForm
          initial={editando}
          onSubmit={handleSubmit}
          onCancel={() => { setModalOpen(false); setEditando(null); }}
          obras={obras}
          insumos={insumosAtivos}
        />
      </Modal>

      {/* Confirm Delete */}
      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) handleDelete(deleteId); }}
        title="Excluir Frete"
        message="Tem certeza que deseja excluir este frete? Esta acao nao pode ser desfeita."
      />
    </div>
  );
}
