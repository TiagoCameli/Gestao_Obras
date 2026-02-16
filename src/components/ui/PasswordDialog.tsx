import { useState, useEffect } from 'react';
import Button from './Button';
import Modal from './Modal';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface PasswordDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
}

export default function PasswordDialog({
  open,
  onClose,
  onSuccess,
  title = 'Autenticacao',
}: PasswordDialogProps) {
  const { usuario } = useAuth();
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setSenha('');
      setErro(false);
      setLoading(false);
    }
  }, [open]);

  async function handleConfirm() {
    if (!usuario) { setErro(true); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: usuario.email,
        password: senha,
      });
      if (error) {
        setErro(true);
        return;
      }
      onSuccess();
      onClose();
    } catch {
      setErro(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-gray-600 mb-4">Digite a senha para continuar.</p>
      <div className="mb-4">
        <input
          type="password"
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            erro ? 'border-red-500' : 'border-gray-300'
          }`}
          value={senha}
          onChange={(e) => {
            setSenha(e.target.value);
            setErro(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleConfirm();
            }
          }}
          placeholder="Senha"
          autoFocus
          disabled={loading}
        />
        {erro && (
          <p className="text-red-500 text-xs mt-1">Senha incorreta.</p>
        )}
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button onClick={handleConfirm} disabled={loading}>
          {loading ? 'Verificando...' : 'Confirmar'}
        </Button>
      </div>
    </Modal>
  );
}
