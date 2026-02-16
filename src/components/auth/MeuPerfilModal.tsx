import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useFuncionarios } from '../../hooks/useFuncionarios';
import { formatDate } from '../../utils/formatters';

interface MeuPerfilModalProps {
  open: boolean;
  onClose: () => void;
}

export default function MeuPerfilModal({ open, onClose }: MeuPerfilModalProps) {
  const { usuario } = useAuth();
  const { data: funcionarios = [] } = useFuncionarios();

  if (!usuario) return null;

  const func = funcionarios.find((f) => f.id === usuario.funcionarioId);

  return (
    <Modal open={open} onClose={onClose} title="Meu Perfil">
      <div className="space-y-3">
        <Field label="Nome" value={usuario.nome} />
        <Field label="E-mail" value={usuario.email} />
        <Field label="Cargo" value={usuario.cargo} />
        {func && (
          <>
            <Field label="CPF" value={func.cpf || '-'} />
            <Field label="Telefone" value={func.telefone || '-'} />
            {func.dataAdmissao && <Field label="Data Admissao" value={formatDate(func.dataAdmissao)} />}
          </>
        )}
      </div>
      <div className="flex justify-end pt-4">
        <Button variant="secondary" onClick={onClose}>Fechar</Button>
      </div>
    </Modal>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-medium text-gray-800">{value}</div>
    </div>
  );
}
