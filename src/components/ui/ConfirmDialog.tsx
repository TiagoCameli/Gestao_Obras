import { useState, useEffect } from 'react';
import Button from './Button';
import Modal from './Modal';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
}: ConfirmDialogProps) {
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
      onConfirm();
      onClose();
    } catch {
      setErro(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-gray-600 mb-4">{message}</p>
      <div className="mb-4">
        <label htmlFor="senhaExclusao" className="block text-sm font-medium text-gray-700 mb-1">
          Digite a senha para confirmar
        </label>
        <input
          id="senhaExclusao"
          type="password"
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde ${
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
        <Button variant="danger" onClick={handleConfirm} disabled={loading}>
          {loading ? 'Verificando...' : 'Confirmar'}
        </Button>
      </div>
    </Modal>
  );
}
