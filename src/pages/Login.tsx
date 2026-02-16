import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [lembrarMe, setLembrarMe] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [bloqueadoAte, setBloqueadoAte] = useState(0);
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  // Countdown timer
  useEffect(() => {
    if (!bloqueadoAte || Date.now() >= bloqueadoAte) {
      setCountdown('');
      return;
    }
    const interval = setInterval(() => {
      const diff = bloqueadoAte - Date.now();
      if (diff <= 0) {
        setCountdown('');
        setBloqueadoAte(0);
        setErro('');
        clearInterval(interval);
        return;
      }
      const min = Math.floor(diff / 60000);
      const seg = Math.floor((diff % 60000) / 1000);
      setCountdown(`${min}:${seg.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [bloqueadoAte]);

  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');

    if (!email.trim() || !senha.trim()) {
      setErro('Preencha todos os campos.');
      return;
    }

    setCarregando(true);
    try {
      const result = await login(email.trim(), senha, lembrarMe);
      if (result.ok) {
        navigate('/', { replace: true });
      } else if (result.erro === 'bloqueado' && result.bloqueadoAte) {
        setBloqueadoAte(result.bloqueadoAte);
        setErro('Muitas tentativas. Aguarde para tentar novamente.');
      } else {
        setErro(result.erro || 'Erro ao fazer login.');
      }
    } finally {
      setCarregando(false);
    }
  }

  const isBloqueado = bloqueadoAte > 0 && Date.now() < bloqueadoAte;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-700 to-blue-900 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-800 mb-1">Gestao Obras</h1>
          <p className="text-gray-500 text-sm">Acesse sua conta para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="loginEmail" className="block text-sm font-medium text-gray-700 mb-1">
              E-mail
            </label>
            <input
              id="loginEmail"
              type="email"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErro(''); }}
              placeholder="seu@email.com"
              autoFocus
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="loginSenha" className="block text-sm font-medium text-gray-700 mb-1">
              Senha
            </label>
            <div className="relative">
              <input
                id="loginSenha"
                type={mostrarSenha ? 'text' : 'password'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={senha}
                onChange={(e) => { setSenha(e.target.value); setErro(''); }}
                placeholder="Sua senha"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setMostrarSenha((v) => !v)}
                tabIndex={-1}
              >
                {mostrarSenha ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center">
            <input
              id="lembrarMe"
              type="checkbox"
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              checked={lembrarMe}
              onChange={(e) => setLembrarMe(e.target.checked)}
            />
            <label htmlFor="lembrarMe" className="ml-2 text-sm text-gray-600">
              Lembrar-me
            </label>
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {erro}
              {countdown && (
                <span className="block mt-1 font-mono font-bold text-red-800">
                  Tente novamente em {countdown}
                </span>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isBloqueado || carregando}
            className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              isBloqueado || carregando
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-700 text-white hover:bg-blue-800'
            }`}
          >
            {carregando ? 'Entrando...' : isBloqueado ? `Bloqueado (${countdown})` : 'Entrar'}
          </button>
        </form>

      </div>
    </div>
  );
}
