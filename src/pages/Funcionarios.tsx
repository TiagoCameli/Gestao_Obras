import { useState, useCallback } from 'react';
import type { Funcionario } from '../types';
import { useFuncionarios, useAdicionarFuncionario, useAtualizarFuncionario, useExcluirFuncionario, useSalvarPerfilPermissao } from '../hooks/useFuncionarios';
import { perfilPadraoPorCargo } from '../utils/permissions';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PasswordDialog from '../components/ui/PasswordDialog';
import PageHeader from '../components/ui/PageHeader';
import LoadingState from '../components/ui/LoadingState';
import FuncionarioForm from '../components/funcionarios/FuncionarioForm';
import FuncionarioList from '../components/funcionarios/FuncionarioList';
import { useAuth } from '../contexts/AuthContext';

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function Funcionarios() {
  const { atualizarSessao, temAcao, usuario } = useAuth();
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

  const [deleteError, setDeleteError] = useState<string | null>(null);

  /**
   * Valida regras de proteção antes de excluir um usuário:
   *  - Não pode excluir a si próprio
   *  - Não pode excluir o último Administrador
   *  - Só Administrador pode excluir outro Administrador
   */
  function validarExclusao(id: string): string | null {
    const alvo = funcionarios.find((f) => f.id === id);
    if (!alvo) return 'Usuário não encontrado.';
    if (alvo.id === usuario?.funcionarioId) return 'Você não pode excluir o próprio usuário.';
    if (alvo.cargo === 'Administrador') {
      if (usuario?.cargo !== 'Administrador') {
        return 'Apenas um Administrador pode excluir outro Administrador.';
      }
      const totalAdmins = funcionarios.filter(
        (f) => f.cargo === 'Administrador' && f.status === 'ativo'
      ).length;
      if (totalAdmins <= 1) return 'Não é possível excluir o último Administrador ativo.';
    }
    return null;
  }

  const handleDelete = useCallback(async (id: string) => {
    const erro = validarExclusao(id);
    if (erro) {
      setDeleteError(erro);
      setDeleteId(null);
      return;
    }
    await excluirMutation.mutateAsync(id);
    setDeleteId(null);
    atualizarSessao();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excluirMutation, atualizarSessao, funcionarios, usuario]);

  if (isLoading) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: 'Cadastros', href: '/cadastros' }, { label: 'Usuários' }]}
          title="Usuários"
        />
        <LoadingState mode="list" count={6} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: 'Cadastros', href: '/cadastros' }, { label: 'Usuários' }]}
        title="Usuários"
        actions={canCreate && (
          <Button onClick={() => { setEditando(null); setModalOpen(true); }}>
            Novo Usuário
          </Button>
        )}
      />

      <FuncionarioList
        funcionarios={funcionarios}
        onEdit={(func) => pedirSenha(() => { setEditando(func); setModalOpen(true); })}
        onDelete={(id) => pedirSenha(() => setDeleteId(id))}
        canEdit={canEditFunc}
        canDelete={canDeleteFunc}
      />

      {/* Modal Form */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditando(null); }}
        title={editando ? 'Editar Usuário' : 'Novo Usuário'}
      >
        <FuncionarioForm
          initial={editando}
          onSubmit={handleSubmit}
          onCancel={() => { setModalOpen(false); setEditando(null); }}
          onImportBatch={async (funcs, senhas) => {
            for (const func of funcs) {
              const senha = senhas.get(func.id) || 'Admin@123';
              await adicionarMutation.mutateAsync({ funcionario: func, senha });
              await salvarPerfilMutation.mutateAsync({
                id: gerarId(),
                funcionarioId: func.id,
                permissoes: perfilPadraoPorCargo(func.cargo),
              });
            }
            setModalOpen(false);
            setEditando(null);
            atualizarSessao();
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

      {/* Confirm Delete */}
      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) handleDelete(deleteId); }}
        title="Excluir Usuário"
        message="Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita."
      />

      {/* Erro ao tentar exclusão proibida */}
      <ConfirmDialog
        open={deleteError !== null}
        onClose={() => setDeleteError(null)}
        onConfirm={() => setDeleteError(null)}
        title="Não permitido"
        message={deleteError ?? ''}
      />
    </div>
  );
}
