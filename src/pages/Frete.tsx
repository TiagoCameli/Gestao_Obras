import { useState, useCallback } from 'react';
import type { Frete as FreteType, FiltrosFrete, Localidade } from '../types';
import { useFretes, useAdicionarFrete, useAtualizarFrete, useExcluirFrete } from '../hooks/useFretes';
import { useObras } from '../hooks/useObras';
import { useInsumos } from '../hooks/useInsumos';
import { useLocalidades, useAdicionarLocalidade } from '../hooks/useLocalidades';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
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
  const { data: localidades = [] } = useLocalidades();
  const adicionarMutation = useAdicionarFrete();
  const atualizarMutation = useAtualizarFrete();
  const excluirMutation = useExcluirFrete();
  const adicionarLocalidadeMutation = useAdicionarLocalidade();

  // Filter insumos: materials + combustiveis
  const insumosAtivos = insumos.filter((i) => i.ativo !== false);

  // Form state
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<FreteType | null>(null);

  // Localidade modal state
  const [localidadeModalOpen, setLocalidadeModalOpen] = useState(false);
  const [novaLocalidadeNome, setNovaLocalidadeNome] = useState('');
  const [novaLocalidadeEndereco, setNovaLocalidadeEndereco] = useState('');

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
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setLocalidadeModalOpen(true)}>
              Nova Localidade
            </Button>
            <Button onClick={() => { setEditando(null); setModalOpen(true); }}>
              Novo Frete
            </Button>
          </div>
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
          localidades={localidades}
        />
      </Modal>

      {/* Modal Localidades */}
      <Modal
        open={localidadeModalOpen}
        onClose={() => { setLocalidadeModalOpen(false); setNovaLocalidadeNome(''); setNovaLocalidadeEndereco(''); }}
        title="Localidades"
      >
        <div className="space-y-6">
          {/* Form nova localidade */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const nome = novaLocalidadeNome.trim();
              if (!nome) return;
              const nova: Localidade = {
                id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
                nome,
                endereco: novaLocalidadeEndereco.trim(),
                ativo: true,
              };
              await adicionarLocalidadeMutation.mutateAsync(nova);
              setNovaLocalidadeNome('');
              setNovaLocalidadeEndereco('');
            }}
            className="space-y-3"
          >
            <h3 className="text-sm font-semibold text-gray-700">Adicionar nova localidade</h3>
            <Input
              label="Nome"
              id="novaLocalidadeNome"
              type="text"
              value={novaLocalidadeNome}
              onChange={(e) => setNovaLocalidadeNome(e.target.value)}
              placeholder="Ex: Sao Paulo, Pedreira central..."
              required
              autoFocus
            />
            <Input
              label="Link / Endereco (opcional)"
              id="novaLocalidadeEndereco"
              type="text"
              value={novaLocalidadeEndereco}
              onChange={(e) => setNovaLocalidadeEndereco(e.target.value)}
              placeholder="Ex: https://maps.google.com/..."
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={!novaLocalidadeNome.trim()}>
                Adicionar
              </Button>
            </div>
          </form>

          {/* Lista de localidades cadastradas */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Localidades cadastradas ({localidades.length})
            </h3>
            {localidades.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhuma localidade cadastrada.</p>
            ) : (
              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {localidades.map((loc) => (
                  <div key={loc.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{loc.nome}</p>
                      {loc.endereco && (
                        <a
                          href={loc.endereco}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-emt-verde hover:text-emt-verde-escuro underline truncate block"
                        >
                          {loc.endereco}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={() => { setLocalidadeModalOpen(false); setNovaLocalidadeNome(''); setNovaLocalidadeEndereco(''); }}>
              Fechar
            </Button>
          </div>
        </div>
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
