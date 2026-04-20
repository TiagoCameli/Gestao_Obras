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

  const inputCls =
    'w-full h-[44px] rounded-lg px-3 text-sm ' +
    'bg-[var(--color-surface-2)] text-[var(--color-fg)] ' +
    'border border-[var(--color-border)] ' +
    'placeholder:text-[var(--color-fg-subtle)] ' +
    'focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)] ' +
    'transition-[border-color,box-shadow]';

  return (
    <div className="min-h-screen flex items-center justify-center bg-app px-4 relative overflow-hidden">
      {/* Premium ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(60rem 35rem at 20% 15%, color-mix(in srgb, var(--color-accent) 12%, transparent), transparent 60%), ' +
            'radial-gradient(50rem 30rem at 80% 85%, color-mix(in srgb, var(--color-accent) 8%, transparent), transparent 60%)',
        }}
      />
      <div className="relative w-full max-w-md">
        <div className="card-premium elevate-top p-8 sm:p-9 rounded-2xl">
          <div className="flex items-center gap-3 mb-8">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),var(--shadow-sm)]">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21V7l9-4 9 4v14" />
                <path d="M9 21v-8h6v8" />
              </svg>
            </span>
            <div>
              <h1 className="text-lg font-semibold text-[var(--color-fg)] leading-none">EMT Construtora</h1>
              <p className="text-[var(--color-fg-muted)] text-xs mt-1">Sistema de Controle de Obras</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="loginEmail" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
                E-mail
              </label>
              <input
                id="loginEmail"
                type="email"
                className={inputCls}
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErro(''); }}
                placeholder="seu@email.com"
                autoFocus
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="loginSenha" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
                Senha
              </label>
              <div className="relative">
                <input
                  id="loginSenha"
                  type={mostrarSenha ? 'text' : 'password'}
                  className={inputCls + ' pr-10'}
                  value={senha}
                  onChange={(e) => { setSenha(e.target.value); setErro(''); }}
                  placeholder="Sua senha"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 inline-flex items-center justify-center rounded-md text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-3)]"
                  onClick={() => setMostrarSenha((v) => !v)}
                  tabIndex={-1}
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {mostrarSenha ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center">
              <input
                id="lembrarMe"
                type="checkbox"
                className="w-4 h-4 accent-[var(--color-accent)] rounded"
                checked={lembrarMe}
                onChange={(e) => setLembrarMe(e.target.checked)}
              />
              <label htmlFor="lembrarMe" className="ml-2 text-sm text-[var(--color-fg-muted)]">
                Lembrar-me
              </label>
            </div>

            {erro && (
              <div className="bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/30 text-[var(--color-danger-fg)] rounded-lg px-4 py-3 text-sm">
                {erro}
                {countdown && (
                  <span className="block mt-1 font-mono font-semibold">
                    Tente novamente em {countdown}
                  </span>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isBloqueado || carregando}
              className={
                'w-full h-11 rounded-lg text-sm font-semibold transition-colors ' +
                'focus-visible:outline-none ' +
                (isBloqueado || carregando
                  ? 'bg-[var(--color-surface-3)] text-[var(--color-fg-subtle)] cursor-not-allowed'
                  : 'bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] hover:bg-[var(--color-accent-hover)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),var(--shadow-sm)]')
              }
            >
              {carregando ? 'Entrando...' : isBloqueado ? `Bloqueado (${countdown})` : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[var(--color-fg-subtle)] mt-5">
          © 2026 EMT Construtora
        </p>
      </div>
    </div>
  );
}
