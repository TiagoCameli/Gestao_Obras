import { useState, useCallback } from 'react';
import type { Funcionario } from '../types';
import { useFuncionarios, useAdicionarFuncionario, useAtualizarFuncionario, useExcluirFuncionario, useSalvarPerfilPermissao } from '../hooks/useFuncionarios';
import { perfilPadraoPorCargo } from '../utils/permissions';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import FuncionarioForm from '../components/funcionarios/FuncionarioForm';
import FuncionarioList from '../components/funcionarios/FuncionarioList';
import { useAuth } from '../contexts/AuthContext';

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function Funcionarios() {
  const { atualizarSessao, temAcao } = useAuth();
  const canCreate = temAcao('criar_funcionarios');
  const canEditFunc = temAcao('editar_funcionarios');
  const canDeleteFunc = temAcao('excluir_funcionarios');

  const { data: funcionarios = [], isLoading } = useFuncionarios();
  const adicionarMutation = useAdicionarFuncionario();
  const atualizarMutation = useAtualizarFuncionario();
  const excluirMutation = useExcluirFuncionario();
  const salvarPerfilMutation = useSalvarPerfilPermissao();

  // Form state
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Funcionario | null>(null);

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (func: Funcionario, senha?: string) => {
      if (editando) {
        await atualizarMutation.mutateAsync(func);
      } else {
        await adicionarMutation.mutateAsync({ funcionario: func, senha: senha || 'Admin@123' });
        // Create default permissions for new employee
        await salvarPerfilMutation.mutateAsync({
          id: gerarId(),
          funcionarioId: func.id,
          permissoes: perfilPadraoPorCargo(func.cargo),
        });
      }
      setModalOpen(false);
      setEditando(null);
      atualizarSessao();
    },
    [editando, adicionarMutation, atualizarMutation, salvarPerfilMutation, atualizarSessao]
  );

  const handleDelete = useCallback(async (id: string) => {
    await excluirMutation.mutateAsync(id);
    setDeleteId(null);
    atualizarSessao();
  }, [excluirMutation, atualizarSessao]);

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
        <h1 className="text-3xl font-bold text-gray-800">Funcionarios</h1>
        {canCreate && (
          <Button onClick={() => { setEditando(null); setModalOpen(true); }}>
            Novo Funcionario
          </Button>
        )}
      </div>

      <FuncionarioList
        funcionarios={funcionarios}
        onEdit={(func) => { setEditando(func); setModalOpen(true); }}
        onDelete={(id) => setDeleteId(id)}
        canEdit={canEditFunc}
        canDelete={canDeleteFunc}
      />

      {/* Modal Form */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditando(null); }}
        title={editando ? 'Editar Funcionario' : 'Novo Funcionario'}
      >
        <FuncionarioForm
          initial={editando}
          onSubmit={handleSubmit}
          onCancel={() => { setModalOpen(false); setEditando(null); }}
        />
      </Modal>

      {/* Confirm Delete */}
      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) handleDelete(deleteId); }}
        title="Excluir Funcionario"
        message="Tem certeza que deseja excluir este funcionario? Esta acao nao pode ser desfeita."
      />
    </div>
  );
}
