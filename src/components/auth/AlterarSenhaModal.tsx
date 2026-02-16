import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface AlterarSenhaModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AlterarSenhaModal({ open, onClose }: AlterarSenhaModalProps) {
  const { usuario } = useAuth();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
      setErro('');
      setSucesso(false);
      setLoading(false);
    }
  }, [open]);

  async function handleSubmit() {
    setErro('');
    if (!usuario) return;

    // Validate current password via Supabase Auth
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: usuario.email,
        password: senhaAtual,
      });
      if (signInError) {
        setErro('Senha atual incorreta.');
        return;
      }

      if (novaSenha.length < 6) {
        setErro('A nova senha deve ter pelo menos 6 caracteres.');
        return;
      }

      if (novaSenha !== confirmarSenha) {
        setErro('As senhas nao conferem.');
        return;
      }

      // Update password via Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: novaSenha,
      });
      if (updateError) {
        setErro('Erro ao alterar senha. Tente novamente.');
        return;
      }

      setSucesso(true);
      setTimeout(onClose, 1500);
    } catch {
      setErro('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Alterar Senha">
      {sucesso ? (
        <div className="text-center py-4">
          <div className="text-green-600 font-medium mb-2">Senha alterada com sucesso!</div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label htmlFor="senhaAtual" className="block text-sm font-medium text-gray-700 mb-1">
              Senha Atual
            </label>
            <input
              id="senhaAtual"
              type="password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={senhaAtual}
              onChange={(e) => { setSenhaAtual(e.target.value); setErro(''); }}
              autoFocus
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="novaSenha" className="block text-sm font-medium text-gray-700 mb-1">
              Nova Senha
            </label>
            <input
              id="novaSenha"
              type="password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={novaSenha}
              onChange={(e) => { setNovaSenha(e.target.value); setErro(''); }}
              placeholder="Minimo 6 caracteres"
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="confirmarSenha" className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar Nova Senha
            </label>
            <input
              id="confirmarSenha"
              type="password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={confirmarSenha}
              onChange={(e) => { setConfirmarSenha(e.target.value); setErro(''); }}
              disabled={loading}
            />
          </div>
          {erro && <p className="text-red-500 text-sm">{erro}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Alterando...' : 'Alterar Senha'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
