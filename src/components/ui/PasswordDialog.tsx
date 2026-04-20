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
      <p className="text-[var(--color-fg-muted)] mb-5 leading-relaxed">
        Digite a senha para continuar.
      </p>
      <div className="mb-5">
        <input
          type="password"
          className={
            'w-full h-[42px] rounded-lg px-3 py-2 text-sm ' +
            'bg-[var(--color-surface-1)] text-[var(--color-fg)] ' +
            'border border-[var(--color-border)] ' +
            'placeholder:text-[var(--color-fg-subtle)] ' +
            'focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)] ' +
            (erro ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)]' : '')
          }
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
          <p className="text-[var(--color-danger)] text-xs mt-1.5">Senha incorreta.</p>
        )}
      </div>
      <div className="flex justify-end gap-2">
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
