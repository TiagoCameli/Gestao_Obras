import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { AcaoPermissao, ModuloPermissao, PermissoesFuncionario, SessaoUsuario } from '../types';
import { supabase } from '../lib/supabase';
import { dbToFuncionario, dbToPerfilPermissao } from '../lib/mappers';
import { perfilPadraoPorCargo } from '../utils/permissions';
import { adicionarAuditLogAsync } from '../hooks/useAuditLog';

interface AuthContextValue {
  usuario: SessaoUsuario | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, senha: string, lembrarMe: boolean) => Promise<{ ok: boolean; erro?: string; bloqueadoAte?: number }>;
  logout: () => Promise<void>;
  temPermissao: (modulo: ModuloPermissao, acao: AcaoPermissao) => boolean;
  temAlgumaPermissao: (modulo: ModuloPermissao) => boolean;
  temAcao: (chave: string) => boolean;
  atualizarSessao: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function buildSessao(authUserId: string, lembrarMe: boolean): Promise<SessaoUsuario | null> {
  const { data: funcRow, error: funcError } = await supabase
    .from('funcionarios')
    .select('*')
    .eq('auth_user_id', authUserId)
    .single();

  if (funcError || !funcRow) return null;

  const func = dbToFuncionario(funcRow);

  const { data: permRow } = await supabase
    .from('perfis_permissao')
    .select('*')
    .eq('funcionario_id', func.id)
    .single();

  let permissoes: PermissoesFuncionario;
  if (permRow) {
    permissoes = dbToPerfilPermissao(permRow).permissoes;
  } else {
    permissoes = perfilPadraoPorCargo(func.cargo);
  }

  const now = Date.now();
  return {
    funcionarioId: func.id,
    nome: func.nome,
    email: func.email,
    cargo: func.cargo,
    permissoes,
    loginAt: now,
    expiresAt: lembrarMe ? now + 7 * 24 * 60 * 60 * 1000 : now + 8 * 60 * 60 * 1000,
    lembrarMe,
    acoesPermitidas: func.acoesPermitidas,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<SessaoUsuario | null>(null);
  const [loading, setLoading] = useState(true);
  const loginHandledRef = useRef(false);

  // Bootstrap: check if there's an existing Supabase session
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && !loginHandledRef.current) {
          const sessao = await buildSessao(session.user.id, true);
          if (mounted) setUsuario(sessao);
        }
      } catch {
        // Session expired or corrupt — ignore and show login
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();

    // Listen only for sign-out events.
    // SIGNED_IN is NOT handled here to avoid race conditions with the login() function
    // (the onAuthStateChange closure captures a stale `usuario` value).
    // Session restoration on page refresh is handled by init() above.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        if (mounted) {
          loginHandledRef.current = false;
          setUsuario(null);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, senha: string, lembrarMe: boolean) => {
    // Check login attempts (from DB)
    const { data: tracker } = await supabase
      .from('login_attempts')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (tracker?.bloqueado_ate && Date.now() < tracker.bloqueado_ate) {
      return { ok: false, erro: 'bloqueado', bloqueadoAte: tracker.bloqueado_ate };
    }

    // Attempt Supabase Auth sign-in
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password: senha });

    if (authError) {
      // Register failed attempt
      const tentativas = (tracker?.tentativas ?? 0) + 1;
      const bloqueadoAte = tentativas >= 5 ? Date.now() + 5 * 60 * 1000 : 0;
      await supabase.from('login_attempts').upsert({
        email: email.toLowerCase(),
        tentativas,
        ultima_tentativa: Date.now(),
        bloqueado_ate: bloqueadoAte,
      }, { onConflict: 'email' });

      if (bloqueadoAte) {
        return { ok: false, erro: 'bloqueado', bloqueadoAte };
      }
      return { ok: false, erro: `Credenciais invalidas. ${5 - tentativas} tentativa(s) restante(s).` };
    }

    // Get the user from the session
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, erro: 'Erro ao obter usuario.' };

    // Check funcionario status
    const { data: funcRow } = await supabase
      .from('funcionarios')
      .select('status')
      .eq('auth_user_id', user.id)
      .single();

    if (!funcRow) return { ok: false, erro: 'Funcionario nao encontrado no sistema.' };
    if (funcRow.status === 'inativo') {
      await supabase.auth.signOut();
      return { ok: false, erro: 'Funcionario inativo. Contate o administrador.' };
    }

    // Clear login attempts
    await supabase.from('login_attempts').delete().eq('email', email.toLowerCase());

    // Build session
    const sessao = await buildSessao(user.id, lembrarMe);
    if (!sessao) {
      await supabase.auth.signOut();
      return { ok: false, erro: 'Erro ao carregar dados do funcionario.' };
    }

    loginHandledRef.current = true;
    setUsuario(sessao);

    adicionarAuditLogAsync({
      tipo: 'login',
      funcionarioId: sessao.funcionarioId,
      detalhes: `Login realizado por ${sessao.nome}`,
    });

    return { ok: true };
  }, []);

  const logout = useCallback(async () => {
    if (usuario) {
      adicionarAuditLogAsync({
        tipo: 'logout',
        funcionarioId: usuario.funcionarioId,
        detalhes: `Logout realizado por ${usuario.nome}`,
      });
    }
    await supabase.auth.signOut();
    setUsuario(null);
  }, [usuario]);

  const temPermissao = useCallback((_modulo: ModuloPermissao, _acao: AcaoPermissao): boolean => {
    return true;
  }, []);

  const temAlgumaPermissao = useCallback((_modulo: ModuloPermissao): boolean => {
    return true;
  }, []);

  const temAcao = useCallback((chave: string): boolean => {
    if (!usuario) return false;
    if (!usuario.acoesPermitidas) return true;
    return usuario.acoesPermitidas.includes(chave);
  }, [usuario]);

  const atualizarSessao = useCallback(async () => {
    if (!usuario) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const novaSessao = await buildSessao(user.id, usuario.lembrarMe);
    if (novaSessao) setUsuario(novaSessao);
  }, [usuario]);

  return (
    <AuthContext.Provider
      value={{
        usuario,
        isAuthenticated: !!usuario,
        loading,
        login,
        logout,
        temPermissao,
        temAlgumaPermissao,
        temAcao,
        atualizarSessao,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
